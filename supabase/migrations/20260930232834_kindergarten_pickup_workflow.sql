-- Kindergarten pickup is a separate, staff-confirmed event from the student KIOS.
-- The student's active private badge QR identifies the child; staff selects an
-- active authorized adult after checking that adult's identity in person.
create table public.kindergarten_pickup_authorizations (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),
 full_name text not null check(length(trim(full_name)) between 2 and 160),
 relationship text not null check(length(trim(relationship)) between 2 and 80),
 phone text,
 active boolean not null default true,
 created_by uuid not null references public.users(id),
 created_at timestamptz not null default now(),
 deactivated_by uuid references public.users(id),
 deactivated_at timestamptz,
 check((active and deactivated_at is null) or (not active and deactivated_at is not null))
);
create index kindergarten_pickup_auth_student on public.kindergarten_pickup_authorizations(student_id,active,full_name);

create table public.kindergarten_pickups (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),
 authorization_id uuid not null references public.kindergarten_pickup_authorizations(id),
 badge_id uuid not null references public.student_badges(id),
 pickup_date date not null,
 pickup_at timestamptz not null default now(),
 recorded_by uuid not null references public.users(id),
 recorder_name text not null,
 recorder_role text not null,
 reason text,
 created_at timestamptz not null default now(),
 unique(student_id,pickup_date)
);
create index kindergarten_pickups_school_day on public.kindergarten_pickups(school_id,pickup_date desc,pickup_at desc);

create table public.kindergarten_pickup_updates (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),
 parent_user_id uuid not null references public.users(id),
 status text not null check(status in ('on_the_way','delay')),
 note text,
 created_at timestamptz not null default now()
);
create index kindergarten_pickup_updates_latest on public.kindergarten_pickup_updates(student_id,created_at desc);

alter table public.kindergarten_pickup_authorizations enable row level security;
alter table public.kindergarten_pickups enable row level security;
alter table public.kindergarten_pickup_updates enable row level security;
revoke all on public.kindergarten_pickup_authorizations,public.kindergarten_pickups,public.kindergarten_pickup_updates from public,anon,authenticated;

create or replace function private.prevent_kindergarten_pickup_history_change()
returns trigger language plpgsql set search_path=''
as $$ begin raise exception 'pickup_history_immutable'; end $$;
create trigger kindergarten_pickups_immutable before update or delete on public.kindergarten_pickups for each row execute function private.prevent_kindergarten_pickup_history_change();
create trigger kindergarten_pickup_updates_immutable before update or delete on public.kindergarten_pickup_updates for each row execute function private.prevent_kindergarten_pickup_history_change();

create or replace function private.is_preschool_student(p_student uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.students s join public.enrollments e on e.student_id=s.id and e.status='active'
  join public.classes c on c.id=e.class_id and c.school_id=s.school_id
  left join public.grade_levels gl on gl.id=c.grade_level_id
  where s.id=p_student and s.active and s.school_status='active'
   and public.grade_section(coalesce(c.grade_level,gl.code))='preschool'
 )
$$;

create or replace function private.can_operate_kindergarten_pickup(p_school uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select private.has_role(p_school,array['school_admin','director','secretary','surveillant','censeur']) $$;

create or replace function public.kindergarten_pickup_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();manage boolean;
begin
 if auth.uid() is null or sid is null or not private.can_operate_kindergarten_pickup(sid) then raise exception 'not_authorized';end if;
 manage:=private.has_role(sid,array['school_admin','director','secretary']);
 return jsonb_build_object(
  'can_manage_authorizations',manage,
  'students',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',s.id,'name',s.first_name||' '||s.last_name,'class',c.name,
    'status',a.status,'check_in_at',a.check_in_at,
    'picked_up',p.id is not null,'pickup_at',p.pickup_at,'picked_up_by',authz.full_name,
    'authorizations',coalesce((select jsonb_agg(jsonb_build_object('id',pa.id,'name',pa.full_name,'relationship',pa.relationship,'phone',pa.phone) order by pa.full_name)
      from public.kindergarten_pickup_authorizations pa where pa.student_id=s.id and pa.active),'[]'::jsonb)
   ) order by c.name,s.first_name,s.last_name)
   from public.attendance a join public.students s on s.id=a.student_id and s.school_id=a.school_id
   join public.classes c on c.id=a.class_id and c.school_id=a.school_id
   left join public.grade_levels gl on gl.id=c.grade_level_id
   left join public.kindergarten_pickups p on p.student_id=s.id and p.pickup_date=(now() at time zone 'America/Port-au-Prince')::date
   left join public.kindergarten_pickup_authorizations authz on authz.id=p.authorization_id
   where a.school_id=sid and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date
    and a.check_in_at is not null and a.status in ('present','late')
    and public.grade_section(coalesce(c.grade_level,gl.code))='preschool'
  ),'[]'::jsonb),
  'today',((now() at time zone 'America/Port-au-Prince')::date)
 );
end
$$;

create or replace function public.kindergarten_pickup_preview(p_qr text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare b public.student_badges;s public.students;sid uuid;today date:=(now() at time zone 'America/Port-au-Prince')::date;
begin
 if auth.uid() is null or coalesce(p_qr,'') !~ '^AOSQ1\.[a-f0-9]{64}$' then raise exception 'invalid_badge';end if;
 select sb.* into b from private.badge_token_history h join public.student_badges sb on sb.id=h.badge_id where h.token_hash=encode(extensions.digest(substring(p_qr from 7),'sha256'),'hex');
 if b.id is null or not b.active or b.state<>'active' then raise exception 'invalid_badge';end if;
 select * into s from public.students where id=b.student_id;
 sid:=s.school_id;
 if sid is null or not private.can_operate_kindergarten_pickup(sid) then raise exception 'not_authorized';end if;
 if not private.is_preschool_student(s.id) then raise exception 'preschool_only';end if;
 return jsonb_build_object('student_id',s.id,'student',s.first_name||' '||s.last_name,
  'class',(select c.name from public.enrollments e join public.classes c on c.id=e.class_id where e.student_id=s.id and e.status='active' limit 1),
  'picked_up',exists(select 1 from public.kindergarten_pickups p where p.student_id=s.id and p.pickup_date=today),
  'checked_in',exists(select 1 from public.attendance a where a.student_id=s.id and a.school_id=sid and a.attendance_date=today and a.check_in_at is not null and a.status in ('present','late') and a.check_out_at is null),
  'authorized_people',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.full_name,'relationship',a.relationship) order by a.full_name) from public.kindergarten_pickup_authorizations a where a.student_id=s.id and a.active),'[]'::jsonb));
end
$$;

create or replace function public.save_kindergarten_pickup_authorization(
 p_student uuid,p_authorization uuid,p_name text,p_relationship text,p_phone text,p_active boolean default true
) returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid;result_id uuid;
begin
 select school_id into sid from public.students where id=p_student and private.is_preschool_student(id);
 if sid is null or auth.uid() is null or not private.has_role(sid,array['school_admin','director','secretary']) then raise exception 'not_authorized';end if;
 if p_authorization is not null then
  if not exists(select 1 from public.kindergarten_pickup_authorizations where id=p_authorization and student_id=p_student and school_id=sid) then raise exception 'authorization_not_found';end if;
  update public.kindergarten_pickup_authorizations set active=p_active,
   full_name=case when p_active then trim(p_name) else full_name end,
   relationship=case when p_active then trim(p_relationship) else relationship end,
   phone=case when p_active then nullif(trim(p_phone),'') else phone end,
   deactivated_by=case when p_active then null else auth.uid() end,
   deactivated_at=case when p_active then null else now() end
   where id=p_authorization returning id into result_id;
 else
  if not p_active then raise exception 'invalid_authorization';end if;
  insert into public.kindergarten_pickup_authorizations(school_id,student_id,full_name,relationship,phone,created_by)
  values(sid,p_student,trim(p_name),trim(p_relationship),nullif(trim(p_phone),''),auth.uid()) returning id into result_id;
 end if;
 return result_id;
end
$$;

create or replace function public.complete_kindergarten_pickup(p_qr text,p_authorization uuid,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare b public.student_badges;s public.students;sid uuid;today date:=(now() at time zone 'America/Port-au-Prince')::date;actor_role text;actor_name text;pickup_id uuid;adult public.kindergarten_pickup_authorizations;attendance_id uuid;checkout timestamptz:=now();
begin
 if auth.uid() is null or coalesce(p_qr,'') !~ '^AOSQ1\.[a-f0-9]{64}$' then raise exception 'invalid_badge';end if;
 select sb.* into b from private.badge_token_history h join public.student_badges sb on sb.id=h.badge_id
 where h.token_hash=encode(extensions.digest(substring(p_qr from 7),'sha256'),'hex');
 if b.id is null then raise exception 'invalid_badge';end if;
 select * into s from public.students where id=b.student_id for update;
 sid:=s.school_id;
 if sid is null or not private.can_operate_kindergarten_pickup(sid) then raise exception 'not_authorized';end if;
 if not b.active or b.state<>'active' then raise exception 'invalid_badge';end if;
 if not private.is_preschool_student(s.id) then raise exception 'preschool_only';end if;
 select * into adult from public.kindergarten_pickup_authorizations where id=p_authorization and student_id=s.id and school_id=sid and active;
 if adult.id is null then raise exception 'pickup_person_not_authorized';end if;
 if exists(select 1 from public.kindergarten_pickups where student_id=s.id and pickup_date=today) then raise exception 'already_picked_up';end if;
 select id into attendance_id from public.attendance a where a.student_id=s.id and a.school_id=sid and a.attendance_date=today and a.check_in_at is not null and a.status in ('present','late') and a.check_out_at is null for update;
 if attendance_id is null then raise exception 'student_not_on_campus';end if;
 select role::text into actor_role from public.school_members where school_id=sid and user_id=auth.uid() and enabled order by case role::text when 'school_admin' then 0 when 'director' then 1 when 'secretary' then 2 else 3 end limit 1;
 select full_name into actor_name from public.users where id=auth.uid();
 insert into public.kindergarten_pickups(school_id,student_id,authorization_id,badge_id,pickup_date,recorded_by,recorder_name,recorder_role,reason)
 values(sid,s.id,adult.id,b.id,today,auth.uid(),coalesce(actor_name,'Staff'),coalesce(actor_role,'staff'),nullif(trim(p_reason),''))
 on conflict(student_id,pickup_date) do nothing returning id into pickup_id;
 if pickup_id is null then raise exception 'already_picked_up';end if;
 update public.attendance set check_out_at=checkout,updated_at=checkout,recorded_by=auth.uid() where id=attendance_id and check_out_at is null returning id into attendance_id;
 if attendance_id is null then raise exception 'already_checked_out';end if;
 insert into public.attendance_events(attendance_id,student_id,source,actor_id,actor_name,actor_role,action,recorded_at,attendance_date)
 values(attendance_id,s.id,'STAFF',auth.uid(),coalesce(actor_name,'Staff'),coalesce(actor_role,'staff'),'kindergarten_pickup_check_out',checkout,today);
 insert into public.badge_scans(school_id,student_id,badge_id,source,result) values(sid,s.id,b.id,'PICKUP','pickup_complete');
 insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
 select sid,m.user_id,'kindergarten_pickup','Kindergarten pickup recorded',s.first_name||' '||s.last_name||' was picked up by '||adult.full_name,'normal','/dashboard/attendance/kindergarten-pickup','kindergarten-pickup:'||pickup_id::text||':'||m.user_id::text
 from public.student_parents sp join public.parents pa on pa.id=sp.parent_id join public.school_members m on m.school_id=pa.school_id and m.user_id=pa.user_id and m.enabled and m.role='parent'
 where sp.student_id=s.id and pa.school_id=sid on conflict do nothing;
 return jsonb_build_object('pickup_id',pickup_id,'student',s.first_name||' '||s.last_name,'class',(select c.name from public.enrollments e join public.classes c on c.id=e.class_id where e.student_id=s.id and e.status='active' limit 1),'picked_up_by',adult.full_name,'pickup_at',checkout);
end
$$;

create or replace function public.guardian_note_kindergarten_pickup(p_student uuid,p_status text,p_note text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid;
begin
 select school_id into sid from public.students where id=p_student and private.is_preschool_student(id);
 if sid is null or auth.uid() is null or not exists(select 1 from public.student_parents sp join public.parents p on p.id=sp.parent_id join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id and m.enabled and m.role='parent' where sp.student_id=p_student and p.school_id=sid and p.user_id=auth.uid()) then raise exception 'not_authorized';end if;
 if p_status not in ('on_the_way','delay') or length(coalesce(p_note,''))>500 then raise exception 'invalid_status';end if;
 if exists(select 1 from public.kindergarten_pickups where student_id=p_student and pickup_date=(now() at time zone 'America/Port-au-Prince')::date) then raise exception 'already_picked_up';end if;
 insert into public.kindergarten_pickup_updates(school_id,student_id,parent_user_id,status,note) values(sid,p_student,auth.uid(),p_status,nullif(trim(p_note),''));
 insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
 select sid,m.user_id,'kindergarten_pickup','Kindergarten pickup update',s.first_name||' '||s.last_name||': '||p_status||case when nullif(trim(p_note),'') is null then '' else ' · '||trim(p_note) end,'normal','/dashboard/attendance/kindergarten-pickup','kindergarten-pickup-parent:'||p_student::text||':'||to_char(now() at time zone 'America/Port-au-Prince','YYYYMMDD')||':'||gen_random_uuid()::text||':'||m.user_id::text
 from public.students s join public.school_members m on m.school_id=s.school_id and m.enabled and m.role in ('school_admin','director','secretary','surveillant','censeur') where s.id=p_student;
end
$$;

create or replace function public.kindergarten_parent_pickup_status()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 if auth.uid() is null then raise exception 'not_authorized';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('student_id',s.id,'student',s.first_name||' '||s.last_name,'class',c.name,'authorization_status',coalesce((select u.status||case when u.note is null then '' else ': '||u.note end from public.kindergarten_pickup_updates u where u.student_id=s.id and u.parent_user_id=auth.uid() and (u.created_at at time zone 'America/Port-au-Prince')::date=(now() at time zone 'America/Port-au-Prince')::date order by u.created_at desc limit 1),'none'),'picked_up',p.pickup_at,'picked_up_by',a.full_name) order by s.first_name,s.last_name)
 from public.student_parents sp join public.parents pa on pa.id=sp.parent_id join public.students s on s.id=sp.student_id and s.school_id=pa.school_id join public.school_members m on m.school_id=pa.school_id and m.user_id=pa.user_id and m.enabled and m.role='parent' join public.enrollments e on e.student_id=s.id and e.status='active' join public.classes c on c.id=e.class_id left join public.grade_levels gl on gl.id=c.grade_level_id left join public.kindergarten_pickups p on p.student_id=s.id and p.pickup_date=(now() at time zone 'America/Port-au-Prince')::date left join public.kindergarten_pickup_authorizations a on a.id=p.authorization_id where pa.user_id=auth.uid() and public.grade_section(coalesce(c.grade_level,gl.code))='preschool'),'[]'::jsonb);
end
$$;

revoke all on function private.is_preschool_student(uuid),private.can_operate_kindergarten_pickup(uuid),private.prevent_kindergarten_pickup_history_change(),public.kindergarten_pickup_workspace(),public.kindergarten_pickup_preview(text),public.save_kindergarten_pickup_authorization(uuid,uuid,text,text,text,boolean),public.complete_kindergarten_pickup(text,uuid,text),public.guardian_note_kindergarten_pickup(uuid,text,text),public.kindergarten_parent_pickup_status() from public,anon,authenticated;
grant execute on function private.is_preschool_student(uuid),private.can_operate_kindergarten_pickup(uuid) to authenticated;
grant execute on function public.kindergarten_pickup_workspace(),public.kindergarten_pickup_preview(text),public.save_kindergarten_pickup_authorization(uuid,uuid,text,text,text,boolean),public.complete_kindergarten_pickup(text,uuid,text),public.guardian_note_kindergarten_pickup(uuid,text,text),public.kindergarten_parent_pickup_status() to authenticated;
