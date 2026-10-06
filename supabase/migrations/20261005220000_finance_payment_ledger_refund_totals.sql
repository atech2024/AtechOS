-- The BRH-rate migration replaced finance_payment_ledger after refunds were
-- introduced and accidentally dropped the refunded_amount field. Keep the
-- existing response contract, FX evidence, pagination, and school scoping.
create or replace function public.finance_payment_ledger(
  p_academic_year_id uuid default null,
  p_class_id uuid default null,
  p_status text default null,
  p_search text default null,
  p_offset integer default 0,
  p_limit integer default 50
) returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  sid uuid:=public.get_my_school_id();
  total bigint;
  items jsonb;
  term text:=left(trim(coalesce(p_search,'')),120);
  page_size integer:=least(greatest(coalesce(p_limit,50),1),100);
  page_offset integer:=greatest(coalesce(p_offset,0),0);
begin
  if auth.uid() is null or sid is null or not private.finance_member(sid) then
    raise exception 'not_authorized';
  end if;
  if p_status is not null and p_status not in ('pending','validated','rejected') then
    raise exception 'invalid_payment_status';
  end if;

  select count(*) into total
  from public.finance_payments p
  join public.finance_charges c on c.id=p.charge_id and c.school_id=sid
  join public.students s on s.id=c.student_id and s.school_id=sid
  join public.classes cl on cl.id=c.class_id and cl.school_id=sid
  where p.school_id=sid
    and (p_academic_year_id is null or c.academic_year_id=p_academic_year_id)
    and (p_class_id is null or c.class_id=p_class_id)
    and (p_status is null or p.status=p_status)
    and (term='' or position(lower(term) in lower(concat_ws(' ',s.first_name,s.last_name,c.description,cl.name,p.reference,p.payment_method)))>0);

  select coalesce(jsonb_agg(to_jsonb(q) order by q.recorded_at desc,q.id desc),'[]'::jsonb)
  into items
  from (
    select
      p.*,
      s.first_name||' '||s.last_name as student_name,
      c.description as charge_description,
      cl.name as class_name,
      (select coalesce(sum(x.applied_amount),0)
       from public.finance_payments x
       where x.charge_id=p.charge_id and x.status='validated') as charge_paid,
      coalesce((select sum(r.amount)
                from public.finance_payment_refunds r
                where r.payment_id=p.id and r.school_id=sid),0) as refunded_amount
    from public.finance_payments p
    join public.finance_charges c on c.id=p.charge_id and c.school_id=sid
    join public.students s on s.id=c.student_id and s.school_id=sid
    join public.classes cl on cl.id=c.class_id and cl.school_id=sid
    where p.school_id=sid
      and (p_academic_year_id is null or c.academic_year_id=p_academic_year_id)
      and (p_class_id is null or c.class_id=p_class_id)
      and (p_status is null or p.status=p_status)
      and (term='' or position(lower(term) in lower(concat_ws(' ',s.first_name,s.last_name,c.description,cl.name,p.reference,p.payment_method)))>0)
    order by p.recorded_at desc,p.id desc
    limit page_size offset page_offset
  ) q;

  return jsonb_build_object('items',items,'total',total,'offset',page_offset,'limit',page_size);
end $$;
revoke all on function public.finance_payment_ledger(uuid,uuid,text,text,integer,integer) from public,anon;
grant execute on function public.finance_payment_ledger(uuid,uuid,text,text,integer,integer) to authenticated;
