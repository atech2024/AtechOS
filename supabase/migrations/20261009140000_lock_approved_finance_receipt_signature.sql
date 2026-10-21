-- Once a staff member approves a receipt signature, keep that identity/style immutable.
-- Serialize first-time approvals for the same school member so concurrent requests cannot replace it.
create or replace function public.save_finance_receipt_signature(p_style_id smallint, p_signer_name text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  sid uuid := public.get_my_school_id();
  signer text := nullif(btrim(p_signer_name),'');
  role_name text;
  saved public.finance_staff_receipt_signatures;
  prior public.finance_staff_receipt_signatures;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if sid is null or not private.finance_can_configure_own_receipt_signature(sid) then raise exception 'not_authorized'; end if;
  if p_style_id is null or p_style_id not between 1 and 10 then raise exception 'invalid_signature_style'; end if;
  if signer is null or length(signer)>80 or signer ~ '[[:cntrl:]]' then raise exception 'invalid_signature_name'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(sid::text || ':' || auth.uid()::text,0));
  select * into prior from public.finance_staff_receipt_signatures
    where school_id=sid and user_id=auth.uid()
    for update;
  if prior.user_id is not null and prior.approved_at is not null then
    raise exception 'receipt_signature_already_approved';
  end if;

  select m.role::text into role_name from public.school_members m
    where m.school_id=sid and m.user_id=auth.uid() and m.enabled
    order by case m.role when 'school_admin' then 0 when 'director' then 1 when 'censeur' then 2 when 'accountant' then 3 when 'secretary' then 4 else 5 end
    limit 1;

  insert into public.finance_staff_receipt_signatures(school_id,user_id,signer_name,style_id,approved_at,updated_at)
  values(sid,auth.uid(),signer,p_style_id,now(),now())
  on conflict(school_id,user_id) do update
    set signer_name=excluded.signer_name,style_id=excluded.style_id,approved_at=now(),updated_at=now()
  returning * into saved;

  insert into public.finance_audit_events(school_id,actor_id,actor_role,entity,entity_id,action,before_data,after_data)
  values(sid,auth.uid(),role_name,'finance_staff_receipt_signatures',auth.uid()::text,'updated',
    case when prior.user_id is null then null else jsonb_build_object('signer_name',prior.signer_name,'style_id',prior.style_id,'approved_at',prior.approved_at) end,
    jsonb_build_object('signer_name',saved.signer_name,'style_id',saved.style_id,'approved_at',saved.approved_at));

  return jsonb_build_object('signer_name',saved.signer_name,'style_id',saved.style_id,'approved_at',saved.approved_at);
end $$;

revoke all on function public.save_finance_receipt_signature(smallint,text) from public,anon;
grant execute on function public.save_finance_receipt_signature(smallint,text) to authenticated;
