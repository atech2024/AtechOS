-- Collective sanctions, parent-selected meeting slots, and safe access handling.
create table public.student_sanction_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  school_entry_time time not null,
  school_departure_time time not null,
  updated_by uuid references public.users(id),
  updated_at timestamptz not null default now(),
  constraint student_sanction_school_hours_check check (school_entry_time < school_departure_time)
);
alter table public.student_sanction_settings enable row level security;
revoke all on public.student_sanction_settings from public, anon, authenticated;

alter table public.student_sanctions
  add column parent_meeting_deadline timestamptz,
  add column parent_meeting_at timestamptz,
  add column parent_meeting_selected_by uuid references public.users(id),
  add column departure_decision text not null default 'not_applicable'
    check (departure_decision in ('not_applicable','pending_meeting','retained','departed')),
  add column departure_decided_by uuid references public.users(id),
  add column departure_decided_at timestamptz;
alter table public.attendance
  add column direction_only boolean not null default false;

-- Old departure actions already set school_status=departed; preserve them as final.
update public.student_sanctions x set departure_decision='departed',
  status=case when x.status='active' then 'resolved' else x.status end,
  resolved_at=case when x.status='active' then coalesce(x.resolved_at,now()) else x.resolved_at end,
  resolution=case when x.status='active' then coalesce(x.resolution,'Legacy permanent-departure sanction confirmed before decision tracking.') else x.resolution end
where x.action_code='school_departure' and exists (
  select 1 from public.students s where s.id=x.student_id and s.school_status='departed'
);

create or replace function private.student_sanction_restriction(p_student uuid,p_scope text)
returns text language sql stable security definer set search_path=''
as $$
  select case
    when exists(select 1 from public.student_sanctions x where x.student_id=p_student and x.status='active'
      and x.action_code='student_suspension' and x.action_started_at<=now() and x.action_until>now())
      then 'sanction_student_suspended'
    when exists(select 1 from public.student_sanctions x where x.student_id=p_student and x.status='active'
      and x.action_code='school_departure' and x.departure_decision='pending_meeting')
      then 'sanction_school_departure_pending'
    when exists(select 1 from public.student_sanctions x where x.student_id=p_student and x.status='active'
      and x.action_code='parent_meeting')
      then 'sanction_parent_meeting'
    when p_scope in ('kiosk','portal') and exists(select 1 from public.student_sanctions x where x.student_id=p_student and x.status='active'
      and x.action_code='kiosk_suspension' and x.action_started_at<=now() and x.action_until>now())
      then 'sanction_kiosk_suspended'
    else null end
$$;
revoke all on function private.student_sanction_restriction(uuid,text) from public,anon,authenticated;

create or replace function private.student_sanction_requires_direction(p_student uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.student_sanctions x where x.student_id=p_student and x.status='active'
   and (x.action_code in ('parent_meeting','student_suspension') or (x.action_code='school_departure' and x.departure_decision='pending_meeting')))
$$;
revoke all on function private.student_sanction_requires_direction(uuid) from public,anon,authenticated;

create or replace function private.student_sanction_kiosk_gate(p_student uuid,p_now timestamptz,p_already_inside boolean)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid; action text; return_at timestamptz; meeting_at timestamptz; deadline timestamptz;
        direction boolean:=false; meeting_window boolean:=false; local_day date:=(p_now at time zone 'America/Port-au-Prince')::date;
        local_time time:=(p_now at time zone 'America/Port-au-Prince')::time; entry_time time; close_time time;
begin
  select school_id into sid from public.students where id=p_student and active and school_status='active';
  if sid is null then return jsonb_build_object('error','invalid_credentials'); end if;
  select x.action_code,x.action_until,x.parent_meeting_at,x.parent_meeting_deadline
    into action,return_at,meeting_at,deadline
  from public.student_sanctions x
  where x.student_id=p_student and x.status='active'
    and (x.action_code='student_suspension' and x.action_started_at<=p_now and x.action_until>p_now
      or x.action_code='kiosk_suspension' and x.action_started_at<=p_now and x.action_until>p_now
      or x.action_code='parent_meeting'
      or x.action_code='school_departure' and x.departure_decision='pending_meeting')
  order by case x.action_code when 'school_departure' then 0 when 'student_suspension' then 1 when 'kiosk_suspension' then 2 else 3 end,
    x.incident_at desc limit 1;

  if action is null then return jsonb_build_object('direction_only',false,'allow_exit',false); end if;
  if p_already_inside then
    return jsonb_build_object('direction_only',false,
      'allow_exit',private.kiosk_window(local_time)='checkout',
      'sanction_action',action,'return_at',return_at);
  end if;
  if action='kiosk_suspension' then
    return jsonb_build_object('error','sanction_kiosk_suspended','sanction_action',action,'return_at',return_at);
  end if;
  if meeting_at is null then
    return jsonb_build_object('error',case when action='student_suspension' then 'sanction_student_suspended' else 'sanction_meeting_required' end,
      'sanction_action',action,'return_at',case when action='student_suspension' then return_at else deadline end);
  end if;
  if meeting_at < p_now - interval '30 minutes' then
    return jsonb_build_object('error',case when action='student_suspension' then 'sanction_student_suspended' else 'sanction_meeting_overdue' end,
      'sanction_action',action,'return_at',return_at);
  end if;
  if (meeting_at at time zone 'America/Port-au-Prince')::date<>local_day then
    return jsonb_build_object('error',case when action='student_suspension' then 'sanction_student_suspended' else 'sanction_meeting_not_today' end,
      'sanction_action',action,'return_at',meeting_at);
  end if;
  select school_entry_time,school_departure_time into entry_time,close_time
    from public.student_sanction_settings where school_id=sid;
  meeting_window:=meeting_at between p_now-interval '30 minutes' and p_now+interval '30 minutes' and (meeting_at at time zone 'America/Port-au-Prince')::date=local_day
    and private.guard_school_day(sid,local_day) and entry_time is not null and local_time between entry_time and close_time;
  if not meeting_window then
    return jsonb_build_object('error',case when action='student_suspension' then 'sanction_student_suspended' else 'sanction_meeting_window' end,
      'sanction_action',action,'return_at',meeting_at);
  end if;
  direction:=true;
  return jsonb_build_object('direction_only',direction,'allow_exit',false,'meeting_window',meeting_window,
    'sanction_action',action,'return_at',meeting_at);
end $$;
revoke all on function private.student_sanction_kiosk_gate(uuid,timestamptz,boolean) from public,anon,authenticated;

create or replace function public.save_student_sanction_hours(p_entry time,p_departure time)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();
begin
  if not private.student_followup_authority(sid)
    or not private.has_role(sid,array['school_admin','director']) then raise exception 'not_authorized'; end if;
  if p_entry is null or p_departure is null or p_entry>=p_departure then raise exception 'invalid_school_hours'; end if;
  insert into public.student_sanction_settings(school_id,school_entry_time,school_departure_time,updated_by,updated_at)
  values(sid,p_entry,p_departure,auth.uid(),now())
  on conflict(school_id) do update set school_entry_time=excluded.school_entry_time,
    school_departure_time=excluded.school_departure_time,updated_by=auth.uid(),updated_at=now();
  perform private.student_followup_event(sid,null,'sanction_settings',sid,'school_hours_updated',
    jsonb_build_object('school_entry_time',p_entry,'school_departure_time',p_departure));
end $$;
revoke all on function public.save_student_sanction_hours(time,time) from public,anon;
grant execute on function public.save_student_sanction_hours(time,time) to authenticated;

create or replace function private.create_student_sanction_record(p_student uuid,p_type uuid,p_reason text,p_incident_at timestamptz)
returns uuid language plpgsql security definer set search_path=''
as $$
declare sid uuid; rid uuid; action text; duration smallint; action_end timestamptz; deadline timestamptz; departure text;
begin
  select school_id into sid from public.students where id=p_student and active and school_status='active';
  if sid is null or not private.student_followup_authority(sid) then raise exception 'student_not_found'; end if;
  if length(trim(coalesce(p_reason,''))) not between 3 and 2000 or p_incident_at is null or p_incident_at>now()
    then raise exception 'invalid_sanction'; end if;
  select action_code,action_duration_days into action,duration from public.student_sanction_types
    where id=p_type and school_id=sid and active;
  if action is null then raise exception 'sanction_type_not_found'; end if;
  if action in ('kiosk_suspension','student_suspension') then action_end:=now()+make_interval(days=>duration); end if;
  if action in ('parent_meeting','student_suspension','school_departure') then deadline:=private.guard_school_deadline(sid,now(),3); end if;
  departure:=case when action='school_departure' then 'pending_meeting' else 'not_applicable' end;
  insert into public.student_sanctions(school_id,student_id,sanction_type_id,incident_at,reason,created_by,created_role,
    action_code,action_started_at,action_until,parent_meeting_deadline,departure_decision)
  values(sid,p_student,p_type,p_incident_at,trim(p_reason),auth.uid(),private.student_followup_actor_role(sid),
    action,case when action in ('kiosk_suspension','student_suspension') then now() end,action_end,deadline,departure)
  returning id into rid;
  if action in ('student_suspension','parent_meeting','school_departure') then
    delete from private.student_sessions where student_id=p_student;
  end if;
  perform private.student_followup_event(sid,p_student,'sanction',rid,'created',
    jsonb_build_object('type_id',p_type,'incident_at',p_incident_at,'action_code',action,
      'action_duration_days',duration,'action_until',action_end,'parent_meeting_deadline',deadline,'departure_decision',departure));
  if action in ('parent_meeting','student_suspension','school_departure') then
    insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
    select sid,p.user_id,'student_followup','Rendez-vous avec la famille requis',
      'Choisissez une date et une heure de rendez-vous dans le portail familial.', 'high',
      '/dashboard/parent-portal','sanction-meeting:'||rid::text||':'||p.user_id::text
    from public.student_parents sp join public.parents p on p.id=sp.parent_id
    where sp.student_id=p_student and p.school_id=sid and p.user_id is not null
    on conflict(school_id,recipient_id,event_key) do nothing;
  end if;
  return rid;
end $$;
revoke all on function private.create_student_sanction_record(uuid,uuid,text,timestamptz) from public,anon,authenticated;

create or replace function public.create_student_sanction(p_student uuid,p_type uuid,p_reason text,p_incident_at timestamptz default now())
returns uuid language plpgsql security definer set search_path=''
as $$
begin
  if not exists(select 1 from public.students s where s.id=p_student and private.student_followup_authority(s.school_id)) then raise exception 'not_authorized'; end if;
  return private.create_student_sanction_record(p_student,p_type,p_reason,p_incident_at);
end $$;
revoke all on function public.create_student_sanction(uuid,uuid,text,timestamptz) from public,anon;
grant execute on function public.create_student_sanction(uuid,uuid,text,timestamptz) to authenticated;

create function public.create_student_sanctions_bulk(p_students uuid[],p_type uuid,p_reason text,p_incident_at timestamptz)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); st uuid; ids uuid[]:='{}'; n integer:=0;
begin
  if not private.student_followup_authority(sid) then raise exception 'not_authorized'; end if;
  if coalesce(cardinality(p_students),0) not between 1 and 100 or cardinality(p_students)<>(select count(distinct student_id) from unnest(p_students) as selected(student_id)) then
    raise exception 'invalid_student_selection';
  end if;
  if exists(select 1 from unnest(p_students) x left join public.students s on s.id=x where s.id is null or s.school_id<>sid or not s.active or s.school_status<>'active') then
    raise exception 'student_not_found';
  end if;
  foreach st in array p_students loop
    ids:=array_append(ids,private.create_student_sanction_record(st,p_type,p_reason,p_incident_at)); n:=n+1;
  end loop;
  return jsonb_build_object('created_count',n,'sanction_ids',to_jsonb(ids));
end $$;
revoke all on function public.create_student_sanctions_bulk(uuid[],uuid,text,timestamptz) from public,anon;
grant execute on function public.create_student_sanctions_bulk(uuid[],uuid,text,timestamptz) to authenticated;

create function public.student_followup_class_attendees(p_class uuid,p_day date)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); result jsonb;
begin
  if not private.student_followup_authority(sid) then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.classes c join public.academic_years y on y.id=c.academic_year_id
    where c.id=p_class and c.school_id=sid and c.enabled and y.is_current)
    then raise exception 'class_not_found'; end if;
  if p_day is null or not private.guard_school_day(sid,p_day) or p_day>(now() at time zone 'America/Port-au-Prince')::date
    then raise exception 'invalid_school_day'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.first_name||' '||s.last_name,'status',a.status)
    order by s.last_name,s.first_name),'[]'::jsonb) into result
  from public.attendance a join public.students s on s.id=a.student_id
  where a.school_id=sid and a.class_id=p_class and a.attendance_date=p_day
    and a.check_in_at is not null and a.status in ('present','late') and not a.direction_only
    and s.school_id=sid and s.active and s.school_status='active';
  return result;
end $$;
revoke all on function public.student_followup_class_attendees(uuid,date) from public,anon;
grant execute on function public.student_followup_class_attendees(uuid,date) to authenticated;

create function public.create_class_student_sanctions(p_class uuid,p_type uuid,p_reason text,p_incident_at timestamptz,p_expected_students uuid[])
returns jsonb language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); day date; st uuid; n integer:=0; ids uuid[]:='{}'; expected_ids uuid[]; actual_ids uuid[];
begin
  if not private.student_followup_authority(sid) then raise exception 'not_authorized'; end if;
  if p_incident_at is null or p_incident_at>now() then raise exception 'invalid_sanction'; end if;
  if coalesce(cardinality(p_expected_students),0) not between 1 and 100
    or cardinality(p_expected_students)<>(select count(distinct student_id) from unnest(p_expected_students) as selected(student_id)) then
    raise exception 'invalid_student_selection';
  end if;
  day:=(p_incident_at at time zone 'America/Port-au-Prince')::date;
  if not private.guard_school_day(sid,day) then raise exception 'invalid_school_day'; end if;
  if not exists(select 1 from public.classes c join public.academic_years y on y.id=c.academic_year_id
    where c.id=p_class and c.school_id=sid and c.enabled and y.is_current) then raise exception 'class_not_found'; end if;
  select array_agg(x order by x) into expected_ids from unnest(p_expected_students) as selected(x);
  select coalesce(array_agg(q.student_id order by q.student_id),'{}'::uuid[]) into actual_ids from (
    select s.id as student_id from public.attendance a join public.students s on s.id=a.student_id
    where a.school_id=sid and a.class_id=p_class and a.attendance_date=day and a.check_in_at is not null
      and a.status in ('present','late') and not a.direction_only and s.school_id=sid and s.active and s.school_status='active'
  ) q;
  if actual_ids is distinct from expected_ids then raise exception 'class_attendance_changed'; end if;
  foreach st in array expected_ids loop
    ids:=array_append(ids,private.create_student_sanction_record(st,p_type,p_reason,p_incident_at)); n:=n+1;
  end loop;
  return jsonb_build_object('created_count',n,'sanction_ids',to_jsonb(ids),'attendance_date',day);
end $$;
revoke all on function public.create_class_student_sanctions(uuid,uuid,text,timestamptz,uuid[]) from public,anon;
grant execute on function public.create_class_student_sanctions(uuid,uuid,text,timestamptz,uuid[]) to authenticated;

create or replace function public.student_followup_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); result jsonb;
begin
 if not private.student_followup_authority(sid) then raise exception 'not_authorized'; end if;
 select jsonb_build_object(
  'students',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.first_name||' '||s.last_name,'atechos_id',s.atechos_id,'class',cl.name)
    order by cl.name,s.last_name,s.first_name) from public.students s
    left join lateral (select c.name from public.enrollments e join public.classes c on c.id=e.class_id join public.academic_years y on y.id=c.academic_year_id
      where e.student_id=s.id and e.status='active' and c.school_id=s.school_id and y.is_current order by c.name limit 1) cl on true
    where s.school_id=sid and s.active and s.school_status='active'),'[]'::jsonb),
  'classes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name)
    from public.classes c join public.academic_years y on y.id=c.academic_year_id
    where c.school_id=sid and c.enabled and y.is_current),'[]'::jsonb),
  'sanction_settings',(select jsonb_build_object('school_entry_time',school_entry_time,'school_departure_time',school_departure_time)
    from public.student_sanction_settings where school_id=sid),
  'sanction_types',coalesce((select jsonb_agg(to_jsonb(t)-'school_id'-'created_by'-'updated_by' order by t.name)
    from public.student_sanction_types t where t.school_id=sid),'[]'::jsonb),
  'sanctions',coalesce((select jsonb_agg(to_jsonb(q)-'school_id'-'created_by' order by q.incident_at desc)
    from (select x.*,s.first_name||' '||s.last_name as student from public.student_sanctions x
      join public.students s on s.id=x.student_id where x.school_id=sid order by x.incident_at desc limit 300) q),'[]'::jsonb),
  'contacts',coalesce((select jsonb_agg(to_jsonb(c)-'school_id'-'created_by'-'updated_by' order by s.last_name,s.first_name,c.full_name)
    from public.student_release_contacts c join public.students s on s.id=c.student_id where c.school_id=sid),'[]'::jsonb),
  'releases',coalesce((select jsonb_agg(to_jsonb(q)-'school_id' order by q.requested_at desc)
    from (select x.*,s.first_name||' '||s.last_name as student from public.student_release_cases x
      join public.students s on s.id=x.student_id where x.school_id=sid order by x.requested_at desc limit 300) q),'[]'::jsonb)
 ) into result;
 return result;
end $$;

create or replace function public.family_student_sanctions(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid; rows jsonb; settings public.student_sanction_settings; slots jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select s.school_id into sid from public.students s where s.id=p_student_id;
  if sid is null or not private.finance_parent_linked(sid,p_student_id,auth.uid()) then raise exception 'not_authorized'; end if;
  select * into settings from public.student_sanction_settings where school_id=sid;
  if settings.school_id is not null then
    select coalesce(jsonb_agg(to_jsonb(q.slot_at) order by q.slot_at),'[]'::jsonb) into slots
    from (
      select ((days.d + times.t::time) at time zone 'America/Port-au-Prince') as slot_at
      from generate_series(
        (now() at time zone 'America/Port-au-Prince')::date+1,
        (private.guard_school_deadline(sid,now(),3) at time zone 'America/Port-au-Prince')::date,
        interval '1 day') days(d)
      cross join lateral generate_series(settings.school_entry_time::timestamp,settings.school_departure_time::timestamp,interval '30 minutes') times(t)
      where private.guard_school_day(sid,days.d::date)
        and times.t<settings.school_departure_time::timestamp
        and (days.d::date+times.t::time) > (now() at time zone 'America/Port-au-Prince')
        and (days.d::date+times.t::time) <= (private.guard_school_deadline(sid,now(),3) at time zone 'America/Port-au-Prince')::timestamp
    ) q;
  else slots:='[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'type',q.type_name,'incident_at',q.incident_at,'reason',q.reason,
    'status',q.status,'resolved_at',q.resolved_at,'resolution',q.resolution,
    'action_code',q.action_code,'action_until',q.action_until,
    'parent_meeting_deadline',q.parent_meeting_deadline,'parent_meeting_at',q.parent_meeting_at,
    'departure_decision',q.departure_decision
  ) order by q.incident_at desc,q.id desc),'[]'::jsonb) into rows
  from (
    select x.id,t.name as type_name,x.incident_at,x.reason,x.status,x.resolved_at,x.resolution,
      x.action_code,x.action_until,x.parent_meeting_deadline,x.parent_meeting_at,x.departure_decision
    from public.student_sanctions x join public.student_sanction_types t on t.id=x.sanction_type_id and t.school_id=sid
    where x.school_id=sid and x.student_id=p_student_id order by x.incident_at desc,x.id desc limit 100
  ) q;
  return jsonb_build_object('student_id',p_student_id,'sanctions',coalesce(rows,'[]'::jsonb),'meeting_options',coalesce(slots,'[]'::jsonb));
end $$;
revoke all on function public.family_student_sanctions(uuid) from public,anon;
grant execute on function public.family_student_sanctions(uuid) to authenticated;

create function public.submit_student_sanction_meeting(p_sanction uuid,p_meeting_at timestamptz)
returns void language plpgsql security definer set search_path=''
as $$
declare x public.student_sanctions; sid uuid; settings public.student_sanction_settings; local_at timestamp; parent_user uuid;
begin
  select * into x from public.student_sanctions where id=p_sanction for update;
  if x.id is null then raise exception 'sanction_not_found'; end if;
  sid:=x.school_id;
  if not private.finance_parent_linked(sid,x.student_id,auth.uid()) then raise exception 'not_authorized'; end if;
  if x.status<>'active' or x.action_code not in ('parent_meeting','student_suspension','school_departure')
    or (x.action_code='school_departure' and x.departure_decision<>'pending_meeting') then raise exception 'sanction_meeting_not_open'; end if;
  if x.parent_meeting_at is not null then raise exception 'sanction_meeting_already_selected'; end if;
  if x.parent_meeting_deadline is null or p_meeting_at is null or p_meeting_at<=now() or p_meeting_at>x.parent_meeting_deadline then raise exception 'invalid_sanction_meeting_time'; end if;
  select * into settings from public.student_sanction_settings where school_id=sid;
  if settings.school_id is null then raise exception 'school_hours_not_configured'; end if;
  local_at:=p_meeting_at at time zone 'America/Port-au-Prince';
  if not private.guard_school_day(sid,local_at::date)
    or local_at::date<(private.guard_school_deadline(sid,now(),1) at time zone 'America/Port-au-Prince')::date
    or local_at::time<settings.school_entry_time or local_at::time>=settings.school_departure_time
    or mod(extract(epoch from (local_at::time-settings.school_entry_time)),1800)<>0 then
    raise exception 'invalid_sanction_meeting_time';
  end if;
  update public.student_sanctions set parent_meeting_at=p_meeting_at,parent_meeting_selected_by=auth.uid()
  where id=x.id;
  perform private.student_followup_event(sid,x.student_id,'sanction',x.id,'parent_meeting_selected',jsonb_build_object('meeting_at',p_meeting_at));
  insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
  select sid,m.user_id,'student_followup','Rendez-vous familial choisi',
    'La famille a choisi une date pour le rendez-vous de suivi. Consultez le dossier de l’élève.',
    'high','/dashboard/sanctions','sanction-meeting-selected:'||x.id::text||':'||m.user_id::text
  from public.school_members m where m.school_id=sid and m.enabled and m.role in ('director','school_admin','secretary')
  on conflict(school_id,recipient_id,event_key) do nothing;
end $$;
revoke all on function public.submit_student_sanction_meeting(uuid,timestamptz) from public,anon;
grant execute on function public.submit_student_sanction_meeting(uuid,timestamptz) to authenticated;

create function public.decide_student_sanction_departure(p_sanction uuid,p_decision text,p_resolution text)
returns void language plpgsql security definer set search_path=''
as $$
declare x public.student_sanctions; sid uuid; current_year uuid;
begin
  select * into x from public.student_sanctions where id=p_sanction for update;
  if x.id is null then raise exception 'sanction_not_found'; end if;
  sid:=x.school_id;
  if not private.student_followup_authority(sid) or not private.has_role(sid,array['director','school_admin']) then raise exception 'not_authorized'; end if;
  if x.action_code<>'school_departure' or x.status<>'active' or x.departure_decision<>'pending_meeting' then raise exception 'sanction_departure_not_pending'; end if;
  if x.parent_meeting_at is null then raise exception 'parent_meeting_required'; end if;
  if p_decision not in ('retained','departed') or length(trim(coalesce(p_resolution,''))) not between 3 and 2000 then raise exception 'invalid_departure_decision'; end if;
  if p_decision='departed' then
    select id into current_year from public.academic_years where school_id=sid and is_current;
    update public.students set school_status='departed',departure_year_id=current_year where id=x.student_id and school_id=sid;
  end if;
  update public.student_sanctions set departure_decision=p_decision,status='resolved',resolved_by=auth.uid(),resolved_at=now(),
    resolution=trim(p_resolution),departure_decided_by=auth.uid(),departure_decided_at=now()
  where id=x.id;
  perform private.student_followup_event(sid,x.student_id,'sanction',x.id,
    case when p_decision='departed' then 'school_departure_confirmed' else 'school_departure_cancelled' end,
    jsonb_build_object('decision',p_decision,'resolution',trim(p_resolution)));
end $$;
revoke all on function public.decide_student_sanction_departure(uuid,text,text) from public,anon;
grant execute on function public.decide_student_sanction_departure(uuid,text,text) to authenticated;

create or replace function public.resolve_student_sanction(p_sanction uuid,p_resolution text)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid; student uuid; action text;
begin
 select school_id,student_id,action_code into sid,student,action from public.student_sanctions where id=p_sanction for update;
 if sid is null or not private.student_followup_authority(sid) then raise exception 'not_authorized'; end if;
 if length(trim(coalesce(p_resolution,''))) not between 3 and 2000 then raise exception 'resolution_required'; end if;
 if action='school_departure' then raise exception 'use_departure_decision'; end if;
 update public.student_sanctions set status='resolved',resolved_by=auth.uid(),resolved_at=now(),resolution=trim(p_resolution)
 where id=p_sanction and status='active';
 if not found then raise exception 'sanction_not_active'; end if;
 perform private.student_followup_event(sid,student,'sanction',p_sanction,'resolved',jsonb_build_object('resolution',trim(p_resolution)));
end $$;

-- Patch the shared recorder so existing students can always leave campus,
-- while re-entry and scheduled class attendance obey the active sanction.
do $sanction_kiosk$
declare src text; old_guard text; attendance_anchor text; blocked_anchor text; return_anchor text;
begin
  select pg_get_functiondef('private.record_student_kiosk(uuid)'::regprocedure) into src;
  old_guard:='if private.student_sanction_restriction(s.id,''kiosk'') is not null then return jsonb_build_object(''error'',private.student_sanction_restriction(s.id,''kiosk'')); end if;';
  if position('student_sanction_kiosk_gate' in src)=0 then
    if position(old_guard in src)=0 then raise exception 'collective_sanction_existing_kiosk_guard_missing'; end if;
    src:=replace(src,old_guard,'');
    src:=regexp_replace(src,'declare','declare gate jsonb; is_direction_only boolean:=false;','i');
    if position('is_direction_only' in src)=0 then raise exception 'collective_sanction_kiosk_declaration_anchor_missing'; end if;
    attendance_anchor:='select * into a from public.attendance where student_id=s.id and attendance_date=d for update;';
    if position(attendance_anchor in src)=0 then raise exception 'collective_sanction_kiosk_attendance_anchor_missing'; end if;
    src:=replace(src,attendance_anchor,attendance_anchor||
      'gate:=private.student_sanction_kiosk_gate(s.id,ts,a.check_in_at is not null and a.check_out_at is null); if gate ? ''error'' then return gate; end if; is_direction_only:=coalesce((gate->>''direction_only'')::boolean,false) or coalesce(a.direction_only,false); if coalesce((gate->>''meeting_window'')::boolean,false) and not coalesce((gate->>''allow_exit'')::boolean,false) then window_name:=''present''; end if; if coalesce((gate->>''allow_exit'')::boolean,false) then window_name:=''checkout''; end if;');
    src:=regexp_replace(src,
      'insert into public[.]attendance[[:space:]]*[(][^)]*recorded_by[[:space:]]*[)]',
      'insert into public.attendance(school_id,student_id,class_id,attendance_date,status,check_in_at,late_minutes,recorded_by,direction_only)','i');
    src:=regexp_replace(src,
      'end[[:space:]]*,[[:space:]]*s[.]user_id[[:space:]]*[)]',
      'end,s.user_id,is_direction_only)','i');
    src:=regexp_replace(src,
      'late_minutes[[:space:]]*=[[:space:]]*excluded[.]late_minutes[[:space:]]*,[[:space:]]*recorded_by[[:space:]]*=[[:space:]]*excluded[.]recorded_by[[:space:]]*,[[:space:]]*updated_at[[:space:]]*=[[:space:]]*ts',
      'late_minutes=excluded.late_minutes,recorded_by=excluded.recorded_by,direction_only=excluded.direction_only,updated_at=ts','i');
    if position('direction_only=excluded.direction_only' in src)=0
      or position('recorded_by,direction_only' in src)=0
      or position('is_direction_only)' in src)=0 then
      raise exception 'collective_sanction_direction_attendance_patch_failed columns=%, values=%, assignment=%, insert=%',
        position('recorded_by,direction_only' in src),position('is_direction_only)' in src),
        position('direction_only=excluded.direction_only' in src),
        substring(src from greatest(position('insert into public.attendance' in src)-30,1) for 700);
    end if;
    blocked_anchor:='if window_name=''blocked'' then return jsonb_build_object(''error'',''kiosk_closed'');end if;';
    if position(blocked_anchor in src)=0 then raise exception 'collective_sanction_kiosk_blocked_anchor_missing'; end if;
    src:=replace(src,blocked_anchor,'if window_name=''blocked'' then if gate ? ''sanction_action'' then return jsonb_build_object(''error'',''sanction_checkout_not_open'',''sanction_action'',gate->>''sanction_action'',''return_at'',gate->>''return_at''); end if; return jsonb_build_object(''error'',''kiosk_closed'');end if;');
    return_anchor:='if result in (''check_in'',''duplicate_scan'',''check_out'') then perform private.capture_exam_presence(s.id,cl.id,ts);end if; return jsonb_build_object(''school_release_protocol_active'',protocol_id is not null and not private.is_preschool_student(s.id),''guard_meeting_required'',exists(select 1 from public.guard_cases g where g.student_id=s.id and g.status=''meeting'' and g.meeting_due>ts),''action'',result,';
    if position(return_anchor in src)=0 then raise exception 'collective_sanction_kiosk_result_anchor_missing'; end if;
    src:=replace(src,return_anchor,'if result in (''check_in'',''duplicate_scan'',''check_out'') and not is_direction_only then perform private.capture_exam_presence(s.id,cl.id,ts);end if; return jsonb_build_object(''direction_only'',is_direction_only,''sanction_action'',gate->>''sanction_action'',''sanction_return_at'',gate->>''return_at'',''school_release_protocol_active'',protocol_id is not null and not private.is_preschool_student(s.id),''guard_meeting_required'',exists(select 1 from public.guard_cases g where g.student_id=s.id and g.status=''meeting'' and g.meeting_due>ts),''action'',result,');
    if position('student_sanction_kiosk_gate' in src)=0 then raise exception 'collective_sanction_kiosk_patch_failed'; end if;
    execute src;
  end if;
end $sanction_kiosk$;

-- Keep the existing attendance RPCs intact while preventing an active meeting sanction
-- from being entered into class by either staff UI or another attendance writer.
create or replace function private.enforce_student_sanction_direction()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.status in ('present','late') and not coalesce(new.direction_only,false)
    and private.student_sanction_requires_direction(new.student_id) then
    raise exception 'student_at_direction';
  end if;
  return new;
end $$;
revoke all on function private.enforce_student_sanction_direction() from public,anon,authenticated;
drop trigger if exists attendance_student_sanction_direction on public.attendance;
create trigger attendance_student_sanction_direction
  before insert or update of status,direction_only on public.attendance
  for each row execute function private.enforce_student_sanction_direction();
