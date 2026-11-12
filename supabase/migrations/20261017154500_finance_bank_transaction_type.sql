-- Distinguish bank transfers from branch deposits while keeping the bank's
-- transaction reference verbatim. Formats remain bank-specific and are not regex-validated.
alter table public.finance_payments
  add column bank_transaction_type text
    check (bank_transaction_type is null or bank_transaction_type in ('transfer','branch_deposit'));

comment on column public.finance_payments.bank_transaction_type is
  'Bank transaction channel: transfer confirmation or branch deposit receipt. The reference value remains exactly as supplied by the payer.';

-- Keep the prior implementations private to the public RPC wrappers. Legacy calls
-- remain compatible for other methods, but cannot submit a bank payment without
-- identifying the bank transaction type.
alter function public.submit_family_finance_payment(uuid,numeric,text,text,text)
  rename to submit_family_finance_payment_base;
revoke all on function public.submit_family_finance_payment_base(uuid,numeric,text,text,text)
  from public,anon,authenticated;

create or replace function public.submit_family_finance_payment(
  p_charge_id uuid,p_amount numeric,p_payment_method text,p_reference text,
  p_proof_storage_path text,p_bank_transaction_type text
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  method_key text:=private.finance_method_key(p_payment_method);
  bank_type text:=nullif(trim(coalesce(p_bank_transaction_type,'')),'');
  payment_id uuid;
begin
  if method_key in ('bank_transfer_htg','bank_transfer_usd') then
    if coalesce(bank_type,'') not in ('transfer','branch_deposit') then raise exception 'bank_transaction_type_required'; end if;
  elsif bank_type is not null then
    raise exception 'invalid_bank_transaction_type';
  end if;

  payment_id:=public.submit_family_finance_payment_base(
    p_charge_id,p_amount,p_payment_method,p_reference,p_proof_storage_path
  );
  update public.finance_payments
    set bank_transaction_type=bank_type
    where id=payment_id and recorded_by=auth.uid() and status='pending';
  if not found then raise exception 'payment_save_failed'; end if;
  return payment_id;
end $$;
revoke all on function public.submit_family_finance_payment(uuid,numeric,text,text,text,text)
  from public,anon;
grant execute on function public.submit_family_finance_payment(uuid,numeric,text,text,text,text)
  to authenticated;

create or replace function public.submit_family_finance_payment(
  p_charge_id uuid,p_amount numeric,p_payment_method text,p_reference text,
  p_proof_storage_path text
) returns uuid
language plpgsql security definer set search_path=''
as $$
begin
  if private.finance_method_key(p_payment_method) in ('bank_transfer_htg','bank_transfer_usd') then
    raise exception 'bank_transaction_type_required';
  end if;
  return public.submit_family_finance_payment_base(
    p_charge_id,p_amount,p_payment_method,p_reference,p_proof_storage_path
  );
end $$;
revoke all on function public.submit_family_finance_payment(uuid,numeric,text,text,text)
  from public,anon;
grant execute on function public.submit_family_finance_payment(uuid,numeric,text,text,text)
  to authenticated;

alter function public.record_finance_payment(uuid,numeric,text,text,text,timestamptz)
  rename to record_finance_payment_base;
revoke all on function public.record_finance_payment_base(uuid,numeric,text,text,text,timestamptz)
  from public,anon,authenticated;

create or replace function public.record_finance_payment(
  p_charge_id uuid,p_amount numeric,p_payment_method text,p_reference text,
  p_proof_storage_path text,p_paid_at timestamptz,p_bank_transaction_type text
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  method_key text:=private.finance_method_key(p_payment_method);
  bank_type text:=nullif(trim(coalesce(p_bank_transaction_type,'')),'');
  payment_id uuid;
  sid uuid:=public.get_my_school_id();
begin
  if method_key in ('bank_transfer_htg','bank_transfer_usd') then
    if coalesce(bank_type,'') not in ('transfer','branch_deposit') then raise exception 'bank_transaction_type_required'; end if;
  elsif bank_type is not null then
    raise exception 'invalid_bank_transaction_type';
  end if;

  payment_id:=public.record_finance_payment_base(
    p_charge_id,p_amount,p_payment_method,p_reference,p_proof_storage_path,p_paid_at
  );
  update public.finance_payments
    set bank_transaction_type=bank_type
    where id=payment_id and school_id=sid and recorded_by=auth.uid() and status='pending';
  if not found then raise exception 'payment_save_failed'; end if;
  return payment_id;
end $$;
revoke all on function public.record_finance_payment(uuid,numeric,text,text,text,timestamptz,text)
  from public,anon;
grant execute on function public.record_finance_payment(uuid,numeric,text,text,text,timestamptz,text)
  to authenticated;

create or replace function public.record_finance_payment(
  p_charge_id uuid,p_amount numeric,p_payment_method text,p_reference text,
  p_proof_storage_path text,p_paid_at timestamptz
) returns uuid
language plpgsql security definer set search_path=''
as $$
begin
  if private.finance_method_key(p_payment_method) in ('bank_transfer_htg','bank_transfer_usd') then
    raise exception 'bank_transaction_type_required';
  end if;
  return public.record_finance_payment_base(
    p_charge_id,p_amount,p_payment_method,p_reference,p_proof_storage_path,p_paid_at
  );
end $$;
revoke all on function public.record_finance_payment(uuid,numeric,text,text,text,timestamptz)
  from public,anon;
grant execute on function public.record_finance_payment(uuid,numeric,text,text,text,timestamptz)
  to authenticated;

-- The staff ledger already serializes finance_payments with p.*, so it includes
-- bank_transaction_type. Add the same scoped field to each already-authorized
-- parent payment record and to the authorized printable receipt.
alter function public.family_finance_workspace(uuid)
  rename to family_finance_workspace_before_bank_transaction;
revoke all on function public.family_finance_workspace_before_bank_transaction(uuid)
  from public,anon,authenticated;

create or replace function public.family_finance_workspace(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  base jsonb;
  payment_history jsonb;
begin
  base:=public.family_finance_workspace_before_bank_transaction(p_student_id);
  select coalesce(
    jsonb_agg(
      e.item||jsonb_build_object('bank_transaction_type',p.bank_transaction_type)
      order by e.ordinality
    ),
    '[]'::jsonb
  )
  into payment_history
  from jsonb_array_elements(coalesce(base->'payments','[]'::jsonb))
       with ordinality as e(item,ordinality)
  join public.finance_payments p on p.id=(e.item->>'id')::uuid
  where p.school_id=(base->>'school_id')::uuid;
  base:=jsonb_set(base,'{payments}',coalesce(payment_history,'[]'::jsonb),true);
  return base;
end $$;
revoke all on function public.family_finance_workspace(uuid) from public,anon;
grant execute on function public.family_finance_workspace(uuid) to authenticated;

alter function public.finance_payment_receipt(uuid)
  rename to finance_payment_receipt_before_bank_transaction;
revoke all on function public.finance_payment_receipt_before_bank_transaction(uuid)
  from public,anon,authenticated;

create or replace function public.finance_payment_receipt(p_payment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  receipt jsonb;
  bank_type text;
begin
  receipt:=public.finance_payment_receipt_before_bank_transaction(p_payment_id);
  -- The base receipt has already verified school membership or the linked
  -- parent relationship before this supplemental field is read.
  select p.bank_transaction_type into bank_type
    from public.finance_payments p
    where p.id=p_payment_id and p.status='validated';
  return jsonb_set(
    receipt,'{payment,bank_transaction_type}',
    coalesce(to_jsonb(bank_type),'null'::jsonb),true
  );
end $$;
revoke all on function public.finance_payment_receipt(uuid) from public,anon;
grant execute on function public.finance_payment_receipt(uuid) to authenticated;
