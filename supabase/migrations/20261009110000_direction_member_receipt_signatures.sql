-- Allow each authorized document-signing staff member to configure their own receipt signature.
-- This profile permission does not grant permission to validate payments.
create or replace function private.finance_can_configure_own_receipt_signature(p_school uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null and (
    exists(
      select 1 from public.school_members m
      where m.school_id=p_school and m.user_id=auth.uid() and m.enabled
        and m.role in ('school_admin','director','censeur','secretary','accountant')
    )
    or exists(select 1 from public.schools s where s.id=p_school and s.owner_user_id=auth.uid())
  )
$$;
revoke all on function private.finance_can_configure_own_receipt_signature(uuid) from public,anon,authenticated;

create or replace function public.save_finance_receipt_signature(p_style_id smallint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); signer text; role_name text; saved public.finance_staff_receipt_signatures; prior public.finance_staff_receipt_signatures;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if sid is null or not private.finance_can_configure_own_receipt_signature(sid) then raise exception 'not_authorized'; end if;
  if p_style_id is null or p_style_id not between 1 and 10 then raise exception 'invalid_signature_style'; end if;
  select nullif(trim(u.full_name),'') into signer from public.users u where u.id=auth.uid();
  if signer is null then raise exception 'signature_name_required'; end if;
  select m.role::text into role_name from public.school_members m
    where m.school_id=sid and m.user_id=auth.uid() and m.enabled
    order by case m.role when 'school_admin' then 0 when 'director' then 1 when 'censeur' then 2 when 'accountant' then 3 when 'secretary' then 4 else 5 end limit 1;
  select * into prior from public.finance_staff_receipt_signatures where school_id=sid and user_id=auth.uid();
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

create or replace function public.finance_staff_receipt_signature_self()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); result jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if sid is null or not private.finance_can_configure_own_receipt_signature(sid) then raise exception 'not_authorized'; end if;
  select jsonb_build_object('signer_name',coalesce(sig.signer_name,u.full_name),'style_id',sig.style_id,'approved_at',sig.approved_at)
    into result
  from public.users u left join public.finance_staff_receipt_signatures sig
    on sig.school_id=sid and sig.user_id=u.id
  where u.id=auth.uid();
  return coalesce(result,'{}'::jsonb);
end $$;
revoke all on function public.save_finance_receipt_signature(smallint),public.finance_staff_receipt_signature_self() from public,anon;
grant execute on function public.save_finance_receipt_signature(smallint),public.finance_staff_receipt_signature_self() to authenticated;
