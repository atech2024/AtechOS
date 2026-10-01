-- Run only after 20261001001600_kindergarten_private_relocation is applied.
-- All generated users, school records, attendance, and relocation history roll back.
do $test$
declare
 staff uuid:=gen_random_uuid(); parent_user uuid:=gen_random_uuid(); unrelated_user uuid:=gen_random_uuid();
 sid uuid;yr uuid;cls uuid;child uuid;att uuid;qr text;adult uuid;relocation uuid;family jsonb;failed boolean;
begin
 begin
  insert into auth.users(id,email,email_confirmed_at,role,aud) values
   (staff,staff::text||'@example.invalid',now(),'authenticated','authenticated'),
   (parent_user,parent_user::text||'@example.invalid',now(),'authenticated','authenticated'),
   (unrelated_user,unrelated_user::text||'@example.invalid',now(),'authenticated','authenticated');
  insert into public.users(id,full_name,email) values
   (parent_user,'Fixture Parent',parent_user::text||'@example.invalid'),
   (unrelated_user,'Unrelated Parent',unrelated_user::text||'@example.invalid')
  on conflict(id) do nothing;

  perform set_config('request.jwt.claim.sub',staff::text,true);
  set local role authenticated;
  sid:=public.create_school_onboarding('Preschool relocation fixture',gen_random_uuid()::text);
  yr:=public.create_academic_year('Fixture year','2026-09-01','2027-06-30',true);
  cls:=public.create_class(yr,'Preschool fixture','PS1');
  child:=public.save_student_record(jsonb_build_object('first_name','Fixture','last_name','Preschool','class_id',cls));
  adult:=public.save_kindergarten_pickup_authorization(child,null,'Authorized Adult','Parent',null,true);
  qr:=public.get_student_badge_qr(child,false);
  reset role;

  insert into public.school_members(school_id,user_id,role) values(sid,parent_user,'parent'),(sid,unrelated_user,'parent');
  insert into public.parents(school_id,user_id,full_name,email,relationship)
   values(sid,parent_user,'Fixture Parent',parent_user::text||'@example.invalid','parent');
  insert into public.parents(school_id,user_id,full_name,email,relationship)
   values(sid,unrelated_user,'Unrelated Parent',unrelated_user::text||'@example.invalid','parent');
  insert into public.student_parents(student_id,parent_id,is_primary,relationship)
   select child,id,true,'parent' from public.parents where school_id=sid and user_id=parent_user;
  insert into public.attendance(school_id,student_id,class_id,attendance_date,check_in_at,status,recorded_by)
   values(sid,child,cls,(now() at time zone 'America/Port-au-Prince')::date,now(),'present',staff) returning id into att;

  set local role authenticated;
  relocation:=public.start_kindergarten_relocation(child,'needs_support','PRIVATE-STAFF-ONLY-FIXTURE');
  perform public.record_kindergarten_parent_contact(relocation,'no_answer','PRIVATE-CONTACT-FIXTURE');
  reset role;
  perform set_config('request.jwt.claim.sub',parent_user::text,true);
  set local role authenticated;
  family:=public.kindergarten_parent_relocation_status();
  if jsonb_array_length(family)<>1 or family->0->>'student_id'<>child::text then raise exception 'TEST linked parent cannot see own active child notice';end if;
  if family::text like '%PRIVATE-%' or family::text like '%needs_support%' or family::text like '%opened_at%' then raise exception 'TEST family RPC exposed private relocation details';end if;
  reset role;
  perform set_config('request.jwt.claim.sub',unrelated_user::text,true);
  set local role authenticated;
  family:=public.kindergarten_parent_relocation_status();
  if jsonb_array_length(family)<>0 then raise exception 'TEST unrelated parent saw another family relocation';end if;

  reset role;
  perform set_config('request.jwt.claim.sub',staff::text,true);
  set local role authenticated;
  perform public.complete_kindergarten_pickup(qr,adult,'Fixture pickup');
  reset role;
  if not exists(select 1 from public.kindergarten_relocation_cases where id=relocation and status='picked_up' and closed_by=staff) then raise exception 'TEST pickup did not close the linked relocation with actor';end if;
  if not exists(select 1 from public.kindergarten_relocation_events where case_id=relocation and event_type='picked_up' and actor_id=staff) then raise exception 'TEST pickup closure audit event missing';end if;
  perform set_config('request.jwt.claim.sub',parent_user::text,true);
  set local role authenticated;
  family:=public.kindergarten_parent_relocation_status();
  if jsonb_array_length(family)<>0 then raise exception 'TEST family notice remained after pickup';end if;
  reset role;
  failed:=false;
  begin update public.kindergarten_relocation_cases set private_note='rewritten' where id=relocation;
  exception when others then failed:=sqlerrm='relocation_history_immutable';end;
  if not failed then raise exception 'TEST private relocation history was mutable';end if;
  raise exception using errcode='ZX004',message='relocation fixtures passed';
 exception when sqlstate 'ZX004' then null;end;
end $test$;
select 'PASS staff-only relocation, same-school own-child family notice, no private detail leakage, unrelated-family isolation, pickup-triggered closure/attribution, immutable history; all fixtures rolled back' as result;
