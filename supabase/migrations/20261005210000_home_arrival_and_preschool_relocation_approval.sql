-- School-wide arrival-at-home confirmation and direction-approved Preschool
-- relocation. All family access is scoped to the linked child; kiosk release
-- approvals become the student's actual KIOS check-out.

-- Let an approved release use KIOS outside the ordinary checkout window. The
-- student scan becomes the recorded departure; staff does not have to create
-- a second, premature departure record.
alter table public.student_release_cases add column if not exists departure_source text not null default 'staff';
alter table public.student_release_cases add constraint student_release_cases_departure_source_check
 check (departure_source in ('staff','KIOS'));
alter table public.student_release_cases drop constraint if exists student_release_cases_check;
alter table public.student_release_cases add constraint student_release_cases_check check (
 (status='pending' and reviewed_by is null and reviewed_at is null and released_at is null and returned_at is null)
 or (status='approved' and reviewed_by is not null and reviewed_at is not null and released_at is null and returned_at is null)
 or (status='rejected' and reviewed_by is not null and reviewed_at is not null and length(trim(coalesce(decision_reason,'')))>=3 and released_at is null and returned_at is null)
 or (status='released' and reviewed_by is not null and reviewed_at is not null and released_at is not null and returned_at is null and ((departure_source='staff' and released_by is not null and expected_return_at is not null) or (departure_source='KIOS' and released_by is null)))
 or (status='returned' and reviewed_by is not null and reviewed_at is not null and released_at is not null and returned_by is not null and returned_at is not null)
);

do $kiosk_release$
declare src text;old_window text;old_checkout text;old_pickup text;
begin
 select pg_get_functiondef('private.record_student_kiosk(uuid)'::regprocedure) into src;
 if position('approved_release_kiosk_checkout' in src)>0 then return;end if;
 old_pickup:='select * into a from public.attendance where student_id=s.id and attendance_date=d for update;';
 if position(old_pickup in src)=0 then raise exception 'preschool_pickup_kiosk_anchor_missing';end if;
 src:=replace(src,old_pickup,
  'select * into a from public.attendance where student_id=s.id and attendance_date=d for update;'
  ||'if exists(select 1 from public.kindergarten_pickups p where p.student_id=s.id and p.school_id=s.school_id and p.pickup_date=d) then return jsonb_build_object(''action'',''already_picked_up_by_parent'',''first_name'',s.first_name,''last_name'',s.last_name,''class_name'',(select c.name from public.classes c where c.id=a.class_id and c.school_id=s.school_id),''check_in_at'',a.check_in_at,''check_out_at'',a.check_out_at);end if;');
 old_window:='if window_name=''blocked'' and exists(select 1 from public.student_release_cases r where r.student_id=s.id and r.school_id=s.school_id and r.status=''released'' and (r.released_at at time zone ''America/Port-au-Prince'')::date=d) then window_name:=''checkout'';end if;';
 if position(old_window in src)=0 then raise exception 'approved_release_kiosk_window_anchor_missing';end if;
 src:=replace(src,old_window,
  '/* approved_release_kiosk_checkout */ if exists(select 1 from public.student_release_cases r where r.student_id=s.id and r.school_id=s.school_id and r.status in (''approved'',''released'') and (coalesce(r.reviewed_at,r.released_at) at time zone ''America/Port-au-Prince'')::date=d and a.check_in_at is not null and a.check_out_at is null) then window_name:=''checkout'';end if;');
 old_checkout:='update public.attendance set check_out_at=ts,recorded_by=s.user_id,updated_at=ts where id=a.id returning * into a;result:=''check_out'';';
 if position(old_checkout in src)=0 then raise exception 'approved_release_kiosk_checkout_anchor_missing';end if;
 src:=replace(src,old_checkout,
  'update public.attendance set check_out_at=ts,recorded_by=s.user_id,updated_at=ts where id=a.id returning * into a;result:=''check_out'';'
  ||'update public.student_release_cases r set status=''released'',departure_source=''KIOS'',released_by=null,released_role=''student'',released_at=ts,expected_return_at=null where r.student_id=s.id and r.school_id=s.school_id and r.status=''approved'' and (r.reviewed_at at time zone ''America/Port-au-Prince'')::date=d;'
  ||'insert into public.student_followup_events(school_id,student_id,entity,entity_id,action,actor_id,actor_name,actor_role,detail) select r.school_id,r.student_id,''release_case'',r.id,''released_via_kiosk'',r.reviewed_by,coalesce(u.full_name,''Staff''),coalesce(r.reviewed_role,''director''),jsonb_build_object(''source'',''KIOS'',''recorded_at'',ts) from public.student_release_cases r join public.users u on u.id=r.reviewed_by where r.student_id=s.id and r.school_id=s.school_id and r.status=''released'' and r.departure_source=''KIOS'' and r.released_at=ts;');
 execute src;
end $kiosk_release$;

create table public.school_home_arrival_settings (
 school_id uuid primary key references public.schools(id) on delete cascade,
 enabled boolean not null default false,
 enabled_by uuid references public.users(id),
 enabled_at timestamptz,
 updated_at timestamptz not null default now(),
 check ((enabled and enabled_by is not null and enabled_at is not null) or not enabled)
);
create table public.student_home_arrival_confirmations (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),
 attendance_id uuid not null references public.attendance(id),
 confirmed_as text not null check (confirmed_as in ('parent','student')),
 confirmed_by uuid references public.users(id),
 confirmed_at timestamptz not null default now(),
 unique(attendance_id),
 check ((confirmed_as='parent' and confirmed_by is not null) or (confirmed_as='student' and confirmed_by is null))
);
create index student_home_arrival_school_day on public.student_home_arrival_confirmations(school_id,confirmed_at desc);
alter table public.school_home_arrival_settings enable row level security;
alter table public.student_home_arrival_confirmations enable row level security;
revoke all on public.school_home_arrival_settings,public.student_home_arrival_confirmations from public,anon,authenticated;

create function private.prevent_home_arrival_change()
returns trigger language plpgsql set search_path=''
as $$ begin raise exception 'home_arrival_history_immutable';end $$;
create trigger student_home_arrival_immutable before update or delete on public.student_home_arrival_confirmations
 for each row execute function private.prevent_home_arrival_change();

create function public.home_arrival_staff_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); enabled_now boolean;
begin
 if auth.uid() is null or sid is null or not private.has_role(sid,array['school_admin','director','secretary','surveillant','censeur']) then raise exception 'not_authorized';end if;
 select coalesce((select h.enabled from public.school_home_arrival_settings h where h.school_id=sid),false) into enabled_now;
 return jsonb_build_object('enabled',enabled_now,'can_manage',private.has_role(sid,array['director']),'students',coalesce((
  select jsonb_agg(jsonb_build_object('student_id',s.id,'student',s.first_name||' '||s.last_name,'class',c.name,'check_out_at',a.check_out_at,'confirmed_at',h.confirmed_at,'confirmed_as',h.confirmed_as) order by c.name,s.last_name,s.first_name)
  from public.attendance a join public.students s on s.id=a.student_id and s.school_id=a.school_id
  join public.classes c on c.id=a.class_id and c.school_id=a.school_id
  left join public.student_home_arrival_confirmations h on h.attendance_id=a.id
  where a.school_id=sid and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date and a.check_out_at is not null and enabled_now
 ),'[]'::jsonb));
end $$;

create function public.set_home_arrival_enabled(p_enabled boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();
begin
 if auth.uid() is null or sid is null or not private.has_role(sid,array['director']) then raise exception 'not_authorized';end if;
 insert into public.school_home_arrival_settings(school_id,enabled,enabled_by,enabled_at,updated_at)
 values(sid,coalesce(p_enabled,false),case when p_enabled then auth.uid() end,case when p_enabled then now() end,now())
 on conflict(school_id) do update set enabled=excluded.enabled,enabled_by=excluded.enabled_by,enabled_at=excluded.enabled_at,updated_at=now();
end $$;

create function public.family_home_arrival_status(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid; result jsonb;
begin
 select s.school_id into sid from public.students s where s.id=p_student and s.active and s.school_status='active';
 if sid is null or auth.uid() is null or not exists(select 1 from public.student_parents sp join public.parents p on p.id=sp.parent_id join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id and m.enabled and m.role='parent' where sp.student_id=p_student and p.school_id=sid and p.user_id=auth.uid()) then raise exception 'not_authorized';end if;
 if not exists(select 1 from public.school_home_arrival_settings h where h.school_id=sid and h.enabled) then return null;end if;
 select jsonb_build_object('student_id',s.id,'student',s.first_name||' '||s.last_name,'class',c.name,'check_out_at',a.check_out_at,'confirmed_at',h.confirmed_at,'confirmed_as',h.confirmed_as)
 into result from public.attendance a join public.students s on s.id=a.student_id join public.classes c on c.id=a.class_id left join public.student_home_arrival_confirmations h on h.attendance_id=a.id
 where a.student_id=p_student and a.school_id=sid and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date and a.check_out_at is not null limit 1;
 return result;
end $$;

create function public.confirm_family_home_arrival(p_student uuid)
returns timestamptz language plpgsql security definer set search_path=''
as $$
declare sid uuid;v_attendance_id uuid;confirmed timestamptz;
begin
 select s.school_id into sid from public.students s where s.id=p_student and s.active and s.school_status='active';
 if sid is null or auth.uid() is null or not exists(select 1 from public.student_parents sp join public.parents p on p.id=sp.parent_id join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id and m.enabled and m.role='parent' where sp.student_id=p_student and p.school_id=sid and p.user_id=auth.uid()) then raise exception 'not_authorized';end if;
 if not exists(select 1 from public.school_home_arrival_settings h where h.school_id=sid and h.enabled) then raise exception 'home_arrival_disabled';end if;
 select a.id into v_attendance_id from public.attendance a where a.student_id=p_student and a.school_id=sid and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date and a.check_out_at is not null for update;
 if v_attendance_id is null then raise exception 'student_not_checked_out';end if;
 insert into public.student_home_arrival_confirmations(school_id,student_id,attendance_id,confirmed_as,confirmed_by)
 values(sid,p_student,v_attendance_id,'parent',auth.uid()) on conflict(attendance_id) do nothing;
 select c.confirmed_at into confirmed from public.student_home_arrival_confirmations c where c.attendance_id=v_attendance_id and c.student_id=p_student;
 return confirmed;
end $$;

create function public.student_home_arrival_status(p_token text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid; student uuid; result jsonb;
begin
 if length(coalesce(p_token,''))<32 then return null;end if;
 select s.school_id,s.id into sid,student from private.student_sessions se join public.students s on s.id=se.student_id where se.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and se.expires_at>now() and s.portal_enabled and s.active and s.school_status='active';
 if student is null or not exists(select 1 from public.school_home_arrival_settings h where h.school_id=sid and h.enabled) then return null;end if;
 select jsonb_build_object('student_id',s.id,'student',s.first_name||' '||s.last_name,'class',c.name,'check_out_at',a.check_out_at,'confirmed_at',h.confirmed_at,'confirmed_as',h.confirmed_as)
 into result from public.attendance a join public.students s on s.id=a.student_id join public.classes c on c.id=a.class_id left join public.student_home_arrival_confirmations h on h.attendance_id=a.id
 where a.student_id=student and a.school_id=sid and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date and a.check_out_at is not null limit 1;
 return result;
end $$;

create function public.confirm_student_home_arrival(p_token text)
returns timestamptz language plpgsql security definer set search_path=''
as $$
declare sid uuid; student uuid; v_attendance_id uuid; confirmed timestamptz;
begin
 if length(coalesce(p_token,''))<32 then raise exception 'not_authorized';end if;
 select s.school_id,s.id into sid,student from private.student_sessions se join public.students s on s.id=se.student_id where se.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and se.expires_at>now() and s.portal_enabled and s.active and s.school_status='active';
 if student is null or not exists(select 1 from public.school_home_arrival_settings h where h.school_id=sid and h.enabled) then raise exception 'not_authorized';end if;
 select a.id into v_attendance_id from public.attendance a where a.student_id=student and a.school_id=sid and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date and a.check_out_at is not null for update;
 if v_attendance_id is null then raise exception 'student_not_checked_out';end if;
 insert into public.student_home_arrival_confirmations(school_id,student_id,attendance_id,confirmed_as,confirmed_by)
 values(sid,student,v_attendance_id,'student',null) on conflict(attendance_id) do nothing;
 select c.confirmed_at into confirmed from public.student_home_arrival_confirmations c where c.attendance_id=v_attendance_id and c.student_id=student;
 return confirmed;
end $$;

revoke all on function private.prevent_home_arrival_change(),public.home_arrival_staff_workspace(),public.set_home_arrival_enabled(boolean),public.family_home_arrival_status(uuid),public.confirm_family_home_arrival(uuid),public.student_home_arrival_status(text),public.confirm_student_home_arrival(text) from public,anon,authenticated;
grant execute on function public.home_arrival_staff_workspace(),public.set_home_arrival_enabled(boolean),public.family_home_arrival_status(uuid),public.confirm_family_home_arrival(uuid) to authenticated;
-- Student accounts use a hashed, short-lived portal token rather than a Supabase
-- auth session; these two RPCs validate that token before returning/mutating data.
grant execute on function public.student_home_arrival_status(text),public.confirm_student_home_arrival(text) to anon,authenticated;

-- Preschool relocations start as a request. Only Direction can approve before
-- the student is moved; parents receive an urgent pickup prompt without notes.
alter table public.kindergarten_relocation_cases drop constraint if exists kindergarten_relocation_cases_status_check;
alter table public.kindergarten_relocation_cases add column if not exists reviewed_by uuid references public.users(id);
alter table public.kindergarten_relocation_cases add column if not exists reviewed_role text;
alter table public.kindergarten_relocation_cases add column if not exists reviewed_at timestamptz;
alter table public.kindergarten_relocation_cases add column if not exists review_note text;
alter table public.kindergarten_relocation_cases add constraint kindergarten_relocation_cases_status_check
 check(status in ('pending_direction','active','rejected','returned_to_class','picked_up'));
alter table public.kindergarten_relocation_events drop constraint if exists kindergarten_relocation_events_event_type_check;
alter table public.kindergarten_relocation_events add constraint kindergarten_relocation_events_event_type_check
 check(event_type in ('relocation_requested','relocation_approved','relocation_rejected','relocated_to_office','parent_contact_attempt','returned_to_class','picked_up'));
alter table public.kindergarten_relocation_cases drop constraint if exists kindergarten_relocation_cases_check;
alter table public.kindergarten_relocation_cases add constraint kindergarten_relocation_cases_check
 check ((status in ('pending_direction','active','rejected') and closed_at is null and closed_by is null)
     or (status in ('returned_to_class','picked_up') and closed_at is not null and closed_by is not null));
drop index if exists public.kindergarten_one_active_relocation_per_attendance;
create unique index kindergarten_one_open_relocation_per_attendance
 on public.kindergarten_relocation_cases(attendance_id) where status in ('pending_direction','active');

create or replace function private.guard_kindergarten_relocation_case()
returns trigger language plpgsql set search_path=''
as $$
begin
 if tg_op='DELETE' then raise exception 'relocation_history_immutable';end if;
 if new.school_id is distinct from old.school_id or new.student_id is distinct from old.student_id or new.attendance_id is distinct from old.attendance_id or new.reason_category is distinct from old.reason_category or new.private_note is distinct from old.private_note or new.opened_by is distinct from old.opened_by or new.opened_name is distinct from old.opened_name or new.opened_role is distinct from old.opened_role or new.opened_at is distinct from old.opened_at then raise exception 'relocation_history_immutable';end if;
 if old.status='pending_direction' and new.status in ('active','rejected') and new.reviewed_by is not null and new.reviewed_role='director' and new.reviewed_at is not null then return new;end if;
 if old.status<>'active' or new.status not in ('returned_to_class','picked_up') or new.closed_at is null or new.closed_by is null or new.reviewed_by is distinct from old.reviewed_by or new.reviewed_at is distinct from old.reviewed_at then raise exception 'invalid_relocation_transition';end if;
 return new;
end $$;

-- Turn the existing request procedure into a pending Direction review and
-- record no physical relocation until the review succeeds.
do $request_relocation$
declare src text;old_event text;old_return text;
begin
 select pg_get_functiondef('public.start_kindergarten_relocation(uuid,text,text)'::regprocedure) into src;
 if position('pending_direction' in src)>0 then return;end if;
 src:=replace(src,
  'insert into public.kindergarten_relocation_cases(school_id,student_id,attendance_id,reason_category,private_note,opened_by,opened_name,opened_role) values(sid,p_student,att,p_reason,nullif(trim(p_note),''''),actor,coalesce(actor_name,''Staff''),coalesce(actor_role,''staff'')) returning id into case_id;',
  'insert into public.kindergarten_relocation_cases(school_id,student_id,attendance_id,reason_category,private_note,opened_by,opened_name,opened_role,status) values(sid,p_student,att,p_reason,nullif(trim(p_note),''''),actor,coalesce(actor_name,''Staff''),coalesce(actor_role,''staff''),''pending_direction'') returning id into case_id;');
 old_event:='values(sid,case_id,p_student,''relocated_to_office'',nullif(trim(p_note),''''),actor,coalesce(actor_name,''Staff''),coalesce(actor_role,''staff''));';
 if position(old_event in src)=0 then raise exception 'pending_direction_event_anchor_missing';end if;
 src:=replace(src,old_event,'values(sid,case_id,p_student,''relocation_requested'',nullif(trim(p_note),''''),actor,coalesce(actor_name,''Staff''),coalesce(actor_role,''staff''));');
 old_return:='return case_id;';
 src:=replace(src,old_return,
  'insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key) select sid,m.user_id,''kindergarten_pickup'',''Preschool relocation requires Direction review'',s.first_name||'' ''||s.last_name||'' · Please collect your child urgently and contact the school.'',''high'',''/dashboard/parent-portal'',''kindergarten-relocation-request:''||case_id::text||'':''||m.user_id::text from public.student_parents sp join public.parents p on p.id=sp.parent_id join public.students s on s.id=sp.student_id join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id and m.enabled and m.role=''parent'' where sp.student_id=p_student and p.school_id=sid on conflict do nothing;'
  ||'insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key) select sid,m.user_id,''kindergarten_relocation'',''Preschool relocation requires approval'',s.first_name||'' ''||s.last_name||'' · ''||p_reason,''high'',''/dashboard/attendance/kindergarten-pickup'',''kindergarten-relocation-review:''||case_id::text||'':''||m.user_id::text from public.students s join public.school_members m on m.school_id=sid and m.enabled and m.role=''director'' where s.id=p_student on conflict do nothing;'
  ||old_return);
 if position('pending_direction' in src)=0 then raise exception 'pending_direction_patch_failed';end if;
 execute src;
end $request_relocation$;

create or replace function public.review_kindergarten_relocation(p_case uuid,p_approve boolean,p_note text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();student uuid;actor_name text;reason text;target text;
begin
 if auth.uid() is null or sid is null or not private.has_role(sid,array['director']) then raise exception 'not_authorized';end if;
 if length(coalesce(p_note,''))>1000 or (not p_approve and length(trim(coalesce(p_note,'')))<3) then raise exception 'invalid_relocation_review';end if;
 select student_id,reason_category into student,reason from public.kindergarten_relocation_cases where id=p_case and school_id=sid and status='pending_direction' for update;
 if student is null then raise exception 'relocation_not_pending';end if;
 select full_name into actor_name from public.users where id=auth.uid();
 target:=case when p_approve then 'active' else 'rejected' end;
 update public.kindergarten_relocation_cases set status=target,reviewed_by=auth.uid(),reviewed_role='director',reviewed_at=now(),review_note=nullif(trim(p_note),'') where id=p_case;
 insert into public.kindergarten_relocation_events(school_id,case_id,student_id,event_type,private_note,actor_id,actor_name,actor_role)
 values(sid,p_case,student,case when p_approve then 'relocation_approved' else 'relocation_rejected' end,nullif(trim(p_note),''),auth.uid(),coalesce(actor_name,'Director'),'director');
 if p_approve then
  insert into public.kindergarten_relocation_events(school_id,case_id,student_id,event_type,private_note,actor_id,actor_name,actor_role)
  values(sid,p_case,student,'relocated_to_office',nullif(trim(p_note),''),auth.uid(),coalesce(actor_name,'Director'),'director');
 end if;
end $$;

-- Surface pending Direction requests and active relocations in the existing
-- private staff workspace; retain private notes only for authorized staff.
create or replace function public.kindergarten_relocation_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();actor uuid:=auth.uid();actor_name text;actor_role text;
begin
 if actor is null or sid is null or not private.can_operate_kindergarten_pickup(sid) then raise exception 'not_authorized';end if;
 select full_name into actor_name from public.users where id=actor;
 select role::text into actor_role from public.school_members where school_id=sid and user_id=actor and enabled order by case role::text when 'school_admin' then 0 when 'director' then 1 when 'secretary' then 2 when 'censeur' then 3 else 4 end limit 1;
 return jsonb_build_object('can_review_direction',private.has_role(sid,array['director']),'students',coalesce((
  select jsonb_agg(jsonb_build_object('student_id',s.id,'student',s.first_name||' '||s.last_name,'class',c.name,'attendance_id',a.id,'check_in_at',a.check_in_at,'case_id',rc.id,'case_status',rc.status,'reason_category',rc.reason_category,'private_note',rc.private_note,'opened_at',rc.opened_at,'events',coalesce((select jsonb_agg(jsonb_build_object('event_type',re.event_type,'outcome',re.outcome,'private_note',re.private_note,'actor',re.actor_name,'role',re.actor_role,'created_at',re.created_at) order by re.created_at desc) from public.kindergarten_relocation_events re where re.case_id=rc.id),'[]'::jsonb)) order by c.name,s.first_name,s.last_name)
  from public.attendance a join public.students s on s.id=a.student_id and s.school_id=a.school_id join public.classes c on c.id=a.class_id and c.school_id=a.school_id left join public.grade_levels gl on gl.id=c.grade_level_id left join public.kindergarten_pickups p on p.student_id=s.id and p.school_id=s.school_id and p.pickup_date=(now() at time zone 'America/Port-au-Prince')::date left join public.kindergarten_relocation_cases rc on rc.attendance_id=a.id and rc.status in ('pending_direction','active')
  where a.school_id=sid and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date and a.check_in_at is not null and a.check_out_at is null and a.status in ('present','late') and p.id is null and public.grade_section(coalesce(c.grade_level,gl.code))='preschool'
 ),'[]'::jsonb));
end $$;

create or replace function public.kindergarten_parent_relocation_status()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'not_authorized';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('student_id',s.id,'student',s.first_name||' '||s.last_name,'class',c.name,'message',case when rc.status='pending_direction' then 'Please collect your child urgently. The school is reviewing a temporary relocation; contact the school.' else 'Please collect your child as soon as possible. Your child is with school staff; contact the school.' end,'status',rc.status) order by s.first_name,s.last_name)
  from public.kindergarten_relocation_cases rc join public.students s on s.id=rc.student_id and s.school_id=rc.school_id join public.student_parents sp on sp.student_id=s.id join public.parents pa on pa.id=sp.parent_id and pa.school_id=s.school_id join public.school_members m on m.school_id=pa.school_id and m.user_id=pa.user_id and m.enabled and m.role='parent' join public.attendance a on a.id=rc.attendance_id and a.student_id=s.id and a.school_id=s.school_id and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date and a.check_in_at is not null and a.check_out_at is null join public.enrollments e on e.student_id=s.id and e.school_id=s.school_id and e.status='active' join public.classes c on c.id=e.class_id and c.school_id=s.school_id left join public.grade_levels gl on gl.id=c.grade_level_id
  where pa.user_id=actor and rc.status in ('pending_direction','active') and a.status in ('present','late') and public.grade_section(coalesce(c.grade_level,gl.code))='preschool' and not exists(select 1 from public.kindergarten_pickups p where p.student_id=s.id and p.school_id=s.school_id and p.pickup_date=(now() at time zone 'America/Port-au-Prince')::date)),'[]'::jsonb);
end $$;

revoke all on function private.prevent_home_arrival_change(),public.review_kindergarten_relocation(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.review_kindergarten_relocation(uuid,boolean,text) to authenticated;
