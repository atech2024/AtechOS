drop policy assignments_read on public.assignments;
drop policy assignments_write on public.assignments;
create policy assignments_read on public.assignments for select to authenticated using (private.has_role(school_id,array['school_admin','director','secretary','surveillant']) or (teacher_id=auth.uid() and private.write_academic(school_id,class_id,subject_id)) or (private.read_class(class_id) and not private.has_role(school_id,array['teacher'])));
create policy assignments_write on public.assignments for all to authenticated using (private.has_role(school_id,array['school_admin','director','secretary','surveillant']) or (teacher_id=auth.uid() and private.write_academic(school_id,class_id,subject_id))) with check (private.has_role(school_id,array['school_admin','director','secretary','surveillant']) or (teacher_id=auth.uid() and private.write_academic(school_id,class_id,subject_id)));
do $$declare src text;begin
 select pg_get_functiondef('private.student_report_cards(uuid)'::regprocedure) into src;
 src:=replace(src,'declare s public.students;begin','declare s public.students; threshold numeric;begin');
 src:=replace(src,'return jsonb_build_object(''school''','select coalesce((select passing_average from public.school_grading_settings where school_id=s.school_id),5) into threshold; return jsonb_build_object(''passing_average'',threshold,''school''');
 src:=replace(src,'r.average<6','r.average<threshold');
 src:=replace(src,'when r.average<=3 then ''parent_meeting'' ','');
 src:=replace(src,'''status'',case when not r.complete','''parent_meeting'',(r.complete and r.average<=3),''status'',case when not r.complete');execute src;
end $$;
create table private.student_badge_credentials(student_id uuid primary key references public.students(id) on delete cascade,token text not null unique default encode(extensions.gen_random_bytes(32),'hex'),updated_at timestamptz not null default now());
alter table private.student_badge_credentials enable row level security;
revoke all on private.student_badge_credentials from public,anon,authenticated;
create function public.get_student_badge_qr(p_student uuid,p_rotate boolean default false) returns text language plpgsql security definer set search_path='' as $$
declare sid uuid;val text;begin
 select school_id into sid from public.students where id=p_student;
 if sid is null or not private.has_role(sid,array['school_admin','director','secretary','surveillant']) then raise exception 'not_authorized';end if;
 insert into private.student_badge_credentials(student_id) values(p_student) on conflict do nothing;
 if p_rotate then update private.student_badge_credentials set token=encode(extensions.gen_random_bytes(32),'hex'),updated_at=now() where student_id=p_student;end if;
 select token into val from private.student_badge_credentials where student_id=p_student;return 'AOSQ1.'||val;
end $$;
revoke all on function public.get_student_badge_qr(uuid,boolean) from public,anon,authenticated;
grant execute on function public.get_student_badge_qr(uuid,boolean) to authenticated;
create table public.student_change_events(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.students(id),school_id uuid not null references public.schools(id),changed_at timestamptz not null default now(),actor_id uuid,actor_name text not null,actor_role text not null,entity text not null,fields text[] not null);
alter table public.student_change_events enable row level security;
revoke all on public.student_change_events from public,anon,authenticated;
create function private.log_student_change() returns trigger language plpgsql security definer set search_path='' as $$
declare st uuid;sid uuid;actor text;role_name text;fields text[];begin
 if tg_table_name='students' then st:=new.id;sid:=new.school_id;else st:=new.student_id;sid:=new.school_id;end if;
 select array_agg(n.key order by n.key) into fields from jsonb_each(to_jsonb(new)) n where n.key not in ('updated_at','created_at','id','school_id','student_id') and (tg_op='INSERT' or to_jsonb(old)->n.key is distinct from n.value);
 if coalesce(cardinality(fields),0)=0 then return new;end if;
 select full_name into actor from public.users where id=auth.uid();
 select role::text into role_name from public.school_members where user_id=auth.uid() and school_id=sid and enabled order by case role::text when 'school_admin' then 0 when 'director' then 1 when 'secretary' then 2 else 3 end limit 1;
 if exists(select 1 from public.schools where id=sid and owner_user_id=auth.uid()) then role_name:='school_admin';end if;
 insert into public.student_change_events(student_id,school_id,actor_id,actor_name,actor_role,entity,fields) values(st,sid,auth.uid(),coalesce(nullif(actor,''),case when auth.uid() is null then 'Système' else 'Compte scolaire' end),coalesce(role_name,'system'),tg_table_name,fields);return new;
end $$;
revoke all on function private.log_student_change() from public,anon,authenticated;
create trigger student_changes after update on public.students for each row execute function private.log_student_change();
create trigger enrollment_changes after insert or update on public.enrollments for each row execute function private.log_student_change();
create function public.student_change_history(p_student uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sid uuid;begin
 select school_id into sid from public.students where id=p_student;
 if sid is null or not private.has_role(sid,array['school_admin','director','secretary','surveillant']) then raise exception 'not_authorized';end if;
 return coalesce((select jsonb_agg(to_jsonb(e) order by changed_at desc) from public.student_change_events e where student_id=p_student),'[]');
end $$;
revoke all on function public.student_change_history(uuid) from public,anon,authenticated;
grant execute on function public.student_change_history(uuid) to authenticated;
CREATE OR REPLACE FUNCTION private.record_student_kiosk(p_student uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.students; cred private.student_credentials; cl public.classes; a public.attendance;
 ts timestamptz:=now(); d date:=(now() at time zone 'America/Port-au-Prince')::date; result text; class_count integer; window_name text:=private.kiosk_window((now() at time zone 'America/Port-au-Prince')::time);
begin
 select * into s from public.students where id=p_student and active and school_status='active';
 if s.id is null then return jsonb_build_object('error','invalid_credentials');end if;
 select count(*) into class_count from public.enrollments e join public.classes c on c.id=e.class_id join public.academic_years y on y.id=c.academic_year_id
 where e.student_id=s.id and e.status='active' and c.school_id=s.school_id and c.enabled and y.is_current;
 if class_count<>1 then return jsonb_build_object('error','current_class_required'); end if;
 select c.* into cl from public.enrollments e join public.classes c on c.id=e.class_id join public.academic_years y on y.id=c.academic_year_id
 where e.student_id=s.id and e.status='active' and c.school_id=s.school_id and c.enabled and y.is_current;
 perform pg_advisory_xact_lock(hashtextextended(s.id::text||d::text,0));
 select * into a from public.attendance where student_id=s.id and attendance_date=d for update;
 if window_name='blocked' then return jsonb_build_object('error','kiosk_closed');end if;
 if window_name='checkout' then
  if a.check_in_at is null then return jsonb_build_object('error','check_in_required');end if;
  if a.check_out_at is not null then result:='already_complete';else
   update public.attendance set check_out_at=ts,recorded_by=s.user_id,updated_at=ts where id=a.id returning * into a;result:='check_out';end if;
 elsif a.check_in_at is not null then result:='duplicate_scan';
 else
  insert into public.attendance(school_id,student_id,class_id,attendance_date,status,check_in_at,late_minutes,recorded_by)
  values(s.school_id,s.id,cl.id,d,window_name,ts,case when window_name='late' then greatest(1,floor(extract(epoch from ((ts at time zone 'America/Port-au-Prince')::time-time '07:45'))/60)::integer) else 0 end,s.user_id)
  on conflict(student_id,attendance_date) do update set status=excluded.status,check_in_at=excluded.check_in_at,late_minutes=excluded.late_minutes,recorded_by=excluded.recorded_by,updated_at=ts returning * into a;result:='check_in';
 end if;
 if result in ('check_in','check_out') then
  insert into public.attendance_events(attendance_id,student_id,source,actor_id,actor_name,actor_role,action) values(a.id,s.id,'KIOS',s.user_id,s.first_name||' '||s.last_name,'student',result);
 end if;
 return jsonb_build_object('action',result,'first_name',s.first_name,'last_name',s.last_name,'atechos_id',s.atechos_id,'class_name',cl.name,'check_in_at',a.check_in_at,'check_out_at',a.check_out_at);
end $function$;
CREATE OR REPLACE FUNCTION public.student_kiosk_scan(p_code text, p_pin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.students; cred private.student_credentials; cl public.classes; a public.attendance;
 ts timestamptz:=now(); d date:=(now() at time zone 'America/Port-au-Prince')::date; result text; class_count integer; window_name text:=private.kiosk_window((now() at time zone 'America/Port-au-Prince')::time);
begin
 if length(coalesce(p_code,''))>80 or coalesce(p_pin,'') !~ '^[0-9]{6,12}$' then return jsonb_build_object('error','invalid_credentials'); end if;
 select * into s from public.students where upper(atechos_id)=upper(trim(p_code)) and active and portal_enabled and school_status='active';
 if s.id is null then return jsonb_build_object('error','invalid_credentials'); end if;
 select * into cred from private.student_credentials where student_id=s.id for update;
 if cred.student_id is null or cred.locked_until>ts then return jsonb_build_object('error','invalid_credentials'); end if;
 if cred.pin_hash is null or cred.pin_hash<>extensions.crypt(p_pin,cred.pin_hash) then
  update private.student_credentials set failures=case when locked_until<=ts then 1 else failures+1 end,
   locked_until=case when locked_until<=ts then null when failures>=4 then ts+interval '15 minutes' else locked_until end where student_id=s.id;
  return jsonb_build_object('error','invalid_credentials');
 end if;
 update private.student_credentials set failures=0,locked_until=null where student_id=s.id;
 return private.record_student_kiosk(s.id);
end $function$;
revoke all on function private.record_student_kiosk(uuid) from public,anon,authenticated;
create function public.student_kiosk_badge(p_qr text) returns jsonb language plpgsql security definer set search_path='' as $$
declare st uuid;begin
 if coalesce(p_qr,'') !~ '^AOSQ1\.[a-f0-9]{64}$' then return jsonb_build_object('error','invalid_badge');end if;
 select student_id into st from private.student_badge_credentials where token=substring(p_qr from 7);
 if st is null then return jsonb_build_object('error','invalid_badge');end if;
 return private.record_student_kiosk(st);
end $$;
revoke all on function public.student_kiosk_badge(text) from public,anon,authenticated;
grant execute on function public.student_kiosk_badge(text) to anon,authenticated;
do $$declare src text;fn text;begin
 foreach fn in array array['assignment_roster(uuid)','set_assignment_online(uuid,boolean)','mark_assignment_received(uuid,uuid,boolean)'] loop
 select pg_get_functiondef(('public.'||fn)::regprocedure) into src;
 src:=replace(src,'not private.write_academic(a.school_id,a.class_id,a.subject_id)','not (private.has_role(a.school_id,array[''school_admin'',''director'',''secretary'',''surveillant'']) or (a.teacher_id=auth.uid() and private.write_academic(a.school_id,a.class_id,a.subject_id)))');execute src;
 end loop;
 select pg_get_functiondef('public.student_portal_overview(text)'::regprocedure) into src;
 src:=replace(src,'return base||jsonb_build_object','return base||jsonb_build_object(''badge_qr'',(select ''AOSQ1.''||token from private.student_badge_credentials where student_id=s.id),''changes'',coalesce((select jsonb_agg(to_jsonb(e) order by changed_at desc) from public.student_change_events e where student_id=s.id),''[]''))||jsonb_build_object');execute src;
end $$;
