create function public.school_context() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('user_id',auth.uid(),'school_id',public.get_my_school_id(),'roles',coalesce((select jsonb_agg(m.role) from public.school_members m where m.user_id=auth.uid() and m.enabled and m.school_id=public.get_my_school_id()),'[]'::jsonb),'owner',(s.owner_user_id=auth.uid()),'school_name',s.name,'language',coalesce(u.preferred_language,s.default_language,'ht'),'schools',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select distinct sch.id,sch.name from public.school_members sm join public.schools sch on sch.id=sm.school_id where sm.user_id=auth.uid() and sm.enabled)x)) from public.users u left join public.schools s on s.id=public.get_my_school_id() where u.id=auth.uid();
$$;
create function public.select_school(p_school_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.is_school_member(p_school_id) then raise exception 'not_authorized'; end if;
 update public.users set active_school_id=p_school_id where id=auth.uid();
end $$;
create function public.manage_school_member(p_member_id uuid,p_action text,p_role public.school_role default null) returns void language plpgsql security definer set search_path='' as $$
declare m public.school_members; owner_id uuid;
begin
 select * into m from public.school_members where id=p_member_id for update;
 select owner_user_id into owner_id from public.schools where id=m.school_id;
 if not private.has_role(m.school_id,array['school_admin']) or auth.uid() is null then raise exception 'not_authorized'; end if;
 if m.user_id=owner_id or m.user_id=auth.uid() then raise exception 'owner_or_self_protected'; end if;
 if auth.uid()<>owner_id and (m.role='school_admin' or p_role='school_admin') then raise exception 'owner_required'; end if;
 if p_action='disable' then update public.school_members set enabled=false where id=m.id;
 elsif p_action='enable' then update public.school_members set enabled=true where id=m.id;
 elsif p_action='remove' then delete from public.school_members where id=m.id;
 elsif p_action='role' and p_role is not null and p_role not in ('parent','student') and m.role not in ('parent','student') then update public.school_members set role=p_role where id=m.id;
 else raise exception 'invalid_action'; end if;
end $$;
create function public.create_school_invitation(p_email text,p_full_name text,p_role public.school_role,p_student_id uuid default null,p_parent_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id(); token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''); iid uuid; target_email text:=lower(trim(p_email));
begin
 if not private.has_role(sid,array['school_admin']) then raise exception 'not_authorized'; end if;
 if p_role='school_admin' and not exists(select 1 from public.schools where id=sid and owner_user_id=auth.uid()) then raise exception 'owner_required'; end if;
 if p_role='student' then
  if not exists(select 1 from public.students s join public.enrollments e on e.student_id=s.id and e.status='active' join public.classes c on c.id=e.class_id where s.id=p_student_id and s.school_id=sid and s.active and c.student_portal_allowed) then raise exception 'student_not_eligible'; end if;
  if exists(select 1 from public.student_parents sp join public.parents p on p.id=sp.parent_id where sp.student_id=p_student_id and lower(p.email)=target_email) then raise exception 'separate_student_email_required'; end if;
 elsif p_role='parent' then
  if not exists(select 1 from public.parents p where p.id=p_parent_id and p.school_id=sid and lower(p.email)=target_email) then raise exception 'guardian_email_mismatch'; end if;
 end if;
 update public.school_invitations set status='cancelled' where school_id=sid and email=target_email and role=p_role and status='pending' and student_id is not distinct from p_student_id and parent_id is not distinct from p_parent_id;
 insert into public.school_invitations(school_id,email,full_name,role,student_id,parent_id,token_hash,invited_by)
 values(sid,target_email,trim(p_full_name),p_role,p_student_id,p_parent_id,encode(extensions.digest(token,'sha256'),'hex'),auth.uid()) returning id into iid;
 return jsonb_build_object('id',iid,'token',token);
end $$;
create function public.cancel_school_invitation(p_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 update public.school_invitations set status='cancelled' where id=p_id and status='pending' and private.has_role(school_id,array['school_admin']); if not found then raise exception 'not_authorized'; end if;
end $$;
create function public.accept_school_invitation(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.school_invitations; uid uuid:=auth.uid(); confirmed_email text; existing_user uuid;
begin
 select lower(email) into confirmed_email from auth.users where id=uid and email_confirmed_at is not null;
 if confirmed_email is null then raise exception 'confirmed_email_required'; end if;
 select * into i from public.school_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if i.id is null or i.email<>confirmed_email or i.status<>'pending' or i.expires_at<=now() then raise exception 'invitation_invalid_or_expired'; end if;
 if not exists(select 1 from public.schools s where s.id=i.school_id and s.owner_user_id=i.invited_by) and not exists(select 1 from public.school_members m where m.school_id=i.school_id and m.user_id=i.invited_by and m.role='school_admin' and m.enabled) then raise exception 'invitation_invalid_or_expired'; end if;
 if i.role='student' then
  select user_id into existing_user from public.students where id=i.student_id and active for update;
  if not found then raise exception 'student_not_eligible'; end if;
  if existing_user is not null and existing_user<>uid then raise exception 'student_already_linked'; end if;
  if exists(select 1 from public.student_parents sp join public.parents p on p.id=sp.parent_id where sp.student_id=i.student_id and p.user_id=uid) then raise exception 'separate_student_identity_required'; end if;
  if not exists(select 1 from public.enrollments e join public.classes c on c.id=e.class_id where e.student_id=i.student_id and e.status='active' and c.student_portal_allowed) then raise exception 'student_not_eligible'; end if;
 elsif i.role='parent' then
  select user_id into existing_user from public.parents where id=i.parent_id and lower(email)=confirmed_email for update;
  if not found then raise exception 'guardian_email_mismatch'; end if;
  if existing_user is not null and existing_user<>uid then raise exception 'guardian_already_linked'; end if;
  if exists(select 1 from public.student_parents sp join public.students s on s.id=sp.student_id where sp.parent_id=i.parent_id and s.user_id=uid) then raise exception 'separate_student_identity_required'; end if;
 end if;
 insert into public.users(id,full_name,email) values(uid,i.full_name,confirmed_email) on conflict(id) do nothing;
 insert into public.school_members(school_id,user_id,role,enabled) values(i.school_id,uid,i.role,true) on conflict(school_id,user_id,role) do update set enabled=true;
 if i.role='student' then update public.students set user_id=uid,portal_enabled=true where id=i.student_id;
 elsif i.role='parent' then update public.parents set user_id=uid where id=i.parent_id; end if;
 update public.users set active_school_id=i.school_id where id=uid;
 update public.school_invitations set status='accepted',accepted_by=uid,accepted_at=now(),token_hash=encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex') where id=i.id;
 return i.school_id;
end $$;

create function public.save_student_record(p_data jsonb,p_student_id uuid default null) returns uuid language plpgsql security invoker set search_path='public','pg_temp' as $$
declare sid uuid:=public.get_my_school_id(); stid uuid:=p_student_id; cid uuid:=nullif(p_data->>'class_id','')::uuid; pid uuid; yr uuid; guardian_email text:=nullif(lower(trim(p_data->>'guardian_email')),'');
begin
 if not private.has_role(sid,array['school_admin','director','secretary']) then raise exception 'not_authorized'; end if;
 if cid is null or not exists(select 1 from public.classes where id=cid and school_id=sid) then raise exception 'class_required'; end if;
 if stid is null then
  stid:=public.create_student(p_nis=>p_data->>'nis',p_student_code=>p_data->>'student_code',p_first_name=>p_data->>'first_name',p_last_name=>p_data->>'last_name',p_date_of_birth=>nullif(p_data->>'date_of_birth','')::date,p_sex=>p_data->>'sex',p_phone=>p_data->>'phone',p_email=>p_data->>'email',p_address=>p_data->>'address',p_emergency_contact_name=>p_data->>'emergency_contact_name',p_emergency_contact_phone=>p_data->>'emergency_contact_phone');
 else
  perform public.update_student(p_student_id=>stid,p_nis=>p_data->>'nis',p_student_code=>p_data->>'student_code',p_first_name=>p_data->>'first_name',p_last_name=>p_data->>'last_name',p_date_of_birth=>nullif(p_data->>'date_of_birth','')::date,p_sex=>p_data->>'sex',p_phone=>p_data->>'phone',p_email=>p_data->>'email',p_address=>p_data->>'address',p_emergency_contact_name=>p_data->>'emergency_contact_name',p_emergency_contact_phone=>p_data->>'emergency_contact_phone',p_active=>coalesce((p_data->>'active')::boolean,true));
 end if;
 update public.students set notes=nullif(p_data->>'notes','') where id=stid;
 select academic_year_id into yr from public.classes where id=cid;
 update public.enrollments set status='transferred' where student_id=stid and class_id<>cid and class_id in(select id from public.classes where academic_year_id=yr) and status='active';
 insert into public.enrollments(school_id,student_id,class_id,status) values(sid,stid,cid,'active') on conflict(student_id,class_id) do update set status='active';
 if nullif(trim(p_data->>'guardian_name'),'') is not null then
  if guardian_email is not null then select id into pid from public.parents where school_id=sid and lower(email)=guardian_email; end if;
  if pid is null then insert into public.parents(school_id,full_name,email,phone,relationship) values(sid,trim(p_data->>'guardian_name'),guardian_email,nullif(p_data->>'guardian_phone',''),'guardian') returning id into pid; end if;
  insert into public.student_parents(student_id,parent_id,is_primary) values(stid,pid,not exists(select 1 from public.student_parents where student_id=stid)) on conflict do nothing;
 end if;
 return stid;
end $$;
create function public.set_student_portal(p_student_id uuid,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$ declare sid uuid; begin
 select school_id into sid from public.students where id=p_student_id;
 if not private.has_role(sid,array['school_admin']) then raise exception 'not_authorized'; end if;
 if p_enabled and not exists(select 1 from public.enrollments e join public.classes c on c.id=e.class_id where e.student_id=p_student_id and e.status='active' and c.student_portal_allowed) then raise exception 'student_not_eligible'; end if;
 update public.students set portal_enabled=p_enabled where id=p_student_id;
end $$;
-- Remove default PUBLIC function execution. All invoker functions are additionally protected by RLS.
do $$ declare f record; begin for f in select p.oid::regprocedure as sig from pg_proc p where pronamespace='public'::regnamespace loop
 execute format('revoke all on function %s from public,anon',f.sig); execute format('grant execute on function %s to authenticated',f.sig);
end loop; end $$;
revoke all on function private.validate_tenant_links() from public,anon,authenticated;

