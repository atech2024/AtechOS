-- Student conduct and non-preschool medical/exceptional departures.
-- The workflow is separate from attendance GUARD and Kindergarten pickup.
create table public.student_sanction_types (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 name text not null check (length(trim(name)) between 2 and 120),
 active boolean not null default true,
 created_by uuid not null references public.users(id),
 created_at timestamptz not null default now(),
 updated_by uuid not null references public.users(id),
 updated_at timestamptz not null default now()
);
create unique index student_sanction_types_school_name
 on public.student_sanction_types(school_id,lower(trim(name)));

create table public.student_sanctions (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),
 sanction_type_id uuid not null references public.student_sanction_types(id),
 incident_at timestamptz not null default now(),
 reason text not null check (length(trim(reason)) between 3 and 2000),
 status text not null default 'active' check (status in ('active','resolved')),
 created_by uuid not null references public.users(id),
 created_role text not null,
 created_at timestamptz not null default now(),
 resolved_by uuid references public.users(id),
 resolved_at timestamptz,
 resolution text,
 check ((status='active' and resolved_by is null and resolved_at is null and resolution is null)
     or (status='resolved' and resolved_by is not null and resolved_at is not null and length(trim(coalesce(resolution,'')))>=3)
 )
);
create index student_sanctions_school_recent on public.student_sanctions(school_id,incident_at desc);
create index student_sanctions_student_recent on public.student_sanctions(student_id,incident_at desc);

create table public.student_release_contacts (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),
 full_name text not null check (length(trim(full_name)) between 2 and 160),
 relationship text not null check (length(trim(relationship)) between 2 and 80),
 phone text check (phone is null or length(trim(phone)) between 5 and 40),
 active boolean not null default true,
 created_by uuid not null references public.users(id),
 created_at timestamptz not null default now(),
 updated_by uuid not null references public.users(id),
 updated_at timestamptz not null default now(),
 deactivated_by uuid references public.users(id),
 deactivated_at timestamptz,
 check ((active and deactivated_at is null) or (not active and deactivated_at is not null))
);
create unique index student_release_contacts_active_name
 on public.student_release_contacts(student_id,lower(trim(full_name))) where active;
create unique index student_release_contacts_identity_scope on public.student_release_contacts(id,student_id,school_id);
create index student_release_contacts_school on public.student_release_contacts(school_id,student_id,active);

create table public.student_release_cases (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),
 kind text not null check (kind in ('medical','exceptional')),
 reason text not null check (length(trim(reason)) between 3 and 2000),
 contact_id uuid not null,
 contact_name text not null,
 contact_relationship text not null,
 status text not null default 'pending' check (status in ('pending','approved','rejected','released','returned')),
 requested_by uuid not null references public.users(id),
 requested_role text not null,
 requested_at timestamptz not null default now(),
 reviewed_by uuid references public.users(id),
 reviewed_role text,
 reviewed_at timestamptz,
 decision_reason text,
 released_by uuid references public.users(id),
 released_role text,
 released_at timestamptz,
 expected_return_at timestamptz,
 returned_by uuid references public.users(id),
 returned_role text,
 returned_at timestamptz,
 foreign key(contact_id,student_id,school_id) references public.student_release_contacts(id,student_id,school_id),
 check ((status='pending' and reviewed_by is null and reviewed_at is null and released_at is null and returned_at is null)
     or (status='approved' and reviewed_by is not null and reviewed_at is not null and released_at is null and returned_at is null)
     or (status='rejected' and reviewed_by is not null and reviewed_at is not null and length(trim(coalesce(decision_reason,'')))>=3 and released_at is null and returned_at is null)
     or (status='released' and reviewed_by is not null and reviewed_at is not null and released_by is not null and released_at is not null and expected_return_at is not null and returned_at is null)
     or (status='returned' and reviewed_by is not null and reviewed_at is not null and released_by is not null and released_at is not null and expected_return_at is not null and returned_by is not null and returned_at is not null)
 )
);
create index student_release_cases_school_recent on public.student_release_cases(school_id,requested_at desc);
create index student_release_cases_student_recent on public.student_release_cases(student_id,requested_at desc);

-- Domain-specific immutable audit events use the existing school membership,
-- actor identity/role and notifications conventions.
create table public.student_followup_events (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 student_id uuid references public.students(id),
 entity text not null check (entity in ('sanction_type','sanction','release_contact','release_case')),
 entity_id uuid not null,
 action text not null,
 actor_id uuid not null references public.users(id),
 actor_name text not null,
 actor_role text not null,
 detail jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 check ((entity='sanction_type' and student_id is null) or (entity<>'sanction_type' and student_id is not null))
);
create index student_followup_events_school_recent on public.student_followup_events(school_id,created_at desc);
create index student_followup_events_entity on public.student_followup_events(entity,entity_id,created_at desc);

alter table public.student_sanction_types enable row level security;
alter table public.student_sanctions enable row level security;
alter table public.student_release_contacts enable row level security;
alter table public.student_release_cases enable row level security;
alter table public.student_followup_events enable row level security;
revoke all on public.student_sanction_types,public.student_sanctions,public.student_release_contacts,
 public.student_release_cases,public.student_followup_events from public,anon,authenticated;

create function private.student_followup_authority(p_school uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select auth.uid() is not null and private.has_role(p_school,array['school_admin','director','secretary']) $$;

create function private.student_followup_actor_role(p_school uuid)
returns text language sql stable security definer set search_path=''
as $$
 select (select m.role::text from public.school_members m where m.school_id=p_school and m.user_id=auth.uid() and m.enabled and m.role::text in ('school_admin','director','secretary') order by case m.role::text when 'school_admin' then 0 when 'director' then 1 else 2 end limit 1)
$$;

create function private.student_followup_event(p_school uuid,p_student uuid,p_entity text,p_entity_id uuid,p_action text,p_detail jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=''
as $$
begin
 insert into public.student_followup_events(school_id,student_id,entity,entity_id,action,actor_id,actor_name,actor_role,detail)
 select p_school,p_student,p_entity,p_entity_id,p_action,auth.uid(),coalesce(nullif(u.full_name,''),'Staff'),private.student_followup_actor_role(p_school),coalesce(p_detail,'{}'::jsonb)
 from public.users u where u.id=auth.uid();
 if not found then raise exception 'not_authorized';end if;
end $$;

create function private.prevent_student_followup_event_change()
returns trigger language plpgsql set search_path=''
as $$ begin raise exception 'student_followup_event_immutable';end $$;
create trigger student_followup_events_immutable before update or delete on public.student_followup_events
 for each row execute function private.prevent_student_followup_event_change();

create function public.student_followup_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();result jsonb;
begin
 if not private.student_followup_authority(sid) then raise exception 'not_authorized';end if;
 select jsonb_build_object(
  'students',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.first_name||' '||s.last_name,'class',cl.name) order by cl.name,s.last_name,s.first_name)
   from public.students s left join lateral (select c.name from public.enrollments e join public.classes c on c.id=e.class_id join public.academic_years y on y.id=c.academic_year_id where e.student_id=s.id and e.status='active' and c.school_id=s.school_id and y.is_current order by c.name limit 1) cl on true
   where s.school_id=sid and s.active and s.school_status='active'),'[]'::jsonb),
  'sanction_types',coalesce((select jsonb_agg(to_jsonb(t) - 'school_id' - 'created_by' - 'updated_by' order by t.name) from public.student_sanction_types t where t.school_id=sid),'[]'::jsonb),
  'sanctions',coalesce((select jsonb_agg(to_jsonb(q) - 'school_id' - 'created_by' order by q.incident_at desc) from (select x.*,s.first_name||' '||s.last_name as student from public.student_sanctions x join public.students s on s.id=x.student_id where x.school_id=sid order by x.incident_at desc limit 300) q),'[]'::jsonb),
  'contacts',coalesce((select jsonb_agg(to_jsonb(c) - 'school_id' - 'created_by' - 'updated_by' order by s.last_name,s.first_name,c.full_name) from public.student_release_contacts c join public.students s on s.id=c.student_id where c.school_id=sid),'[]'::jsonb),
  'releases',coalesce((select jsonb_agg(to_jsonb(q) - 'school_id' order by q.requested_at desc) from (select x.*,s.first_name||' '||s.last_name as student from public.student_release_cases x join public.students s on s.id=x.student_id where x.school_id=sid order by x.requested_at desc limit 300) q),'[]'::jsonb)
 ) into result;
 return result;
end $$;

create function public.save_student_sanction_type(p_type uuid,p_name text,p_active boolean default true)
returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();rid uuid;old_name text;begin
 if not private.student_followup_authority(sid) then raise exception 'not_authorized';end if;
 if length(trim(coalesce(p_name,''))) not between 2 and 120 then raise exception 'invalid_sanction_type';end if;
 if p_type is null then
  insert into public.student_sanction_types(school_id,name,active,created_by,updated_by) values(sid,trim(p_name),coalesce(p_active,true),auth.uid(),auth.uid()) returning id into rid;
  perform private.student_followup_event(sid,null,'sanction_type',rid,'created',jsonb_build_object('name',trim(p_name),'active',coalesce(p_active,true)));
 else
  select name into old_name from public.student_sanction_types where id=p_type and school_id=sid for update;
  if not found then raise exception 'sanction_type_not_found';end if;
  update public.student_sanction_types set name=trim(p_name),active=coalesce(p_active,false),updated_by=auth.uid(),updated_at=now() where id=p_type returning id into rid;
  perform private.student_followup_event(sid,null,'sanction_type',rid,'updated',jsonb_build_object('old_name',old_name,'name',trim(p_name),'active',coalesce(p_active,false)));
 end if;
 return rid;
exception when unique_violation then raise exception 'sanction_type_exists';
end $$;

create function public.create_student_sanction(p_student uuid,p_type uuid,p_reason text,p_incident_at timestamptz default now())
returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid;rid uuid;begin
 select school_id into sid from public.students where id=p_student and active and school_status='active';
 if sid is null or not private.student_followup_authority(sid) then raise exception 'not_authorized';end if;
 if length(trim(coalesce(p_reason,''))) not between 3 and 2000 or p_incident_at is null or p_incident_at>now() then raise exception 'invalid_sanction';end if;
 if not exists(select 1 from public.student_sanction_types where id=p_type and school_id=sid and active) then raise exception 'sanction_type_not_found';end if;
 insert into public.student_sanctions(school_id,student_id,sanction_type_id,incident_at,reason,created_by,created_role)
 values(sid,p_student,p_type,p_incident_at,trim(p_reason),auth.uid(),private.student_followup_actor_role(sid)) returning id into rid;
 perform private.student_followup_event(sid,p_student,'sanction',rid,'created',jsonb_build_object('type_id',p_type,'incident_at',p_incident_at));
 return rid;
end $$;

create function public.resolve_student_sanction(p_sanction uuid,p_resolution text)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid;student uuid;begin
 select school_id,student_id into sid,student from public.student_sanctions where id=p_sanction for update;
 if sid is null or not private.student_followup_authority(sid) then raise exception 'not_authorized';end if;
 if length(trim(coalesce(p_resolution,''))) not between 3 and 2000 then raise exception 'resolution_required';end if;
 update public.student_sanctions set status='resolved',resolved_by=auth.uid(),resolved_at=now(),resolution=trim(p_resolution) where id=p_sanction and status='active';
 if not found then raise exception 'sanction_not_active';end if;
 perform private.student_followup_event(sid,student,'sanction',p_sanction,'resolved',jsonb_build_object('resolution',trim(p_resolution)));
end $$;

create function public.save_student_release_contact(p_student uuid,p_contact uuid,p_name text,p_relationship text,p_phone text,p_active boolean default true)
returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid;rid uuid;begin
 select school_id into sid from public.students where id=p_student and active and school_status='active';
 if sid is null or not private.student_followup_authority(sid) then raise exception 'not_authorized';end if;
 if p_contact is null then
  if length(trim(coalesce(p_name,''))) not between 2 and 160 or length(trim(coalesce(p_relationship,''))) not between 2 and 80 or (p_phone is not null and length(trim(p_phone)) not between 5 and 40) then raise exception 'invalid_release_contact';end if;
  insert into public.student_release_contacts(school_id,student_id,full_name,relationship,phone,created_by,updated_by)
  values(sid,p_student,trim(p_name),trim(p_relationship),nullif(trim(p_phone),''),auth.uid(),auth.uid()) returning id into rid;
  perform private.student_followup_event(sid,p_student,'release_contact',rid,'created',jsonb_build_object('name',trim(p_name),'relationship',trim(p_relationship)));
 else
  perform 1 from public.student_release_contacts where id=p_contact and student_id=p_student and school_id=sid for update;
  if not found then raise exception 'release_contact_not_found';end if;
  if coalesce(p_active,false) then
   if length(trim(coalesce(p_name,''))) not between 2 and 160 or length(trim(coalesce(p_relationship,''))) not between 2 and 80 or (p_phone is not null and length(trim(p_phone)) not between 5 and 40) then raise exception 'invalid_release_contact';end if;
   update public.student_release_contacts set full_name=trim(p_name),relationship=trim(p_relationship),phone=nullif(trim(p_phone),''),active=true,updated_by=auth.uid(),updated_at=now(),deactivated_by=null,deactivated_at=null where id=p_contact returning id into rid;
   perform private.student_followup_event(sid,p_student,'release_contact',rid,'updated',jsonb_build_object('active',true));
  else
   update public.student_release_contacts set active=false,updated_by=auth.uid(),updated_at=now(),deactivated_by=auth.uid(),deactivated_at=now() where id=p_contact and active returning id into rid;
   if rid is null then raise exception 'release_contact_inactive';end if;
   perform private.student_followup_event(sid,p_student,'release_contact',rid,'deactivated','{}'::jsonb);
  end if;
 end if;
 return rid;
exception when unique_violation then raise exception 'release_contact_exists';
end $$;

create function public.request_student_release(p_student uuid,p_kind text,p_contact uuid,p_reason text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid;rid uuid;person public.student_release_contacts;student_name text;begin
 select school_id,first_name||' '||last_name into sid,student_name from public.students where id=p_student and active and school_status='active';
 if sid is null or not private.student_followup_authority(sid) then raise exception 'not_authorized';end if;
 if p_kind is null or p_kind not in ('medical','exceptional') or length(trim(coalesce(p_reason,''))) not between 3 and 2000 then raise exception 'invalid_release';end if;
 select * into person from public.student_release_contacts where id=p_contact and student_id=p_student and school_id=sid and active;
 if person.id is null then raise exception 'release_contact_not_authorized';end if;
 insert into public.student_release_cases(school_id,student_id,kind,reason,contact_id,contact_name,contact_relationship,requested_by,requested_role)
 values(sid,p_student,p_kind,trim(p_reason),person.id,person.full_name,person.relationship,auth.uid(),private.student_followup_actor_role(sid)) returning id into rid;
 perform private.student_followup_event(sid,p_student,'release_case',rid,'requested',jsonb_build_object('kind',p_kind,'contact_id',person.id));
 insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
 select sid,m.user_id,'student_release','Student release requires review',student_name||' · '||case p_kind when 'medical' then 'Medical departure' else 'Exceptional departure' end,'high','/dashboard/sanctions','student-release-request:'||rid::text||':'||m.user_id::text
 from public.school_members m where m.school_id=sid and m.enabled and m.role::text in ('school_admin','director','secretary') and m.user_id<>auth.uid() on conflict do nothing;
 return rid;
end $$;

create function public.review_student_release(p_case uuid,p_approve boolean,p_comment text default null)
returns text language plpgsql security definer set search_path=''
as $$
declare sid uuid;student uuid;requester uuid;begin
 select school_id,student_id,requested_by into sid,student,requester from public.student_release_cases where id=p_case for update;
 if sid is null or not private.student_followup_authority(sid) then raise exception 'not_authorized';end if;
 if length(coalesce(p_comment,''))>2000 or (not p_approve and length(trim(coalesce(p_comment,'')))<3) then raise exception 'decision_reason_required';end if;
 update public.student_release_cases set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_role=private.student_followup_actor_role(sid),reviewed_at=now(),decision_reason=nullif(trim(p_comment),'') where id=p_case and status='pending';
 if not found then raise exception 'release_not_pending';end if;
 perform private.student_followup_event(sid,student,'release_case',p_case,case when p_approve then 'approved' else 'rejected' end,jsonb_build_object('comment',nullif(trim(p_comment),'')));
 if requester<>auth.uid() then
  insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
  values(sid,requester,'student_release',case when p_approve then 'Student release approved' else 'Student release not approved' end,coalesce(nullif(trim(p_comment),''),'The decision was recorded.'),'high','/dashboard/sanctions','student-release-decision:'||p_case::text||':'||auth.uid()::text) on conflict do nothing;
 end if;
 return case when p_approve then 'approved' else 'rejected' end;
end $$;

create function public.record_student_release(p_case uuid,p_expected_return_at timestamptz)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid;student uuid;begin
 select school_id,student_id into sid,student from public.student_release_cases where id=p_case for update;
 if sid is null or not private.student_followup_authority(sid) then raise exception 'not_authorized';end if;
 if p_expected_return_at is null or p_expected_return_at<=now() then raise exception 'invalid_expected_return';end if;
 update public.student_release_cases set status='released',released_by=auth.uid(),released_role=private.student_followup_actor_role(sid),released_at=now(),expected_return_at=p_expected_return_at where id=p_case and status='approved';
 if not found then raise exception 'release_not_approved';end if;
 perform private.student_followup_event(sid,student,'release_case',p_case,'released',jsonb_build_object('expected_return_at',p_expected_return_at));
end $$;

create function public.confirm_student_return(p_case uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid;student uuid;begin
 select school_id,student_id into sid,student from public.student_release_cases where id=p_case for update;
 if sid is null or not private.student_followup_authority(sid) then raise exception 'not_authorized';end if;
 update public.student_release_cases set status='returned',returned_by=auth.uid(),returned_role=private.student_followup_actor_role(sid),returned_at=now() where id=p_case and status='released';
 if not found then raise exception 'student_not_released';end if;
 perform private.student_followup_event(sid,student,'release_case',p_case,'returned','{}'::jsonb);
end $$;

revoke all on function private.student_followup_authority(uuid),private.student_followup_actor_role(uuid),private.student_followup_event(uuid,uuid,text,uuid,text,jsonb),private.prevent_student_followup_event_change(),
 public.student_followup_workspace(),public.save_student_sanction_type(uuid,text,boolean),public.create_student_sanction(uuid,uuid,text,timestamptz),public.resolve_student_sanction(uuid,text),public.save_student_release_contact(uuid,uuid,text,text,text,boolean),public.request_student_release(uuid,text,uuid,text),public.review_student_release(uuid,boolean,text),public.record_student_release(uuid,timestamptz),public.confirm_student_return(uuid) from public,anon;
grant execute on function public.student_followup_workspace(),public.save_student_sanction_type(uuid,text,boolean),public.create_student_sanction(uuid,uuid,text,timestamptz),public.resolve_student_sanction(uuid,text),public.save_student_release_contact(uuid,uuid,text,text,text,boolean),public.request_student_release(uuid,text,uuid,text),public.review_student_release(uuid,boolean,text),public.record_student_release(uuid,timestamptz),public.confirm_student_return(uuid) to authenticated;
