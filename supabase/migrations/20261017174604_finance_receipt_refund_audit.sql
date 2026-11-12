-- Include every refund event on the already-authorized payment receipt.
-- The source payment receipt RPC performs the school/parent authorization first.
alter function public.finance_payment_receipt(uuid)
  rename to finance_payment_receipt_before_refund_audit;
revoke all on function public.finance_payment_receipt_before_refund_audit(uuid)
  from public,anon,authenticated;

create or replace function public.finance_payment_receipt(p_payment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  receipt jsonb;
  refund_history jsonb;
  payment_credit_allocations jsonb;
  school_year_balance numeric;
  sid uuid;
  stid uuid;
  year_id uuid;
  currency text;
begin
  receipt:=public.finance_payment_receipt_before_refund_audit(p_payment_id);

  -- The wrapped receipt RPC has already authorized the parent/staff caller.
  select p.school_id,c.student_id,c.academic_year_id,c.currency_code
    into sid,stid,year_id,currency
  from public.finance_payments p
  join public.finance_charges c on c.id=p.charge_id and c.school_id=p.school_id
  where p.id=p_payment_id and p.status='validated';
  if sid is null then raise exception 'receipt_not_found'; end if;

  select coalesce(sum(greatest(0,c.amount
      -coalesce((select sum(a.amount) from public.finance_adjustments a where a.school_id=sid and a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance'),0)
      -coalesce((select sum(x.applied_amount) from public.finance_payments x where x.school_id=sid and x.charge_id=c.id and x.status='validated'),0)
      -coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.school_id=sid and a.charge_id=c.id),0))),0)
    into school_year_balance
  from public.finance_charges c
  where c.school_id=sid and c.student_id=stid and c.academic_year_id=year_id and c.currency_code=currency;

  select coalesce(jsonb_agg(jsonb_build_object(
      'description',target.description,'due_date',target.due_date,'amount',a.amount,'currency_code',target.currency_code
    ) order by target.due_date,target.id),'[]'::jsonb)
    into payment_credit_allocations
  from public.finance_student_credits cr
  join public.finance_credit_allocations a on a.credit_id=cr.id and a.school_id=cr.school_id
  join public.finance_charges target on target.id=a.charge_id and target.school_id=a.school_id
  where cr.school_id=sid and cr.source_payment_id=p_payment_id;

  receipt:=jsonb_set(receipt,'{credit_allocations}',coalesce(payment_credit_allocations,'[]'::jsonb),true);
  receipt:=jsonb_set(receipt,'{school_year_remaining_balance}',to_jsonb(coalesce(school_year_balance,0)),true);
  receipt:=jsonb_set(receipt,'{school_year_currency_code}',to_jsonb(currency),true);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',r.id,
        'amount',r.amount,
        'recorded_at',r.recorded_at,
        'recorded_by_name',nullif(trim(u.full_name),'')
      )
      order by r.recorded_at,r.id
    ),
    '[]'::jsonb
  )
  into refund_history
  from public.finance_payment_refunds r
  join public.finance_payments p
    on p.id=r.payment_id
   and p.school_id=r.school_id
  left join public.users u on u.id=r.recorded_by
  where p.id=p_payment_id
    and p.status='validated';

  return jsonb_set(
    receipt,
    '{refunds}',
    coalesce(refund_history,'[]'::jsonb),
    true
  );
end $$;

revoke all on function public.finance_payment_receipt(uuid) from public,anon;
grant execute on function public.finance_payment_receipt(uuid) to authenticated;


-- Parents may pay any outstanding installment early. Keep the original
-- authenticated parent-link checks and the configured-method/BRH wrappers.
do $$
declare
  workspace_def text;
  payment_def text;
  date_filter text:=' and c.due_date<=(now() at time zone ''America/Port-au-Prince'')::date';
  date_gate text:='if c.due_date>(now() at time zone ''America/Port-au-Prince'')::date then raise exception ''installment_not_due''; end if;';
begin
  select pg_get_functiondef('public.family_finance_workspace_base(uuid)'::regprocedure) into workspace_def;
  if position(date_filter in workspace_def)=0 then raise exception 'parent_finance_future_charge_filter_not_found'; end if;
  workspace_def:=replace(workspace_def,date_filter,'');
  execute workspace_def;

  select pg_get_functiondef('public.submit_family_finance_payment_base(uuid,numeric,text,text,text)'::regprocedure) into payment_def;
  if position(date_gate in payment_def)=0 then raise exception 'parent_finance_early_payment_gate_not_found'; end if;
  payment_def:=replace(payment_def,date_gate,'');
  execute payment_def;
end $$;
