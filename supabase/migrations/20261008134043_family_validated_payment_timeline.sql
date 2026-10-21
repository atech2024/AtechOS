-- Read-only timeline for a verified linked child. Include staff-recorded receipts,
-- but never show pending/rejected or fully refunded receipts as paid events.
create or replace function public.family_validated_payment_events(
  p_student uuid,p_from date,p_to date
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare sid uuid; events jsonb; row_count integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>365 then
    raise exception 'invalid_payment_date_range';
  end if;
  select s.school_id into sid from public.students s where s.id=p_student;
  if sid is null or not private.finance_parent_linked(sid,p_student,auth.uid()) then
    raise exception 'not_authorized';
  end if;

  select count(*),coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'paid_at',q.paid_at,'charge_description',q.description,'status','validated'
  ) order by q.paid_at desc,q.id desc) filter(where q.row_num<=500),'[]'::jsonb)
  into row_count,events
  from (
    select p.id,p.paid_at,c.description,
      row_number() over(order by p.paid_at desc,p.id desc) as row_num
    from public.finance_payments p
    join public.finance_charges c on c.id=p.charge_id and c.school_id=sid and c.student_id=p_student
    where p.school_id=sid and p.status='validated'
      and (p.paid_at at time zone 'America/Port-au-Prince')::date between p_from and p_to
      and p.amount>coalesce((
        select sum(r.amount) from public.finance_payment_refunds r
        where r.school_id=sid and r.payment_id=p.id
      ),0)
    order by p.paid_at desc,p.id desc limit 501
  ) q;
  return jsonb_build_object('payments',events,'truncated',row_count>500);
end $$;
revoke all on function public.family_validated_payment_events(uuid,date,date) from public,anon;
grant execute on function public.family_validated_payment_events(uuid,date,date) to authenticated;
