-- Isolated rollback verification for the 09:00 school-day absence job.
do $test$
declare
  owner_id uuid:=gen_random_uuid();
  school_id uuid;
  year_id uuid;
  class_id uuid;
  student_id uuid;
begin
  begin
    insert into auth.users(id,email,email_confirmed_at,role,aud)
    values(owner_id,owner_id::text||'@example.invalid',now(),'authenticated','authenticated');
    perform set_config('request.jwt.claim.sub',owner_id::text,true);
    set local role authenticated;
    school_id:=public.create_school_onboarding('Absence Fixture',gen_random_uuid()::text);
    year_id:=public.create_academic_year('Verification Year',date '2026-01-01',date '2026-12-31',true);
    class_id:=public.create_class(year_id,'Verification Class','AF7');
    student_id:=public.save_student_record(jsonb_build_object('first_name','Attendance','last_name','Fixture','class_id',class_id));
    reset role;

    perform private.mark_missing_attendance('2026-01-05 08:59:59 America/Port-au-Prince');
    if exists(select 1 from public.attendance where student_id=student_id and attendance_date=date '2026-01-05') then
      raise exception 'TEST absence before 09:00';
    end if;
    perform private.mark_missing_attendance('2026-01-05 09:00 America/Port-au-Prince');
    if not exists(select 1 from public.attendance where student_id=student_id and attendance_date=date '2026-01-05' and status='absent' and check_in_at is null) then
      raise exception 'TEST 09:00 school-day absence';
    end if;
    perform private.mark_missing_attendance('2026-01-05 10:00 America/Port-au-Prince');
    if (select count(*) from public.attendance_events where student_id=student_id and source='SYSTEM' and action='automatic_absence' and attendance_date=date '2026-01-05')<>1 then
      raise exception 'TEST duplicate automatic-absence event';
    end if;

    perform private.mark_missing_attendance('2026-01-03 09:00 America/Port-au-Prince');
    if exists(select 1 from public.attendance where student_id=student_id and attendance_date=date '2026-01-03') then
      raise exception 'TEST Saturday skipped';
    end if;
    insert into public.school_closures(school_id,day,title) values(school_id,date '2026-01-06','Approved closure');
    perform private.mark_missing_attendance('2026-01-06 09:00 America/Port-au-Prince');
    if exists(select 1 from public.attendance where student_id=student_id and attendance_date=date '2026-01-06') then
      raise exception 'TEST approved closure skipped';
    end if;

    insert into public.attendance(school_id,student_id,class_id,attendance_date,status,check_in_at)
    values(school_id,student_id,class_id,date '2026-01-07','late',timestamptz '2026-01-07 07:55 America/Port-au-Prince');
    perform private.mark_missing_attendance('2026-01-07 09:00 America/Port-au-Prince');
    if not exists(select 1 from public.attendance where student_id=student_id and attendance_date=date '2026-01-07' and status='late' and check_in_at is not null) then
      raise exception 'TEST existing late attendance preserved';
    end if;

    perform private.mark_missing_attendance('2027-01-01 09:00 America/Port-au-Prince');
    if exists(select 1 from public.attendance where student_id=student_id and attendance_date=date '2027-01-01') then
      raise exception 'TEST outside current school year skipped';
    end if;

    raise exception using errcode='ZX001',message='absence fixtures passed';
  exception when sqlstate 'ZX001' then
    null;
  end;
end $test$;
select 'PASS 09:00 cutoff, open school days, approved closures, no overwrites or duplicate events' as result;
