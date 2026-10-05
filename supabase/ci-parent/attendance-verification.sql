begin;

insert into public.schools(id) values
 ('10000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002');
insert into public.academic_years(id,school_id,start_date,end_date) values
 ('11000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','2026-08-01','2027-07-31');
insert into auth.users(id,email,email_confirmed_at,role,aud) values
 ('20000000-0000-0000-0000-000000000001','linked@example.invalid',now(),'authenticated','authenticated'),
 ('20000000-0000-0000-0000-000000000002','unrelated@example.invalid',now(),'authenticated','authenticated'),
 ('20000000-0000-0000-0000-000000000003','disabled@example.invalid',now(),'authenticated','authenticated');
insert into public.students(id,school_id,first_name,last_name) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Linked','Child'),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Other','Child');
insert into public.parents(id,school_id,user_id) values
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001'),
 ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003');
insert into public.student_parents(student_id,parent_id) values
 ('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002');
insert into public.school_members(school_id,user_id,role,enabled) values
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','parent',true),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','parent',false);
insert into public.attendance(school_id,student_id,attendance_date,status,late_minutes,check_in_at)
select '10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',
       (now() at time zone 'America/Port-au-Prince')::date-gs,
       case when gs%3=0 then 'present' when gs%3=1 then 'late' else 'absent' end,
       case when gs%3=1 then 7 else 0 end,
       ((now() at time zone 'America/Port-au-Prince')::date-gs+time '07:40') at time zone 'America/Port-au-Prince'
from generate_series(0,39) gs;
insert into public.attendance(school_id,student_id,attendance_date,status)
values('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002',
       (now() at time zone 'America/Port-au-Prince')::date,'present');

do $$
declare result jsonb; first_page jsonb; second_page jsonb; failed boolean;
        today date:=(now() at time zone 'America/Port-au-Prince')::date;
        from_date date:=today-29; to_date date:=today;
begin
  perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
  result:=public.family_child_attendance_history('30000000-0000-0000-0000-000000000001',from_date,to_date,10,0);
  if (result->>'total_count')::integer<>30 or jsonb_array_length(result->'records')<>10 then raise exception 'family attendance first page count failed'; end if;
  if result->'records'->0->>'attendance_date'<>today::text then raise exception 'family attendance ordering failed'; end if;
  if ((result->'summary'->>'present')::integer+(result->'summary'->>'late')::integer+(result->'summary'->>'absent')::integer)<>30 then raise exception 'family attendance summary omitted records'; end if;

  second_page:=public.family_child_attendance_history('30000000-0000-0000-0000-000000000001',from_date,to_date,10,10);
  if (second_page->>'total_count')::integer<>30 or jsonb_array_length(second_page->'records')<>10 then raise exception 'family attendance second page failed'; end if;
  if second_page->'records'->0->>'attendance_date'=result->'records'->0->>'attendance_date' then raise exception 'family attendance pages overlap'; end if;
  result:=public.family_child_attendance_history('30000000-0000-0000-0000-000000000001',today-4,today,30,0);
  if (result->>'total_count')::integer<>5 or jsonb_array_length(result->'records')<>5 then raise exception 'family attendance date filter failed'; end if;
  result:=public.family_child_attendance_history('30000000-0000-0000-0000-000000000001',from_date,to_date,30,30);
  if (result->>'total_count')::integer<>30 or jsonb_array_length(result->'records')<>0 then raise exception 'family attendance final page failed'; end if;

  failed:=false;
  begin perform public.family_child_attendance_history('30000000-0000-0000-0000-000000000002',from_date,to_date,30,0);
  exception when others then failed:=sqlerrm='not_authorized'; end;
  if not failed then raise exception 'unrelated parent read another student attendance'; end if;

  perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
  failed:=false;
  begin perform public.family_child_attendance_history('30000000-0000-0000-0000-000000000001',from_date,to_date,30,0);
  exception when others then failed:=sqlerrm='not_authorized'; end;
  if not failed then raise exception 'disabled parent membership read attendance'; end if;

  perform set_config('request.jwt.claim.sub','',true);
  failed:=false;
  begin perform public.family_child_attendance_history('30000000-0000-0000-0000-000000000001',from_date,to_date,30,0);
  exception when others then failed:=sqlerrm='not_authenticated'; end;
  if not failed then raise exception 'unauthenticated caller read attendance'; end if;

  perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
  failed:=false;
  begin perform public.family_child_attendance_history('30000000-0000-0000-0000-000000000001',from_date,to_date,51,0);
  exception when others then failed:=sqlerrm='invalid_attendance_pagination'; end;
  if not failed then raise exception 'oversized attendance page was accepted'; end if;
  failed:=false;
  begin perform public.family_child_attendance_history('30000000-0000-0000-0000-000000000001',today-366,today,30,0);
  exception when others then failed:=sqlerrm='invalid_attendance_date_range'; end;
  if not failed then raise exception 'attendance date range over one year was accepted'; end if;

  if has_function_privilege('anon','public.family_child_attendance_history(uuid,date,date,integer,integer)','execute') then raise exception 'anon can execute family attendance RPC'; end if;
  if not has_function_privilege('authenticated','public.family_child_attendance_history(uuid,date,date,integer,integer)','execute') then raise exception 'authenticated parent lacks family attendance RPC'; end if;
end $$;

rollback;
