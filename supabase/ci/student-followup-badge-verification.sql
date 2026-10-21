begin;

insert into public.schools(id,name)
values('fb000000-0000-0000-0000-000000000011','Sanction badge CI');
insert into public.users(id,full_name)
values
 ('fb300000-0000-0000-0000-000000000011','Sanction badge Director'),
 ('fb300000-0000-0000-0000-000000000012','Sanction badge Teacher');
insert into public.school_members(school_id,user_id,role,enabled)
values
 ('fb000000-0000-0000-0000-000000000011','fb300000-0000-0000-0000-000000000011','director',true),
 ('fb000000-0000-0000-0000-000000000011','fb300000-0000-0000-0000-000000000012','teacher',true);
insert into public.academic_years(id,school_id,name,start_date,end_date,is_current)
values('fb100000-0000-0000-0000-000000000011','fb000000-0000-0000-0000-000000000011','Sanction CI year','2026-08-01','2027-07-31',true);
insert into public.classes(id,school_id,academic_year_id,name,enabled)
values('fb200000-0000-0000-0000-000000000011','fb000000-0000-0000-0000-000000000011','fb100000-0000-0000-0000-000000000011','Sanction CI class',true);
insert into public.students(id,school_id,first_name,last_name,atechos_id,active,school_status)
values('fb400000-0000-0000-0000-000000000011','fb000000-0000-0000-0000-000000000011','Badge','Student','AOS-BADGE-CI',true,'active');
insert into public.enrollments(id,school_id,student_id,class_id,status)
values('fb500000-0000-0000-0000-000000000011','fb000000-0000-0000-0000-000000000011','fb400000-0000-0000-0000-000000000011','fb200000-0000-0000-0000-000000000011','active');

do $$
declare
  qr text:='AOSQ1.'||repeat('a',64);
  badge uuid:='fb700000-0000-0000-0000-000000000011';
  student jsonb;
  workspace jsonb;
  denied boolean:=false;
begin
  insert into public.student_badges(id,school_id,student_id,badge_uid,badge_type,active,state)
  values(badge,'fb000000-0000-0000-0000-000000000011','fb400000-0000-0000-0000-000000000011','sanction-ci-badge','qr',true,'active');
  insert into private.badge_token_history(token_hash,badge_id)
  values(encode(extensions.digest(repeat('a',64),'sha256'),'hex'),badge);

  perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000012',true);
  begin perform public.lookup_student_for_followup_badge(qr); exception when others then denied:=sqlerrm='not_authorized'; end;
  if not denied then raise exception 'teacher accessed sanction badge lookup'; end if;

  perform set_config('request.jwt.claim.sub','fb300000-0000-0000-0000-000000000011',true);
  student:=public.lookup_student_for_followup_badge(qr);
  if student->>'id'<>'fb400000-0000-0000-0000-000000000011'
     or student->>'name'<>'Badge Student'
     or student->>'atechos_id'<>'AOS-BADGE-CI'
     or student->>'class'<>'Sanction CI class'
     or student ? 'qr' then
    raise exception 'authorized scan did not return the limited student identity';
  end if;
  workspace:=public.student_followup_workspace();
  if workspace->'students'->0->>'atechos_id'<>'AOS-BADGE-CI' then
    raise exception 'sanction workspace did not include the student ID';
  end if;

  denied:=false;
  begin perform public.lookup_student_for_followup_badge('AOSQ1.not-a-token'); exception when others then denied:=sqlerrm='invalid_badge'; end;
  if not denied then raise exception 'malformed badge QR was accepted'; end if;
  update public.student_badges set active=false,state='revoked' where id=badge;
  denied:=false;
  begin perform public.lookup_student_for_followup_badge(qr); exception when others then denied:=sqlerrm='badge_not_found'; end;
  if not denied then raise exception 'revoked badge was accepted for sanctions'; end if;
end $$;

rollback;

