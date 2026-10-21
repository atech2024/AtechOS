-- Additive upgrade of the existing AtechOS schema. No student or school is deleted.
alter table public.schools add column owner_user_id uuid references public.users(id);
alter table public.schools add column default_language text not null default 'ht' check(default_language in ('ht','fr','en'));
alter table public.users add column preferred_language text check(preferred_language in ('ht','fr','en'));
alter table public.users add column active_school_id uuid references public.schools(id);
alter table public.school_members add column enabled boolean not null default true;
-- The audit found one administrator per existing school. Ambiguous schools are not guessed.
update public.schools s set owner_user_id=(select min(sm.user_id::text)::uuid from public.school_members sm where sm.school_id=s.id and role='school_admin')
where (select count(*) from public.school_members sm where sm.school_id=s.id and role='school_admin')=1;
alter table public.students add column notes text;
alter table public.students add column portal_enabled boolean not null default false;
alter table public.parents add column full_name text;
alter table public.parents add column email text;
alter table public.parents add column phone text;
alter table public.parents alter column user_id drop not null;
update public.parents p set full_name=u.full_name,email=lower(u.email),phone=u.phone from public.users u where u.id=p.user_id;
create unique index parents_school_email_unique on public.parents(school_id,lower(email)) where email is not null;
alter table public.student_parents add column relationship text not null default 'guardian';
alter table public.subjects add column active boolean not null default true;
alter table public.subjects add column catalog_code text;
alter table public.grades add column published boolean not null default false;
alter table public.classes add column section text;
alter table public.classes add column student_portal_allowed boolean not null default false;
update public.classes c set student_portal_allowed=true from public.grade_levels g where c.grade_level_id=g.id and (g.code in ('AF7','AF8','AF9','NS1','NS2','NS3','NS4'));
create table public.school_invitations (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 email text not null check(email=lower(trim(email)) and position('@' in email)>1), full_name text not null,
 role public.school_role not null, student_id uuid references public.students(id), parent_id uuid references public.parents(id),
 token_hash text not null unique, status text not null default 'pending' check(status in ('pending','accepted','cancelled')),
 expires_at timestamptz not null default now()+interval '7 days', created_at timestamptz not null default now(),
 invited_by uuid not null references public.users(id), accepted_by uuid references public.users(id), accepted_at timestamptz,
 check((role='student' and student_id is not null and parent_id is null) or (role='parent' and parent_id is not null and student_id is null) or (role not in ('student','parent') and student_id is null and parent_id is null))
);
create index invitations_school on public.school_invitations(school_id,status);
alter table public.school_invitations enable row level security;

create or replace function private.has_role(sid uuid, roles text[]) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (exists(select 1 from public.schools where id=sid and owner_user_id=auth.uid()) or exists(select 1 from public.school_members where school_id=sid and user_id=auth.uid() and enabled and role::text=any(roles)));
$$;
create or replace function private.is_school_member(target_school_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_role(target_school_id,array['school_admin','director','secretary','teacher','accountant','surveillant','parent','student']);
$$;
create or replace function private.is_school_admin_or_director(target_school_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_role(target_school_id,array['school_admin','director']);
$$;
create or replace function public.is_school_member(target_school_id uuid) returns boolean language sql stable security invoker set search_path='' as $$ select private.is_school_member(target_school_id); $$;
create or replace function public.get_my_school_id() returns uuid language sql stable security definer set search_path='' as $$
 select sm.school_id from public.school_members sm left join public.users u on u.id=auth.uid()
 where sm.user_id=auth.uid() and sm.enabled order by (sm.school_id=u.active_school_id) desc nulls last,sm.created_at,sm.school_id limit 1;
$$;
create or replace function private.teaches(cid uuid, subid uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.class_subjects cs join public.school_members m on m.school_id=cs.school_id and m.user_id=auth.uid() and m.role='teacher' and m.enabled where cs.class_id=cid and cs.teacher_id=auth.uid() and (subid is null or cs.subject_id=subid));
$$;
create or replace function private.family_student(stid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.students s where s.id=stid and s.active and ((s.user_id=auth.uid() and s.portal_enabled and private.has_role(s.school_id,array['student'])) or exists(select 1 from public.student_parents sp join public.parents p on p.id=sp.parent_id where sp.student_id=s.id and p.school_id=s.school_id and p.user_id=auth.uid() and private.has_role(s.school_id,array['parent']))));
$$;
create or replace function private.read_student(stid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.students s where s.id=stid and (private.has_role(s.school_id,array['school_admin','director','secretary','surveillant']) or private.family_student(stid) or exists(select 1 from public.enrollments e where e.student_id=stid and e.status='active' and private.teaches(e.class_id))));
$$;
create or replace function private.read_class(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.classes c where c.id=cid and (private.has_role(c.school_id,array['school_admin','director','secretary','surveillant']) or private.teaches(cid) or exists(select 1 from public.enrollments e where e.class_id=cid and e.status='active' and private.family_student(e.student_id))));
$$;
create or replace function private.write_academic(sid uuid,cid uuid,subid uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.classes c where c.id=cid and c.school_id=sid) and (private.has_role(sid,array['school_admin','director']) or private.teaches(cid,subid));
$$;
-- RLS helpers reside outside the exposed API schema.
revoke all on all functions in schema private from public,anon;
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

-- Replace the old permissive OR policies; do not layer stricter policies on top of them.
do $$ declare p record; begin
 for p in select schemaname,tablename,policyname from pg_policies where schemaname='public' loop
 execute format('drop policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);
 end loop;
end $$;
create policy schools_read on public.schools for select to authenticated using(private.is_school_member(id));
create policy schools_update on public.schools for update to authenticated using(private.has_role(id,array['school_admin'])) with check(private.has_role(id,array['school_admin']));
create policy members_read on public.school_members for select to authenticated using(user_id=auth.uid() or private.has_role(school_id,array['school_admin','director','secretary']));
create policy users_read on public.users for select to authenticated using(id=auth.uid() or exists(select 1 from public.school_members m where m.user_id=users.id and private.has_role(m.school_id,array['school_admin','director','secretary'])));
create policy users_update on public.users for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy students_read on public.students for select to authenticated using(private.read_student(id));
create policy students_insert on public.students for insert to authenticated with check(private.has_role(school_id,array['school_admin','director','secretary']));
create policy students_update on public.students for update to authenticated using(private.has_role(school_id,array['school_admin','director','secretary'])) with check(private.has_role(school_id,array['school_admin','director','secretary']));
create policy parents_read on public.parents for select to authenticated using((user_id=auth.uid() and private.has_role(school_id,array['parent'])) or private.has_role(school_id,array['school_admin','director','secretary']));
create policy parents_write on public.parents for all to authenticated using(private.has_role(school_id,array['school_admin','director','secretary'])) with check(private.has_role(school_id,array['school_admin','director','secretary']));
create policy family_links_read on public.student_parents for select to authenticated using(exists(select 1 from public.parents p where p.id=parent_id));
create policy family_links_write on public.student_parents for all to authenticated using(exists(select 1 from public.students s where s.id=student_id and private.has_role(s.school_id,array['school_admin','director','secretary']))) with check(exists(select 1 from public.students s join public.parents p on p.id=parent_id and p.school_id=s.school_id where s.id=student_id and private.has_role(s.school_id,array['school_admin','director','secretary'])));
create policy classes_read on public.classes for select to authenticated using(private.read_class(id));
create policy classes_write on public.classes for all to authenticated using(private.has_role(school_id,array['school_admin','director','secretary'])) with check(private.has_role(school_id,array['school_admin','director','secretary']));
create policy subjects_read on public.subjects for select to authenticated using(private.has_role(school_id,array['school_admin','director','secretary']) or exists(select 1 from public.class_subjects cs where cs.subject_id=subjects.id and private.read_class(cs.class_id)));
create policy subjects_write on public.subjects for all to authenticated using(private.has_role(school_id,array['school_admin','director'])) with check(private.has_role(school_id,array['school_admin','director']));
create policy teaching_read on public.class_subjects for select to authenticated using(private.read_class(class_id));
create policy teaching_write on public.class_subjects for all to authenticated using(private.has_role(school_id,array['school_admin','director'])) with check(private.has_role(school_id,array['school_admin','director']));
create policy enrollment_read on public.enrollments for select to authenticated using(private.read_student(student_id) and private.read_class(class_id));
create policy enrollment_write on public.enrollments for all to authenticated using(private.has_role(school_id,array['school_admin','director','secretary'])) with check(private.has_role(school_id,array['school_admin','director','secretary']));
create policy attendance_read on public.attendance for select to authenticated using(private.read_student(student_id));
create policy attendance_write on public.attendance for all to authenticated using(private.has_role(school_id,array['school_admin','director','secretary','surveillant']) or private.teaches(class_id)) with check(private.has_role(school_id,array['school_admin','director','secretary','surveillant']) or private.teaches(class_id));
create policy grades_read on public.grades for select to authenticated using(private.write_academic(school_id,class_id,subject_id) or (published and private.family_student(student_id)));
create policy grades_write on public.grades for all to authenticated using(private.write_academic(school_id,class_id,subject_id)) with check(private.write_academic(school_id,class_id,subject_id));
create policy assignments_read on public.assignments for select to authenticated using(private.read_class(class_id));
create policy assignments_write on public.assignments for all to authenticated using(private.write_academic(school_id,class_id,subject_id)) with check(private.write_academic(school_id,class_id,subject_id));
create policy badges_read on public.student_badges for select to authenticated using(private.has_role(school_id,array['school_admin','director','secretary','surveillant']) or exists(select 1 from public.enrollments e where e.student_id=student_badges.student_id and e.status='active' and private.teaches(e.class_id)));
create policy badges_write on public.student_badges for all to authenticated using(private.has_role(school_id,array['school_admin','director','secretary'])) with check(private.has_role(school_id,array['school_admin','director','secretary']));
create policy grade_catalog on public.grade_levels for select to authenticated using(is_active);
do $$ declare t text; begin
 foreach t in array array['academic_years','grading_periods','school_grading_settings'] loop
 execute format('create policy config_read on public.%I for select to authenticated using(private.is_school_member(school_id))',t);
 execute format('create policy config_write on public.%I for all to authenticated using(private.has_role(school_id,array[''school_admin'',''director''])) with check(private.has_role(school_id,array[''school_admin'',''director'']))',t);
 end loop;
 foreach t in array array['documents','discipline_records','meetings'] loop
 execute format('create policy restricted_read on public.%I for select to authenticated using(private.has_role(school_id,array[''school_admin'',''director'',''secretary'']))',t);
 execute format('create policy restricted_write on public.%I for all to authenticated using(private.has_role(school_id,array[''school_admin'',''director'',''secretary''])) with check(private.has_role(school_id,array[''school_admin'',''director'',''secretary'']))',t);
 end loop;
end $$;
create policy invitations_read on public.school_invitations for select to authenticated using(private.has_role(school_id,array['school_admin']));

-- Keep tenant identifiers and cross-table references consistent even through RPCs.
create function private.validate_tenant_links() returns trigger language plpgsql security definer set search_path='' as $$
declare j jsonb:=to_jsonb(new); sid uuid; linked uuid; col text; target text; foreign_school uuid;
begin
 sid:=(j->>'school_id')::uuid;
 if tg_op='UPDATE' and (to_jsonb(old)->>'school_id') is distinct from j->>'school_id' then raise exception 'school_immutable'; end if;
 for col,target in select * from (values ('student_id','students'),('class_id','classes'),('subject_id','subjects'),('academic_year_id','academic_years'),('grading_period_id','grading_periods'),('parent_id','parents')) as refs(c,t) loop
  linked:=nullif(j->>col,'')::uuid;
  if linked is not null then
   execute format('select school_id from public.%I where id=$1',target) into foreign_school using linked;
   if foreign_school is null then raise exception 'invalid_reference'; end if;
   if sid is null then sid:=foreign_school; elsif sid<>foreign_school then raise exception 'cross_school_reference'; end if;
  end if;
 end loop;
 if j->>'teacher_id' is not null and not exists(select 1 from public.school_members where school_id=sid and user_id=(j->>'teacher_id')::uuid and enabled and role in ('teacher','school_admin','director')) and not exists(select 1 from public.schools where id=sid and owner_user_id=(j->>'teacher_id')::uuid) then raise exception 'teacher_access_denied'; end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['students','parents','classes','class_subjects','enrollments','student_parents','grades','attendance','assignments','student_badges','documents','meetings','school_invitations'] loop
 execute format('create trigger validate_tenant_links before insert or update on public.%I for each row execute function private.validate_tenant_links()',t);
 end loop;
end $$;
-- Column grants prevent changing ownership, identities, or enrollment keys through direct API writes.
revoke all on public.school_members,public.school_invitations from anon,authenticated;
grant select on public.school_members to authenticated;
grant select(id,school_id,email,full_name,role,student_id,parent_id,status,expires_at,created_at,invited_by,accepted_by,accepted_at) on public.school_invitations to authenticated;
revoke update on public.schools from authenticated;
grant update(name,email,phone,address,logo_url,default_language) on public.schools to authenticated;
revoke update on public.users from authenticated;
grant update(full_name,phone,avatar_url,preferred_language) on public.users to authenticated;
revoke all on public.students from authenticated;
grant select on public.students to authenticated;
grant insert(school_id,nis,student_code,atechos_id,first_name,last_name,date_of_birth,sex,phone,email,address,photo_url,emergency_contact_name,emergency_contact_phone,active,notes) on public.students to authenticated;
grant update(nis,student_code,first_name,last_name,date_of_birth,sex,phone,email,address,photo_url,emergency_contact_name,emergency_contact_phone,active,notes,updated_at) on public.students to authenticated;
grant select,insert,update,delete on public.parents,public.student_parents,public.enrollments,public.class_subjects,public.subjects,public.classes,public.academic_years,public.grading_periods,public.school_grading_settings,public.student_badges,public.attendance,public.grades,public.assignments to authenticated;
-- Parent identity can only be bound by the verified invitation acceptance transaction.
revoke update on public.parents from authenticated;
revoke insert on public.parents from authenticated;
grant insert(school_id,full_name,email,phone,relationship) on public.parents to authenticated;
grant update(full_name,email,phone,relationship) on public.parents to authenticated;

-- Private storage follows the same student/class scopes as the records.
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='storage' and tablename='objects' and (qual like '%student-photos%' or with_check like '%student-photos%' or qual like '%assignment-files%' or with_check like '%assignment-files%') loop execute format('drop policy %I on storage.objects',p.policyname); end loop; end $$;
create policy photos_read on storage.objects for select to authenticated using(bucket_id='student-photos' and exists(select 1 from public.students s where s.photo_url=objects.name and private.read_student(s.id)));
create policy photos_insert on storage.objects for insert to authenticated with check(bucket_id='student-photos' and private.has_role(((storage.foldername(name))[1])::uuid,array['school_admin','director','secretary']));
create policy photos_delete on storage.objects for delete to authenticated using(bucket_id='student-photos' and private.has_role(((storage.foldername(name))[1])::uuid,array['school_admin','director','secretary']));
create policy assignment_files_read on storage.objects for select to authenticated using(bucket_id='assignment-files' and exists(select 1 from public.assignments a where a.attachment_url=objects.name and private.read_class(a.class_id)));
create policy assignment_files_insert on storage.objects for insert to authenticated with check(bucket_id='assignment-files' and exists(select 1 from public.assignments a where a.id::text=(storage.foldername(name))[2] and a.school_id::text=(storage.foldername(name))[1] and private.write_academic(a.school_id,a.class_id,a.subject_id)));

