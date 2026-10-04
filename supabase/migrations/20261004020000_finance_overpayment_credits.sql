-- Preserve overpayments as student credit and automatically apply them to fees.
-- Payments remain immutable cash receipts; allocations separately show how
-- much of each receipt/credit settles each student charge.

alter table public.finance_payments add column applied_amount numeric(12,2);
update public.finance_payments set applied_amount=amount where applied_amount is null;
alter table public.finance_payments alter column applied_amount set not null;
alter table public.finance_payments add constraint finance_payments_applied_amount_check
  check(applied_amount>=0 and applied_amount<=amount);

create table public.finance_student_credits (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id),
  source_payment_id uuid not null unique references public.finance_payments(id),
  amount numeric(12,2) not null check(amount>0),
  currency_code text not null check(currency_code ~ '^[A-Z]{3}$'),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  unique(id,school_id)
);
create index finance_student_credits_student on public.finance_student_credits(school_id,student_id,currency_code,created_at);

create table public.finance_credit_allocations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  credit_id uuid not null,
  charge_id uuid not null,
  amount numeric(12,2) not null check(amount>0),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  foreign key(credit_id,school_id) references public.finance_student_credits(id,school_id),
  foreign key(charge_id,school_id) references public.finance_charges(id,school_id),
  unique(credit_id,charge_id)
);
create index finance_credit_allocations_charge on public.finance_credit_allocations(school_id,charge_id);

create trigger finance_student_credits_audit after insert or update or delete on public.finance_student_credits for each row execute function private.log_finance_event();
create trigger finance_credit_allocations_audit after insert or update or delete on public.finance_credit_allocations for each row execute function private.log_finance_event();
alter table public.finance_student_credits enable row level security;
alter table public.finance_credit_allocations enable row level security;
revoke all on public.finance_student_credits,public.finance_credit_allocations from public,anon,authenticated;
create policy finance_student_credits_read on public.finance_student_credits for select to authenticated using(private.finance_member(school_id));
create policy finance_credit_allocations_read on public.finance_credit_allocations for select to authenticated using(private.finance_member(school_id));
grant select on public.finance_student_credits,public.finance_credit_allocations to authenticated;

create or replace function private.apply_finance_student_credits(p_school uuid,p_student uuid,p_currency text)
returns void language plpgsql security definer set search_path=''
as $$
declare cr record; target record; available numeric; due numeric; portion numeric;
begin
  -- Serialize a student's credits and charge allocations across new plans and
  -- payment approvals so a credit can never be spent twice.
  perform 1 from public.students where id=p_student and school_id=p_school for update;
  for cr in
    select c.id,c.amount-coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.credit_id=c.id),0) as remaining
    from public.finance_student_credits c
    where c.school_id=p_school and c.student_id=p_student and c.currency_code=p_currency
    order by c.created_at,c.id for update
  loop
    available:=cr.remaining;
    if available<=0 then continue; end if;
    for target in
      select c.id,c.amount,
        coalesce((select sum(a.amount) from public.finance_adjustments a where a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance'),0) as adjusted,
        coalesce((select sum(p.applied_amount) from public.finance_payments p where p.charge_id=c.id and p.status in ('pending','validated')),0) as paid,
        coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0) as credited
      from public.finance_charges c
      where c.school_id=p_school and c.student_id=p_student and c.currency_code=p_currency
      order by c.due_date,c.created_at,c.id
    loop
      due:=greatest(0,target.amount-target.adjusted-target.paid-target.credited);
      if due<=0 then continue; end if;
      portion:=least(available,due);
      insert into public.finance_credit_allocations(school_id,credit_id,charge_id,amount,created_by)
      values(p_school,cr.id,target.id,portion,auth.uid())
      on conflict(credit_id,charge_id) do nothing;
      if found then available:=available-portion; end if;
      exit when available<=0;
    end loop;
  end loop;
end $$;
revoke all on function private.apply_finance_student_credits(uuid,uuid,text) from public,anon,authenticated;

create or replace function private.finance_restriction_active(p_student uuid,p_channel text)
returns boolean language sql stable security definer set search_path=''
as $$
  select coalesce((
    select case p_channel
      when 'kiosk' then coalesce((select fs.restrict_kiosk from public.finance_settings fs where fs.school_id=s.school_id),false)
      when 'exams' then coalesce((select fs.restrict_exams from public.finance_settings fs where fs.school_id=s.school_id),false)
      when 'bulletins' then coalesce((select fs.restrict_bulletins from public.finance_settings fs where fs.school_id=s.school_id),false)
      else false
    end
    and exists (
      select 1 from public.finance_charges c
      where c.school_id=s.school_id and c.student_id=s.id
        and c.due_date < (now() at time zone 'America/Port-au-Prince')::date
        and greatest(0,c.amount
          - coalesce((select sum(a.amount) from public.finance_adjustments a where a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance'),0)
          - coalesce((select sum(p.applied_amount) from public.finance_payments p where p.charge_id=c.id and p.status='validated'),0)
          - coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0)) > 0
        and not exists (
          select 1 from public.finance_adjustments a where a.charge_id=c.id
            and a.status='approved' and a.adjustment_type='temporary_clearance'
            and a.valid_from<=now() and a.valid_until>now()
        )
    )
    from public.students s where s.id=p_student and s.active and s.school_status='active'
  ),false)
$$;
revoke all on function private.finance_restriction_active(uuid,text) from public,anon,authenticated;

create or replace function public.badge_workspace(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid; manage boolean; payment_restricted boolean;
begin
  select school_id into sid from public.students where id=p_student;
  if sid is null or not private.can_report_badge(p_student) then raise exception 'not_authorized'; end if;
  manage:=private.can_manage_badge(sid);
  payment_restricted:=private.finance_restriction_active(p_student,'kiosk');
  return jsonb_build_object('can_manage',manage,'payment_restricted',payment_restricted,
    'qr',case when manage then (select 'AOSQ1.'||c.token from private.student_badge_credentials c join public.student_badges b on b.id=c.badge_id where c.student_id=p_student and b.active and b.state='active') end,
    'badges',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'serial',b.badge_uid,'state',b.state,'issued_at',b.issued_at,'issued_by',u.full_name,'revoked_at',b.revoked_at,'reason',b.reason) order by b.issued_at desc) from public.student_badges b left join public.users u on u.id=b.issued_by where b.student_id=p_student),'[]'),
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from public.badge_events e where e.student_id=p_student),'[]'),
    'scans',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select source,result,device_location,created_at from public.badge_scans where student_id=p_student order by created_at desc limit 100) e),'[]'));
end $$;
revoke all on function public.badge_workspace(uuid) from public,anon;
grant execute on function public.badge_workspace(uuid) to authenticated;

create or replace function public.record_finance_payment(p_charge_id uuid,p_amount numeric,p_payment_method text,p_reference text,p_proof_storage_path text,p_paid_at timestamptz)
returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); c public.finance_charges; booked numeric; adjustment numeric; remaining numeric; applied numeric; payment_id uuid; method text:=trim(coalesce(p_payment_method,'')); proof text:=nullif(trim(coalesce(p_proof_storage_path,'')), '');
begin
  if auth.uid() is null or sid is null or not private.finance_member(sid) then raise exception 'not_authorized'; end if;
  if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or length(method) not between 2 and 60 or p_paid_at is null then raise exception 'invalid_payment'; end if;
  select * into c from public.finance_charges where id=p_charge_id and school_id=sid for update;
  if c.id is null then raise exception 'charge_not_found'; end if;
  select coalesce(sum(applied_amount),0)+coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0) into booked from public.finance_payments where charge_id=c.id and status in ('pending','validated');
  select coalesce(sum(amount),0) into adjustment from public.finance_adjustments where charge_id=c.id and status='approved' and adjustment_type<>'temporary_clearance';
  remaining:=greatest(0,c.amount-adjustment-booked);
  applied:=least(p_amount,remaining);
  if p_amount>remaining and not exists(select 1 from public.finance_fee_plans fp where fp.id=c.fee_plan_id and fp.school_id=sid and fp.fee_type in ('inscription','rentree')) then
    raise exception 'overpayment_only_allowed_for_entry_fees';
  end if;
  if proof is not null and (split_part(proof,'/',1)<>sid::text or split_part(proof,'/',2)<>auth.uid()::text
    or not exists(select 1 from storage.objects o where o.bucket_id='finance-proofs' and o.name=proof)) then raise exception 'invalid_proof_path'; end if;
  insert into public.finance_payments(school_id,charge_id,amount,applied_amount,currency_code,payment_method,reference,proof_storage_path,paid_at,recorded_by)
  values(sid,c.id,p_amount,applied,c.currency_code,method,nullif(trim(coalesce(p_reference,'')),''),proof,p_paid_at,auth.uid()) returning id into payment_id;
  return payment_id;
end $$;

create or replace function public.review_finance_payment(p_payment_id uuid,p_decision text,p_reason text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); pay public.finance_payments; c public.finance_charges; settings public.finance_settings; booked numeric; adjustment numeric; balance numeric; family record; msg text; credit_id uuid; credit_balance numeric;
begin
  if auth.uid() is null or sid is null or not private.finance_can_validate(sid) then raise exception 'not_authorized'; end if;
  if p_decision not in ('validated','rejected') or (p_decision='rejected' and length(trim(coalesce(p_reason,'')))<3) then raise exception 'invalid_review'; end if;
  select * into pay from public.finance_payments where id=p_payment_id and school_id=sid for update;
  if pay.id is null or pay.status<>'pending' then raise exception 'payment_not_pending'; end if;
  select * into c from public.finance_charges where id=pay.charge_id and school_id=sid for update;
  select * into settings from public.finance_settings where school_id=sid;
  if p_decision='validated' then
    if coalesce(settings.proof_required,false) and pay.proof_storage_path is null then raise exception 'payment_proof_required'; end if;
    select coalesce(sum(applied_amount),0)+coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0) into booked from public.finance_payments where charge_id=c.id and status='validated' and id<>pay.id;
    select coalesce(sum(amount),0) into adjustment from public.finance_adjustments where charge_id=c.id and status='approved' and adjustment_type<>'temporary_clearance';
    if booked+pay.applied_amount>c.amount-adjustment then raise exception 'payment_exceeds_balance'; end if;
  end if;
  update public.finance_payments set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_reason=nullif(trim(coalesce(p_reason,'')),'') where id=pay.id;
  if p_decision='validated' then
    if pay.amount>pay.applied_amount then
      insert into public.finance_student_credits(school_id,student_id,source_payment_id,amount,currency_code,created_by)
      values(sid,c.student_id,pay.id,pay.amount-pay.applied_amount,c.currency_code,auth.uid()) returning id into credit_id;
      perform private.apply_finance_student_credits(sid,c.student_id,c.currency_code);
      select greatest(0,cr.amount-coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.credit_id=cr.id),0)) into credit_balance from public.finance_student_credits cr where cr.id=credit_id;
    end if;
    select greatest(0,c.amount-coalesce((select sum(a.amount) from public.finance_adjustments a where a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance'),0)-coalesce((select sum(p.applied_amount) from public.finance_payments p where p.charge_id=c.id and p.status='validated'),0)-coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0)) into balance;
    msg:=format('Montant : %s %s · Frais : %s · Date : %s · Statut : Validé · Solde restant : %s %s · Kredi ki rete : %s %s · Référence : %s',to_char(pay.amount,'FM999999999990D00'),pay.currency_code,c.description,to_char(pay.paid_at at time zone 'America/Port-au-Prince','DD/MM/YYYY'),to_char(balance,'FM999999999990D00'),pay.currency_code,to_char(coalesce(credit_balance,0),'FM999999999990D00'),pay.currency_code,coalesce(pay.reference,'—'));
    for family in select distinct p.user_id from public.student_parents sp join public.parents p on p.id=sp.parent_id join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id and m.enabled and m.role='parent' where sp.student_id=c.student_id and p.school_id=sid and p.user_id is not null loop
      insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
      values(sid,family.user_id,'finance','Paiement validé',msg,'normal','/dashboard/parent-portal','finance-payment-validated:'||pay.id::text)
      on conflict(school_id,recipient_id,event_key) do nothing;
    end loop;
  end if;
end $$;

create or replace function public.issue_finance_fee_plan(p_fee_plan_id uuid)
returns integer language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); p public.finance_fee_plans; inserted integer; student_row record;
begin
  if auth.uid() is null or sid is null or not private.finance_manager(sid) then raise exception 'not_authorized'; end if;
  select * into p from public.finance_fee_plans where id=p_fee_plan_id and school_id=sid and active for update;
  if p.id is null then raise exception 'fee_plan_not_found'; end if;
  insert into public.finance_charges(school_id,student_id,academic_year_id,class_id,fee_plan_id,fee_installment_id,description,amount,currency_code,due_date,created_by)
  select sid,s.id,p.academic_year_id,p.class_id,p.id,i.id,p.label||' — '||i.installment_number::text,i.amount,p.currency_code,i.due_date,auth.uid()
  from public.enrollments e join public.students s on s.id=e.student_id and s.school_id=sid and s.active and s.school_status='active'
  join public.classes c on c.id=e.class_id and c.id=p.class_id and c.school_id=sid and c.academic_year_id=p.academic_year_id and c.enabled
  join public.finance_fee_installments i on i.fee_plan_id=p.id and i.school_id=sid
  where e.school_id=sid and e.class_id=p.class_id and e.status='active'
  on conflict(student_id,fee_installment_id) do nothing;
  get diagnostics inserted=row_count;
  for student_row in select distinct student_id from public.finance_charges where fee_plan_id=p.id and school_id=sid loop
    perform private.apply_finance_student_credits(sid,student_row.student_id,p.currency_code);
  end loop;
  return inserted;
end $$;

create or replace function public.review_finance_adjustment(p_adjustment_id uuid,p_decision text,p_reason text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); a public.finance_adjustments; c public.finance_charges; booked numeric; prior numeric;
begin
  if auth.uid() is null or sid is null or not private.finance_manager(sid) then raise exception 'not_authorized'; end if;
  if p_decision not in ('approved','rejected') or (p_decision='rejected' and length(trim(coalesce(p_reason,'')))<3) then raise exception 'invalid_review'; end if;
  select * into a from public.finance_adjustments where id=p_adjustment_id and school_id=sid for update;
  if a.id is null or a.status<>'pending' then raise exception 'adjustment_not_pending'; end if;
  select * into c from public.finance_charges where id=a.charge_id and school_id=sid for update;
  if p_decision='approved' and a.adjustment_type<>'temporary_clearance' then
    select coalesce(sum(applied_amount),0)+coalesce((select sum(x.amount) from public.finance_credit_allocations x where x.charge_id=c.id),0) into booked from public.finance_payments where charge_id=c.id and status in ('pending','validated');
    select coalesce(sum(amount),0) into prior from public.finance_adjustments where charge_id=c.id and status='approved' and adjustment_type<>'temporary_clearance';
    if a.amount>c.amount-booked-prior then raise exception 'adjustment_exceeds_balance'; end if;
  end if;
  update public.finance_adjustments set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_reason=nullif(trim(coalesce(p_reason,'')),'') where id=a.id;
end $$;

create or replace function public.revoke_finance_adjustment(p_adjustment_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); a public.finance_adjustments; c public.finance_charges; booked numeric; prior numeric;
begin
  if auth.uid() is null or sid is null or not private.finance_manager(sid) then raise exception 'not_authorized'; end if;
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'reason_required'; end if;
  select * into a from public.finance_adjustments where id=p_adjustment_id and school_id=sid and status='approved' for update;
  if a.id is null then raise exception 'approved_adjustment_not_found'; end if;
  select * into c from public.finance_charges where id=a.charge_id and school_id=sid for update;
  if a.adjustment_type<>'temporary_clearance' then
    select coalesce(sum(applied_amount),0)+coalesce((select sum(x.amount) from public.finance_credit_allocations x where x.charge_id=c.id),0) into booked from public.finance_payments where charge_id=c.id and status in ('pending','validated');
    select coalesce(sum(amount),0) into prior from public.finance_adjustments where charge_id=c.id and status='approved' and adjustment_type<>'temporary_clearance' and id<>a.id;
    if booked>c.amount-prior then raise exception 'payment_balance_conflict'; end if;
  end if;
  update public.finance_adjustments set status='revoked',reviewed_by=auth.uid(),reviewed_at=now(),review_reason=trim(p_reason) where id=a.id;
end $$;

create or replace function public.finance_workspace(p_academic_year_id uuid default null,p_class_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); expected numeric; paid numeric; pending integer; validated_count integer;
begin
  if auth.uid() is null or sid is null or not private.finance_member(sid) then raise exception 'not_authorized'; end if;
  if p_academic_year_id is not null and not exists(select 1 from public.academic_years y where y.id=p_academic_year_id and y.school_id=sid) then raise exception 'invalid_year'; end if;
  if p_class_id is not null and not exists(select 1 from public.classes c where c.id=p_class_id and c.school_id=sid and (p_academic_year_id is null or c.academic_year_id=p_academic_year_id)) then raise exception 'invalid_class'; end if;
  select coalesce(sum(c.amount-coalesce(a.adjusted,0)),0),coalesce(sum(p.paid),0),coalesce(sum(p.pending),0)::integer,coalesce(sum(p.validated_count),0)::integer
  into expected,paid,pending,validated_count
  from public.finance_charges c
  left join lateral (select sum(x.amount) adjusted from public.finance_adjustments x where x.charge_id=c.id and x.status='approved' and x.adjustment_type<>'temporary_clearance') a on true
  left join lateral (
    select sum(x.applied_amount) filter(where x.status='validated') + coalesce((select sum(ca.amount) from public.finance_credit_allocations ca where ca.charge_id=c.id),0) paid,
      count(*) filter(where x.status='pending') pending,count(*) filter(where x.status='validated') validated_count
    from public.finance_payments x where x.charge_id=c.id
  ) p on true
  where c.school_id=sid and (p_academic_year_id is null or c.academic_year_id=p_academic_year_id) and (p_class_id is null or c.class_id=p_class_id);
  select paid+coalesce(sum(cr.amount-coalesce(alloc.total,0)),0) into paid
  from public.finance_student_credits cr
  join public.finance_payments receipt on receipt.id=cr.source_payment_id
  join public.finance_charges source_charge on source_charge.id=receipt.charge_id
  left join lateral(select sum(a.amount) total from public.finance_credit_allocations a where a.credit_id=cr.id) alloc on true
  where cr.school_id=sid and cr.amount>coalesce(alloc.total,0)
    and (p_academic_year_id is null or source_charge.academic_year_id=p_academic_year_id)
    and (p_class_id is null or source_charge.class_id=p_class_id);
  return jsonb_build_object(
    'settings',(select to_jsonb(f) from public.finance_settings f where f.school_id=sid),
    'years',(select coalesce(jsonb_agg(to_jsonb(y) order by y.start_date desc),'[]'::jsonb) from public.academic_years y where y.school_id=sid),
    'classes',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'academic_year_id',c.academic_year_id,'enabled',c.enabled) order by c.name),'[]'::jsonb) from public.classes c where c.school_id=sid and c.enabled),
    'summary',jsonb_build_object('expected',expected,'paid',paid,'pending_payments',pending,'validated_payment_count',validated_count,'balance',greatest(0,expected-paid)),
    'plans',(select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) from (select p.*,c.name as class_name,y.name as academic_year_name,(select coalesce(jsonb_agg(to_jsonb(i) order by i.installment_number),'[]'::jsonb) from public.finance_fee_installments i where i.fee_plan_id=p.id) as installments from public.finance_fee_plans p join public.classes c on c.id=p.class_id join public.academic_years y on y.id=p.academic_year_id where p.school_id=sid and (p_academic_year_id is null or p.academic_year_id=p_academic_year_id) and (p_class_id is null or p.class_id=p_class_id) order by p.created_at desc limit 200) q),
    'charges',(select coalesce(jsonb_agg(to_jsonb(q) order by q.due_date desc),'[]'::jsonb) from (select c.id,c.student_id,c.academic_year_id,c.class_id,c.fee_plan_id,c.fee_installment_id,c.description,c.amount,c.currency_code,c.due_date,c.created_at,fp.fee_type,s.first_name||' '||s.last_name as student_name,cl.name as class_name,y.name as academic_year_name,coalesce((select sum(a.amount) from public.finance_adjustments a where a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance'),0) as adjusted_amount,coalesce((select sum(p.applied_amount) from public.finance_payments p where p.charge_id=c.id and p.status='validated'),0)+coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.charge_id=c.id),0) as paid_amount,coalesce((select sum(p.applied_amount) from public.finance_payments p where p.charge_id=c.id and p.status='pending'),0) as pending_amount from public.finance_charges c join public.finance_fee_plans fp on fp.id=c.fee_plan_id join public.students s on s.id=c.student_id join public.classes cl on cl.id=c.class_id join public.academic_years y on y.id=c.academic_year_id where c.school_id=sid and (p_academic_year_id is null or c.academic_year_id=p_academic_year_id) and (p_class_id is null or c.class_id=p_class_id) order by c.due_date desc,c.created_at desc limit 500) q),
    'payments',(select coalesce(jsonb_agg(to_jsonb(q) order by q.recorded_at desc),'[]'::jsonb) from (select p.*,s.first_name||' '||s.last_name as student_name,c.description as charge_description,c.due_date as charge_due_date,cl.name as class_name,(select coalesce(sum(x.applied_amount),0) from public.finance_payments x where x.charge_id=p.charge_id and x.status='validated') as charge_paid from public.finance_payments p join public.finance_charges c on c.id=p.charge_id join public.students s on s.id=c.student_id join public.classes cl on cl.id=c.class_id where p.school_id=sid and (p_academic_year_id is null or c.academic_year_id=p_academic_year_id) and (p_class_id is null or c.class_id=p_class_id) order by p.recorded_at desc limit 500) q),
    'adjustments',(select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) from (select a.*,s.first_name||' '||s.last_name as student_name,c.description as charge_description from public.finance_adjustments a join public.finance_charges c on c.id=a.charge_id join public.students s on s.id=c.student_id where a.school_id=sid and (p_academic_year_id is null or c.academic_year_id=p_academic_year_id) and (p_class_id is null or c.class_id=p_class_id) order by a.created_at desc limit 500) q),
    'credits',(select coalesce(jsonb_agg(to_jsonb(q) order by q.student_name),'[]'::jsonb) from (select cr.student_id,s.first_name||' '||s.last_name student_name,cr.currency_code,sum(cr.amount-coalesce(a.allocated,0)) amount from public.finance_student_credits cr join public.students s on s.id=cr.student_id left join lateral(select sum(x.amount) allocated from public.finance_credit_allocations x where x.credit_id=cr.id)a on true where cr.school_id=sid and cr.amount>coalesce(a.allocated,0) group by cr.student_id,s.first_name,s.last_name,cr.currency_code) q),
    'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.occurred_at desc),'[]'::jsonb) from (select e.id,e.actor_id,e.actor_role,e.entity,e.entity_id,e.action,e.before_data,e.after_data,e.occurred_at,u.full_name as actor_name from public.finance_audit_events e left join public.users u on u.id=e.actor_id where e.school_id=sid and (private.finance_manager(sid) or e.actor_id=auth.uid()) order by e.occurred_at desc limit 100) a),
    'can_manage',private.finance_manager(sid),'can_validate',private.finance_can_validate(sid),'can_record',private.finance_member(sid)
  );
end $$;

revoke all on function public.finance_workspace(uuid,uuid),public.issue_finance_fee_plan(uuid),public.record_finance_payment(uuid,numeric,text,text,text,timestamptz),public.review_finance_payment(uuid,text,text) from public,anon;
grant execute on function public.finance_workspace(uuid,uuid),public.issue_finance_fee_plan(uuid),public.record_finance_payment(uuid,numeric,text,text,text,timestamptz),public.review_finance_payment(uuid,text,text) to authenticated;
