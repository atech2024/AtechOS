-- Preserve the legacy one-argument RPC for first-time approvals while enforcing the
-- same immutable approval rule as the current two-argument RPC.
create or replace function public.save_finance_receipt_signature(p_style_id smallint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  signer text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select nullif(btrim(u.full_name),'') into signer
    from public.users u where u.id=auth.uid();
  if signer is null then raise exception 'signature_name_required'; end if;
  return public.save_finance_receipt_signature(p_style_id, signer);
end $$;

revoke all on function public.save_finance_receipt_signature(smallint) from public, anon;
grant execute on function public.save_finance_receipt_signature(smallint) to authenticated;
