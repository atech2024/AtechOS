-- Enrollments can only be written by checked enrollment/progression RPCs.
revoke insert,update,delete on public.enrollments from authenticated;
revoke all on function public.apply_student_progression(uuid,jsonb) from public,anon,authenticated;

create or replace function public.save_student_record(p_data jsonb,p_student_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id(); stid uuid:=p_student_id;
cid uuid:=nullif(p_data->>'class_id','')::uuid; pid uuid;
guardian_email text:=nullif(lower(trim(p_data->>'guardian_email')),'');
begin
 if auth.uid() is null or not private.has_role(sid,array['school_admin','director','secretary']) then raise exception 'not_authorized';end if;
 if stid is null then
  if cid is null or not exists(select 1 from public.classes where id=cid and school_id=sid and enabled) then raise exception 'class_required';end if;
  stid:=public.create_student(p_nis=>p_data->>'nis',p_student_code=>p_data->>'student_code',p_first_name=>p_data->>'first_name',p_last_name=>p_data->>'last_name',p_date_of_birth=>nullif(p_data->>'date_of_birth','')::date,p_sex=>p_data->>'sex',p_phone=>p_data->>'phone',p_email=>p_data->>'email',p_address=>p_data->>'address',p_emergency_contact_name=>p_data->>'emergency_contact_name',p_emergency_contact_phone=>p_data->>'emergency_contact_phone');
  insert into public.enrollments(school_id,student_id,class_id,status) values(sid,stid,cid,'active');
 else
  perform 1 from public.students where id=stid and school_id=sid for update;
  if not found then raise exception 'student_access_denied';end if;
  if cid is not null then raise exception 'use_academic_progression';end if;
  perform public.update_student(p_student_id=>stid,p_nis=>p_data->>'nis',p_student_code=>p_data->>'student_code',p_first_name=>p_data->>'first_name',p_last_name=>p_data->>'last_name',p_date_of_birth=>nullif(p_data->>'date_of_birth','')::date,p_sex=>p_data->>'sex',p_phone=>p_data->>'phone',p_email=>p_data->>'email',p_address=>p_data->>'address',p_emergency_contact_name=>p_data->>'emergency_contact_name',p_emergency_contact_phone=>p_data->>'emergency_contact_phone',p_active=>coalesce((p_data->>'active')::boolean,true));
 end if;
 update public.students set notes=nullif(p_data->>'notes',''),place_of_birth=case when p_data ? 'place_of_birth' then nullif(p_data->>'place_of_birth','') else place_of_birth end where id=stid and school_id=sid;
 if nullif(trim(p_data->>'guardian_name'),'') is not null then
  if guardian_email is not null then select id into pid from public.parents where school_id=sid and lower(email)=guardian_email;end if;
  if pid is null then insert into public.parents(school_id,full_name,email,phone,relationship) values(sid,trim(p_data->>'guardian_name'),guardian_email,nullif(p_data->>'guardian_phone',''),'guardian') returning id into pid;end if;
  insert into public.student_parents(student_id,parent_id,is_primary) values(stid,pid,not exists(select 1 from public.student_parents where student_id=stid)) on conflict do nothing;
 end if;
 return stid;
end $$;
revoke all on function public.save_student_record(jsonb,uuid) from public,anon;
grant execute on function public.save_student_record(jsonb,uuid) to authenticated;
