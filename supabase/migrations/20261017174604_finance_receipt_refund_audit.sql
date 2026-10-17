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
begin
  receipt:=public.finance_payment_receipt_before_refund_audit(p_payment_id);

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
