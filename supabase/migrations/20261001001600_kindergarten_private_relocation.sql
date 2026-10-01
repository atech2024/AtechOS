-- Staff-only case history for temporarily relocating a Preschool child to the
-- school office. Parents receive only a generic prompt while the child remains
-- checked in; case notes and contact outcomes stay private to authorized staff.
create table public.kindergarten_relocation_cases (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),
 attendance_id uuid not null references public.attendance(id),
 reason_category text not null check(reason_category in ('needs_support','safety','other')),
 private_note text check(private_note is null or length(private_note)<=1000),
 status text not null default 'active' check(status in ('active','returned_to_class','picked_up')),
 opened_by uuid not null references public.users(id),
 opened_name text not null,
 opened_role text not null,
 opened_at timestamptz not null default now(),
 closed_by uuid references public.users(id),
 closed_name text,
 closed_role text,
 closed_at timestamptz,
 check((status='active' and closed_at is null) or (status<>'active' and closed_at is not null))
);
create unique index kindergarten_one_active_relocation_per_attendance on public.kindergarten_relocation_cases(attendance_id) where status='active';
create index kindergarten_relocation_school_status on public.kindergarten_relocation_cases(school_id,status,opened_at desc);

create table public.kindergarten_relocation_events (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 case_id uuid not null references public.kindergarten_relocation_cases(id),
 student_id uuid not null references public.students(id),
 event_type text not null check(event_type in ('relocated_to_office','parent_contact_attempt','returned_to_class','picked_up')),
 outcome text check(outcome is null or outcome in ('reached','no_answer','message_left')),
 private_note text check(private_note is null or length(private_note)<=1000),
 actor_id uuid not null references public.users(id),
 actor_name text not null,
 actor_role text not null,
 created_at timestamptz not null default now()
);
create index kindergarten_relocation_events_case on public.kindergarten_relocation_events(case_id,created_at);

alter table public.kindergarten_relocation_cases enable row level security;
alter table public.kindergarten_relocation_events enable row level security;
revoke all on public.kindergarten_relocation_cases,public.kindergarten_relocation_events from public,anon,authenticated;

create or replace function private.prevent_kindergarten_relocation_event_change()
returns trigger language plpgsql set search_path=''
as $$ begin raise exception 'relocation_history_immutable'; end $$;
create trigger kindergarten_relocation_events_immutable before update or delete on public.kindergarten_relocation_events for each row execute function private.prevent_kindergarten_relocation_event_change();

create or replace function private.guard_kindergarten_relocation_case()
returns trigger language plpgsql set search_path=''
as $$
begin
 if tg_op='DELETE' then raise exception 'relocation_history_immutable'; end if;
 if new.school_id is distinct from old.school_id or new.student_id is distinct from old.student_id or new.attendance_id is distinct from old.attendance_id or new.reason_category is distinct from old.reason_category or new.private_note is distinct from old.private_note or new.opened_by is distinct from old.opened_by or new.opened_name is distinct from old.opened_name or new.opened_role is distinct from old.opened_role or new.opened_at is distinct from old.opened_at then raise exception 'relocation_history_immutable'; end if;
 if old.status<>'active' or new.status not in ('returned_to_class','picked_up') or new.closed_at is null or new.closed_by is null then raise exception 'invalid_relocation_transition'; end if;
 return new;
end $$;
create trigger kindergarten_relocation_case_guard before update or delete on public.kindergarten_relocation_cases for each row execute function private.guard_kindergarten_relocation_case();

create or replace function public.kindergarten_relocation_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();actor uuid:=auth.uid();actor_name text;actor_role text;
begin
 if actor is null or sid is null or not private.can_operate_kindergarten_pickup(sid) then raise exception 'not_authorized';end if;
 select full_name into actor_name from public.users where id=actor;
 select role::text into actor_role from public.school_members where school_id=sid and user_id=actor and enabled order by case role::text when 'school_admin' then 0 when 'director' then 1 when 'secretary' then 2 when 'censeur' then 3 else 4 end limit 1;
 return jsonb_build_object('students',coalesce((
  select jsonb_agg(jsonb_build_object('student_id',s.id,'student',s.first_name||' '||s.last_name,'class',c.name,'attendance_id',a.id,'check_in_at',a.check_in_at,'case_id',rc.id,'reason_category',rc.reason_category,'private_note',rc.private_note,'opened_at',rc.opened_at,'events',coalesce((select jsonb_agg(jsonb_build_object('event_type',re.event_type,'outcome',re.outcome,'private_note',re.private_note,'actor',re.actor_name,'role',re.actor_role,'created_at',re.created_at) order by re.created_at desc) from public.kindergarten_relocation_events re where re.case_id=rc.id),'[]'::jsonb)) order by c.name,s.first_name,s.last_name)
  from public.attendance a join public.students s on s.id=a.student_id and s.school_id=a.school_id join public.classes c on c.id=a.class_id and c.school_id=a.school_id left join public.grade_levels gl on gl.id=c.grade_level_id left join public.kindergarten_pickups p on p.student_id=s.id and p.school_id=s.school_id and p.pickup_date=(now() at time zone 'America/Port-au-Prince')::date left join public.kindergarten_relocation_cases rc on rc.attendance_id=a.id and rc.status='active'
  where a.school_id=sid and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date and a.check_in_at is not null and a.check_out_at is null and a.status in ('present','late') and p.id is null and public.grade_section(coalesce(c.grade_level,gl.code))='preschool'
 ),'[]'::jsonb));
end $$;

create or replace function public.start_kindergarten_relocation(p_student uuid,p_reason text,p_note text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();actor uuid:=auth.uid();actor_name text;actor_role text;att uuid;case_id uuid;
begin
 if actor is null or sid is null or not private.can_operate_kindergarten_pickup(sid) then raise exception 'not_authorized';end if;
 if p_reason is null or p_reason not in ('needs_support','safety','other') or length(coalesce(p_note,''))>1000 then raise exception 'invalid_relocation';end if;
 if not private.is_preschool_student(p_student) or not exists(select 1 from public.students s where s.id=p_student and s.school_id=sid) then raise exception 'preschool_only';end if;
 select a.id into att from public.attendance a where a.student_id=p_student and a.school_id=sid and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date and a.check_in_at is not null and a.check_out_at is null and a.status in ('present','late') for update;
 if att is null then raise exception 'student_not_on_campus';end if;
 if exists(select 1 from public.kindergarten_pickups where student_id=p_student and school_id=sid and pickup_date=(now() at time zone 'America/Port-au-Prince')::date) then raise exception 'already_picked_up';end if;
 select full_name into actor_name from public.users where id=actor;
 select role::text into actor_role from public.school_members where school_id=sid and user_id=actor and enabled order by case role::text when 'school_admin' then 0 when 'director' then 1 when 'secretary' then 2 when 'censeur' then 3 else 4 end limit 1;
 insert into public.kindergarten_relocation_cases(school_id,student_id,attendance_id,reason_category,private_note,opened_by,opened_name,opened_role)
 values(sid,p_student,att,p_reason,nullif(trim(p_note),''),actor,coalesce(actor_name,'Staff'),coalesce(actor_role,'staff')) returning id into case_id;
 insert into public.kindergarten_relocation_events(school_id,case_id,student_id,event_type,private_note,actor_id,actor_name,actor_role)
 values(sid,case_id,p_student,'relocated_to_office',nullif(trim(p_note),''),actor,coalesce(actor_name,'Staff'),coalesce(actor_role,'staff'));
 return case_id;
end $$;

create or replace function public.record_kindergarten_parent_contact(p_case uuid,p_outcome text,p_note text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();actor uuid:=auth.uid();actor_name text;actor_role text;student uuid;
begin
 if actor is null or sid is null or not private.can_operate_kindergarten_pickup(sid) then raise exception 'not_authorized';end if;
 if p_outcome is null or p_outcome not in ('reached','no_answer','message_left') or length(coalesce(p_note,''))>1000 then raise exception 'invalid_contact_outcome';end if;
 select rc.student_id into student from public.kindergarten_relocation_cases rc join public.attendance a on a.id=rc.attendance_id and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date where rc.id=p_case and rc.school_id=sid and rc.status='active' for update of rc;
 if student is null then raise exception 'relocation_not_active';end if;
 if not exists(select 1 from public.attendance a join public.kindergarten_relocation_cases rc on rc.attendance_id=a.id where rc.id=p_case and a.student_id=student and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date and a.check_in_at is not null and a.check_out_at is null and a.status in ('present','late')) then raise exception 'student_not_on_campus';end if;
 select full_name into actor_name from public.users where id=actor;
 select role::text into actor_role from public.school_members where school_id=sid and user_id=actor and enabled order by case role::text when 'school_admin' then 0 when 'director' then 1 when 'secretary' then 2 when 'censeur' then 3 else 4 end limit 1;
 insert into public.kindergarten_relocation_events(school_id,case_id,student_id,event_type,outcome,private_note,actor_id,actor_name,actor_role)
 values(sid,p_case,student,'parent_contact_attempt',p_outcome,nullif(trim(p_note),''),actor,coalesce(actor_name,'Staff'),coalesce(actor_role,'staff'));
end $$;

create or replace function public.return_kindergarten_student_to_class(p_case uuid,p_note text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();actor uuid:=auth.uid();actor_name text;actor_role text;student uuid;
begin
 if actor is null or sid is null or not private.can_operate_kindergarten_pickup(sid) then raise exception 'not_authorized';end if;
 if length(coalesce(p_note,''))>1000 then raise exception 'invalid_relocation';end if;
 select rc.student_id into student from public.kindergarten_relocation_cases rc join public.attendance a on a.id=rc.attendance_id and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date where rc.id=p_case and rc.school_id=sid and rc.status='active' for update of rc;
 if student is null then raise exception 'relocation_not_active';end if;
 if not exists(select 1 from public.attendance a join public.kindergarten_relocation_cases rc on rc.attendance_id=a.id where rc.id=p_case and a.student_id=student and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date and a.check_in_at is not null and a.check_out_at is null and a.status in ('present','late')) then raise exception 'student_not_on_campus';end if;
 select full_name into actor_name from public.users where id=actor;
 select role::text into actor_role from public.school_members where school_id=sid and user_id=actor and enabled order by case role::text when 'school_admin' then 0 when 'director' then 1 when 'secretary' then 2 when 'censeur' then 3 else 4 end limit 1;
 update public.kindergarten_relocation_cases set status='returned_to_class',closed_by=actor,closed_name=coalesce(actor_name,'Staff'),closed_role=coalesce(actor_role,'staff'),closed_at=now() where id=p_case and status='active';
 insert into public.kindergarten_relocation_events(school_id,case_id,student_id,event_type,private_note,actor_id,actor_name,actor_role)
 values(sid,p_case,student,'returned_to_class',nullif(trim(p_note),''),actor,coalesce(actor_name,'Staff'),coalesce(actor_role,'staff'));
end $$;

create or replace function private.close_kindergarten_relocation_after_pickup()
returns trigger language plpgsql security definer set search_path=''
as $$
declare actor_name text;actor_role text;pickup public.kindergarten_pickups;rc record;
begin
 if new.check_out_at is null or old.check_out_at is not null then return new;end if;
 select * into pickup from public.kindergarten_pickups p where p.student_id=new.student_id and p.school_id=new.school_id and p.pickup_date=new.attendance_date;
 if pickup.id is null then return new;end if;
 select full_name into actor_name from public.users where id=pickup.recorded_by;
 select role::text into actor_role from public.school_members where school_id=pickup.school_id and user_id=pickup.recorded_by and enabled order by case role::text when 'school_admin' then 0 when 'director' then 1 when 'secretary' then 2 when 'censeur' then 3 else 4 end limit 1;
 for rc in select rc.* from public.kindergarten_relocation_cases rc where rc.attendance_id=new.id and rc.student_id=new.student_id and rc.school_id=new.school_id and rc.status='active' for update loop
  update public.kindergarten_relocation_cases set status='picked_up',closed_by=pickup.recorded_by,closed_name=coalesce(actor_name,'Staff'),closed_role=coalesce(actor_role,'staff'),closed_at=new.check_out_at where id=rc.id;
  insert into public.kindergarten_relocation_events(school_id,case_id,student_id,event_type,actor_id,actor_name,actor_role,created_at)
  values(new.school_id,rc.id,new.student_id,'picked_up',pickup.recorded_by,coalesce(actor_name,'Staff'),coalesce(actor_role,'staff'),new.check_out_at);
 end loop;
 return new;
end $$;
create trigger kindergarten_relocation_close_on_pickup after update of check_out_at on public.attendance for each row execute function private.close_kindergarten_relocation_after_pickup();

create or replace function public.kindergarten_parent_relocation_status()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'not_authorized';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('student_id',s.id,'student',s.first_name||' '||s.last_name,'class',c.name,'message','Please contact the school regarding your child.') order by s.first_name,s.last_name)
  from public.kindergarten_relocation_cases rc join public.students s on s.id=rc.student_id and s.school_id=rc.school_id join public.student_parents sp on sp.student_id=s.id join public.parents pa on pa.id=sp.parent_id and pa.school_id=s.school_id join public.school_members m on m.school_id=pa.school_id and m.user_id=pa.user_id and m.enabled and m.role='parent' join public.attendance a on a.id=rc.attendance_id and a.student_id=s.id and a.school_id=s.school_id and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date and a.check_in_at is not null and a.check_out_at is null join public.enrollments e on e.student_id=s.id and e.school_id=s.school_id and e.status='active' join public.classes c on c.id=e.class_id and c.school_id=s.school_id left join public.grade_levels gl on gl.id=c.grade_level_id
  where pa.user_id=actor and rc.status='active' and a.status in ('present','late') and public.grade_section(coalesce(c.grade_level,gl.code))='preschool' and not exists(select 1 from public.kindergarten_pickups p where p.student_id=s.id and p.school_id=s.school_id and p.pickup_date=(now() at time zone 'America/Port-au-Prince')::date)),'[]'::jsonb);
end $$;

revoke all on function private.prevent_kindergarten_relocation_event_change(),private.guard_kindergarten_relocation_case(),private.close_kindergarten_relocation_after_pickup(),public.kindergarten_relocation_workspace(),public.start_kindergarten_relocation(uuid,text,text),public.record_kindergarten_parent_contact(uuid,text,text),public.return_kindergarten_student_to_class(uuid,text),public.kindergarten_parent_relocation_status() from public,anon,authenticated;
grant execute on function public.kindergarten_relocation_workspace(),public.start_kindergarten_relocation(uuid,text,text),public.record_kindergarten_parent_contact(uuid,text,text),public.return_kindergarten_student_to_class(uuid,text),public.kindergarten_parent_relocation_status() to authenticated;
