-- Record the Direction member who accompanies a student during a medical or
-- exceptional departure. Keep the identity snapshot in the case and immutable audit.
alter table public.student_release_cases
 add column escort_user_id uuid references public.users(id),
 add column escort_name text,
 add column escort_role text,
 add constraint student_release_cases_escort_snapshot check (
  (escort_user_id is null and escort_name is null and escort_role is null)
  or (escort_user_id is not null and escort_name is not null and escort_role is not null
      and length(trim(escort_name)) between 1 and 200 and escort_role in ('school_admin','director','censeur','secretary'))
 );

create or replace function public.student_followup_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();result jsonb;
begin
 if not private.student_followup_authority(sid) then raise exception 'not_authorized';end if;
 select jsonb_build_object(
  'students',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.first_name||' '||s.last_name,'class',cl.name) order by cl.name,s.last_name,s.first_name)
   from public.students s left join lateral (select c.name from public.enrollments e join public.classes c on c.id=e.class_id join public.academic_years y on y.id=c.academic_year_id where e.student_id=s.id and e.status='active' and c.school_id=s.school_id and y.is_current order by c.name limit 1) cl on true
   where s.school_id=sid and s.active and s.school_status='active'),'[]'::jsonb),
  'direction_members',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'full_name',coalesce(nullif(u.full_name,''),'Staff'),'role',m.role::text) order by m.role::text,u.full_name)
   from public.school_members m join public.users u on u.id=m.user_id
   where m.school_id=sid and m.enabled and m.role::text in ('school_admin','director','censeur','secretary')),'[]'::jsonb),
  'sanction_types',coalesce((select jsonb_agg(to_jsonb(t) - 'school_id' - 'created_by' - 'updated_by' order by t.name) from public.student_sanction_types t where t.school_id=sid),'[]'::jsonb),
  'sanctions',coalesce((select jsonb_agg(to_jsonb(q) - 'school_id' - 'created_by' order by q.incident_at desc) from (select x.*,s.first_name||' '||s.last_name as student from public.student_sanctions x join public.students s on s.id=x.student_id where x.school_id=sid order by x.incident_at desc limit 300) q),'[]'::jsonb),
  'contacts',coalesce((select jsonb_agg(to_jsonb(c) - 'school_id' - 'created_by' - 'updated_by' order by s.last_name,s.first_name,c.full_name) from public.student_release_contacts c join public.students s on s.id=c.student_id where c.school_id=sid),'[]'::jsonb),
  'releases',coalesce((select jsonb_agg(to_jsonb(q) - 'school_id' - 'escort_user_id' order by q.requested_at desc) from (select x.*,s.first_name||' '||s.last_name as student from public.student_release_cases x join public.students s on s.id=x.student_id where x.school_id=sid order by x.requested_at desc limit 300) q),'[]'::jsonb)
 ) into result;
 return result;
end $$;

create function private.request_student_release_with_escort(p_student uuid,p_kind text,p_contact uuid,p_reason text,p_escort uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid;rid uuid;person public.student_release_contacts;student_name text;escort_name text;escort_role text;
begin
 select school_id,first_name||' '||last_name into sid,student_name from public.students where id=p_student and active and school_status='active';
 if sid is null or not private.student_followup_authority(sid) then raise exception 'not_authorized';end if;
 if p_kind is null or p_kind not in ('medical','exceptional') or length(trim(coalesce(p_reason,''))) not between 3 and 2000 then raise exception 'invalid_release';end if;
 select * into person from public.student_release_contacts where id=p_contact and student_id=p_student and school_id=sid and active;
 if person.id is null then raise exception 'release_contact_not_authorized';end if;
 if p_escort is not null then
  select coalesce(nullif(u.full_name,''),'Staff'),m.role::text into escort_name,escort_role
   from public.school_members m join public.users u on u.id=m.user_id
   where m.school_id=sid and m.user_id=p_escort and m.enabled
    and m.role::text in ('school_admin','director','censeur','secretary');
  if escort_name is null then raise exception 'release_escort_not_authorized';end if;
 end if;
 insert into public.student_release_cases(school_id,student_id,kind,reason,contact_id,contact_name,contact_relationship,escort_user_id,escort_name,escort_role,requested_by,requested_role)
 values(sid,p_student,p_kind,trim(p_reason),person.id,person.full_name,person.relationship,p_escort,escort_name,escort_role,auth.uid(),private.student_followup_actor_role(sid)) returning id into rid;
 perform private.student_followup_event(sid,p_student,'release_case',rid,'requested',jsonb_build_object('kind',p_kind,'contact_id',person.id,'escort_user_id',p_escort,'escort_name',escort_name,'escort_role',escort_role));
 insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
 select sid,m.user_id,'student_release','Student release requires review',student_name||' · '||case p_kind when 'medical' then 'Medical departure' else 'Exceptional departure' end,'high','/dashboard/sanctions','student-release-request:'||rid::text||':'||m.user_id::text
 from public.school_members m where m.school_id=sid and m.enabled and m.role::text in ('school_admin','director','secretary') and m.user_id<>auth.uid() on conflict do nothing;
 return rid;
end $$;

-- Keep the original four-argument call valid for old clients during deployment.
create or replace function public.request_student_release(p_student uuid,p_kind text,p_contact uuid,p_reason text)
returns uuid language plpgsql security definer set search_path=''
as $$
begin
 return private.request_student_release_with_escort(p_student,p_kind,p_contact,p_reason,null);
end $$;

create function public.request_student_release_with_escort(p_student uuid,p_kind text,p_contact uuid,p_reason text,p_escort uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
begin
 return private.request_student_release_with_escort(p_student,p_kind,p_contact,p_reason,p_escort);
end $$;

revoke all on function private.request_student_release_with_escort(uuid,text,uuid,text,uuid),public.request_student_release(uuid,text,uuid,text),public.request_student_release_with_escort(uuid,text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.request_student_release(uuid,text,uuid,text),public.request_student_release_with_escort(uuid,text,uuid,text,uuid) to authenticated;
