-- Synthetic-only integration check. Every row and helper is rolled back.
begin;

-- The small CI baseline predates the class exam calendar. Supply only the
-- relations that school_calendar needs to compile when this fixture calls it.
create table if not exists public.subjects (id uuid primary key, name text not null, active boolean not null default true);
create table if not exists public.class_subjects (school_id uuid, class_id uuid, subject_id uuid, teacher_id uuid);
create table if not exists public.exam_schedule (id uuid primary key, school_id uuid, class_id uuid, subject_id uuid, period_id uuid, starts_at timestamptz, ends_at timestamptz, published_version_id uuid, cancelled boolean);
create table if not exists public.exam_schedule_versions (id uuid primary key, version integer, published_at timestamptz, revision_start date, revision_end date);
create table if not exists public.exam_presence (exam_id uuid, version_id uuid, student_id uuid, scanned_at timestamptz);
create or replace function private.calendar_student_class(p_student uuid,p_class uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.enrollments where student_id=p_student and class_id=p_class and status<>'transferred')
$$;
create or replace function public.student_device_data(p_token text) returns jsonb
language sql stable security definer set search_path='' as $$
 select case when p_token='synthetic-student-token' then
  jsonb_build_object('student',jsonb_build_object('id','81000000-0000-0000-0000-000000000001'))
 else null end
$$;

insert into public.schools(id,name) values
 ('71000000-0000-0000-0000-000000000011','Synthetic first school'),
 ('71000000-0000-0000-0000-000000000012','Synthetic second school');
insert into public.users(id,full_name) values
 ('72000000-0000-0000-0000-000000000011','Synthetic Director One'),
 ('72000000-0000-0000-0000-000000000012','Synthetic Teacher One'),
 ('72000000-0000-0000-0000-000000000013','Synthetic Parent One'),
 ('72000000-0000-0000-0000-000000000014','Synthetic Director Two'),
 ('72000000-0000-0000-0000-000000000015','Synthetic Parent Two');
insert into public.school_members(school_id,user_id,role) values
 ('71000000-0000-0000-0000-000000000011','72000000-0000-0000-0000-000000000011','director'),
 ('71000000-0000-0000-0000-000000000011','72000000-0000-0000-0000-000000000012','teacher'),
 ('71000000-0000-0000-0000-000000000011','72000000-0000-0000-0000-000000000013','parent'),
 ('71000000-0000-0000-0000-000000000012','72000000-0000-0000-0000-000000000014','director'),
 ('71000000-0000-0000-0000-000000000012','72000000-0000-0000-0000-000000000015','parent');
insert into public.academic_years(id,school_id,name,start_date,end_date,is_current) values
 ('73000000-0000-0000-0000-000000000011','71000000-0000-0000-0000-000000000011','2026/2027','2026-09-01','2027-06-30',true),
 ('73000000-0000-0000-0000-000000000012','71000000-0000-0000-0000-000000000012','2026/2027','2026-09-01','2027-06-30',true);
insert into public.classes(id,school_id,academic_year_id,grade_level,name,enabled) values
 ('74000000-0000-0000-0000-000000000011','71000000-0000-0000-0000-000000000011','73000000-0000-0000-0000-000000000011','AF9','Synthetic AF9 One',true),
 ('74000000-0000-0000-0000-000000000012','71000000-0000-0000-0000-000000000012','73000000-0000-0000-0000-000000000012','AF9','Synthetic AF9 Two',true);
insert into public.subjects(id,name) values('75000000-0000-0000-0000-000000000011','Synthetic subject');
insert into public.class_subjects(school_id,class_id,subject_id,teacher_id) values
 ('71000000-0000-0000-0000-000000000011','74000000-0000-0000-0000-000000000011','75000000-0000-0000-0000-000000000011','72000000-0000-0000-0000-000000000012');
insert into public.grading_periods(id,school_id,academic_year_id,code,start_date,end_date,sections) values
 ('76000000-0000-0000-0000-000000000011','71000000-0000-0000-0000-000000000011','73000000-0000-0000-0000-000000000011','CI','2027-03-01','2027-03-31',array['fundamental']);
insert into public.exam_schedule_versions(id,version,published_at) values
 ('77000000-0000-0000-0000-000000000011',1,'2027-02-01T12:00:00Z');
insert into public.exam_schedule(id,school_id,class_id,subject_id,period_id,starts_at,ends_at,published_version_id,cancelled) values
 ('78000000-0000-0000-0000-000000000011','71000000-0000-0000-0000-000000000011','74000000-0000-0000-0000-000000000011','75000000-0000-0000-0000-000000000011','76000000-0000-0000-0000-000000000011','2027-03-10T13:00:00Z','2027-03-10T15:00:00Z','77000000-0000-0000-0000-000000000011',false);
insert into public.students(id,school_id,first_name,last_name) values
 ('81000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000011','Synthetic','Student One'),
 ('81000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000012','Synthetic','Student Two');
insert into public.enrollments(id,school_id,student_id,class_id,status) values
 ('82000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000011','81000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000011','active'),
 ('82000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000012','81000000-0000-0000-0000-000000000002','74000000-0000-0000-0000-000000000012','active');
insert into public.parents(id,school_id,user_id,full_name) values
 ('83000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000011','72000000-0000-0000-0000-000000000013','Synthetic Parent One'),
 ('83000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000012','72000000-0000-0000-0000-000000000015','Synthetic Parent Two');
insert into public.student_parents(student_id,parent_id) values
 ('81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001'),
 ('81000000-0000-0000-0000-000000000002','83000000-0000-0000-0000-000000000002');
insert into public.official_calendar_sources(url,source,label,school_year,document_kind,suggested_dates) values
 ('https://calendar-ci.invalid/synthetic-exams','MENFP','Synthetic CI source','2026/2027','exam_calendar',
  '[{"date_text":"Synthetic CI exam period","start_date":"2027-03-10","end_date":"2027-03-12","category":"official_exam","context":"fixture only","status":"needs_review"},{"date_text":"Outside academic year","start_date":"2027-08-10","end_date":"2027-08-12","category":"official_exam","context":"fixture only","status":"needs_review"}]'::jsonb),
 ('https://calendar-ci.invalid/wrong-year','MENFP','Synthetic wrong year','2025/2026','exam_calendar',
  '[{"date_text":"Synthetic CI exam period","start_date":"2027-03-10","end_date":"2027-03-12","category":"official_exam","context":"fixture only","status":"needs_review"}]'::jsonb);

do $$ begin
 if has_table_privilege('authenticated','public.confirmed_official_exam_dates','insert') then raise exception 'direct confirmation insert is exposed'; end if;
 if not has_function_privilege('authenticated','public.confirm_official_exam_date(uuid,text,text,jsonb)','execute') then raise exception 'staff confirmation RPC is unavailable'; end if;
 if has_function_privilege('anon','public.confirm_official_exam_date(uuid,text,text,jsonb)','execute') then raise exception 'anonymous confirmation is exposed'; end if;
 if exists(select 1 from public.confirmed_official_exam_dates) then raise exception 'source proposals published automatically'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','72000000-0000-0000-0000-000000000011',true);
do $$
declare proposal jsonb; outside_proposal jsonb; confirmed uuid; duplicate uuid; payload jsonb; rejected boolean;
begin
 select suggested_dates->0,suggested_dates->1 into proposal,outside_proposal
 from public.official_calendar_sources where url='https://calendar-ci.invalid/synthetic-exams';
 payload:=public.school_calendar();
 if (select count(*) from public.official_calendar_sources)<>2 then raise exception 'staff cannot review global source proposals'; end if;
 if jsonb_array_length(payload->'official_exam_dates')<>0 then raise exception 'unconfirmed dates reached staff calendar'; end if;
 confirmed:=public.confirm_official_exam_date('73000000-0000-0000-0000-000000000011','fundamental','https://calendar-ci.invalid/synthetic-exams',proposal);
 duplicate:=public.confirm_official_exam_date('73000000-0000-0000-0000-000000000011','fundamental','https://calendar-ci.invalid/synthetic-exams',proposal);
 if confirmed is null or confirmed<>duplicate then raise exception 'same confirmation was not idempotent'; end if;
 if jsonb_array_length(public.school_calendar()->'official_exam_dates')<>1 then raise exception 'confirmed date missing from staff calendar'; end if;
 if public.school_calendar()->'official_exam_dates'->0->>'confirmed_by_name'<>'Synthetic Director One' then raise exception 'staff audit view lost confirming actor'; end if;
 rejected:=false;
 begin perform public.confirm_official_exam_date('73000000-0000-0000-0000-000000000011','fundamental','https://calendar-ci.invalid/synthetic-exams',proposal||'{"start_date":"2027-03-11"}'::jsonb); exception when raise_exception then rejected:=sqlerrm='official_exam_proposal_not_found'; end;
 if not rejected then raise exception 'forged date was accepted'; end if;
 rejected:=false;
 begin perform public.confirm_official_exam_date('73000000-0000-0000-0000-000000000011','secondary','https://calendar-ci.invalid/synthetic-exams',proposal); exception when raise_exception then rejected:=sqlerrm='section_not_enabled_for_year'; end;
 if not rejected then raise exception 'unconfigured section was accepted'; end if;
 rejected:=false;
 begin perform public.confirm_official_exam_date('73000000-0000-0000-0000-000000000012','fundamental','https://calendar-ci.invalid/synthetic-exams',proposal); exception when raise_exception then rejected:=sqlerrm='invalid_academic_year'; end;
 if not rejected then raise exception 'other school year was accepted'; end if;
 rejected:=false;
 begin perform public.confirm_official_exam_date('73000000-0000-0000-0000-000000000011','fundamental','https://calendar-ci.invalid/synthetic-exams',outside_proposal); exception when raise_exception then rejected:=sqlerrm='official_exam_date_outside_year'; end;
 if not rejected then raise exception 'out-of-year proposal was accepted'; end if;
 rejected:=false;
 begin perform public.confirm_official_exam_date('73000000-0000-0000-0000-000000000011','fundamental','https://calendar-ci.invalid/wrong-year',proposal); exception when raise_exception then rejected:=sqlerrm='official_exam_proposal_not_found'; end;
 if not rejected then raise exception 'wrong school-year source was accepted'; end if;
end $$;

select set_config('request.jwt.claim.sub','72000000-0000-0000-0000-000000000012',true);
do $$
declare rejected boolean:=false;
begin
 if exists(select 1 from public.official_calendar_sources) then raise exception 'teacher can read unconfirmed source proposals'; end if;
 if jsonb_array_length(public.school_calendar()->'official_exam_dates')<>1 then raise exception 'teacher did not receive confirmed section date'; end if;
 if public.school_calendar()->'official_exam_dates'->0->'proposal_snapshot' is distinct from 'null'::jsonb then raise exception 'teacher calendar leaked source proposal snapshot'; end if;
 if jsonb_array_length(public.school_calendar()->'classes')<>0 then raise exception 'teacher received manager class list'; end if;
 if jsonb_array_length(public.school_calendar()->'exams')<>1 or public.school_calendar()->'exams'->0->>'section' is distinct from 'fundamental' then raise exception 'teacher published exam omitted class section'; end if;
 begin perform public.confirm_official_exam_date('73000000-0000-0000-0000-000000000011','fundamental','https://calendar-ci.invalid/synthetic-exams',
  '{"date_text":"Synthetic CI exam period","start_date":"2027-03-10","end_date":"2027-03-12","category":"official_exam","context":"fixture only","status":"needs_review"}'::jsonb);
 exception when raise_exception then rejected:=sqlerrm='not_authorized'; end;
 if not rejected then raise exception 'teacher could confirm a proposal'; end if;
end $$;
select set_config('request.jwt.claim.sub','72000000-0000-0000-0000-000000000013',true);
do $$ begin
 if exists(select 1 from public.official_calendar_sources) then raise exception 'parent can read unconfirmed source proposals'; end if;
 if jsonb_array_length(public.school_calendar('81000000-0000-0000-0000-000000000001')->'official_exam_dates')<>1 then raise exception 'parent did not receive own confirmed date'; end if;
 if jsonb_array_length(public.school_calendar('81000000-0000-0000-0000-000000000001')->'exams')<>1 or public.school_calendar('81000000-0000-0000-0000-000000000001')->'exams'->0->>'section' is distinct from 'fundamental' then raise exception 'parent published exam omitted class section'; end if;
 if public.school_calendar('81000000-0000-0000-0000-000000000001')->'official_exam_dates'->0->'proposal_snapshot' is distinct from 'null'::jsonb then raise exception 'family calendar leaked source proposal snapshot'; end if;
 if public.school_calendar('81000000-0000-0000-0000-000000000001')->'official_exam_dates'->0->>'confirmed_by_name' is not null then raise exception 'family calendar leaked internal actor attribution'; end if;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 if jsonb_array_length(public.school_calendar(null,'synthetic-student-token')->'official_exam_dates')<>1 then raise exception 'student portal did not receive confirmed date'; end if;
end $$;
select set_config('request.jwt.claim.sub','72000000-0000-0000-0000-000000000014',true);
do $$ begin
 if jsonb_array_length(public.school_calendar()->'official_exam_dates')<>0 then raise exception 'other school staff saw first-school date'; end if;
end $$;
select set_config('request.jwt.claim.sub','72000000-0000-0000-0000-000000000015',true);
do $$ begin
 if jsonb_array_length(public.school_calendar('81000000-0000-0000-0000-000000000002')->'official_exam_dates')<>0 then raise exception 'other school parent saw first-school date'; end if;
end $$;

reset role;
do $$
declare proposal jsonb;
begin
 select suggested_dates->0 into proposal from public.official_calendar_sources
 where url='https://calendar-ci.invalid/synthetic-exams';
 if (select count(*) from public.confirmed_official_exam_dates)<>1 then raise exception 'duplicate official exam publication'; end if;
 if not exists(select 1 from public.confirmed_official_exam_dates where
   source_url='https://calendar-ci.invalid/synthetic-exams' and source_wording='Synthetic CI exam period'
   and proposal_snapshot=proposal and confirmed_by='72000000-0000-0000-0000-000000000011'
   and confirmed_by_name='Synthetic Director One' and confirmed_by_role='director' and confirmed_at is not null)
 then raise exception 'source wording or actor audit was lost'; end if;
end $$;

rollback;
