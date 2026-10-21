-- Run only after 20260930232834_kindergarten_pickup_workflow is applied.
-- Every fixture is rolled back by the deliberate ZX004 exception.
do $test$
declare actor uuid:=gen_random_uuid();sid uuid;yr uuid;cls uuid;child uuid;qr text;adult uuid;pickup jsonb;att uuid;failed boolean;
begin
 begin
  insert into auth.users(id,email,email_confirmed_at,role,aud) values(actor,actor::text||'@example.invalid',now(),'authenticated','authenticated');
  perform set_config('request.jwt.claim.sub',actor::text,true);
  set local role authenticated;
  sid:=public.create_school_onboarding('Kindergarten pickup fixture',gen_random_uuid()::text);
  yr:=public.create_academic_year('Fixture year','2026-09-01','2027-06-30',true);
  cls:=public.create_class(yr,'Preschool fixture','PS1');
  child:=public.save_student_record(jsonb_build_object('first_name','Fixture','last_name','Preschool','class_id',cls));
  adult:=public.save_kindergarten_pickup_authorization(child,null,'Authorized Adult','Parent','+50900000000',true);
  qr:=public.get_student_badge_qr(child,false);
  reset role;
  insert into public.attendance(school_id,student_id,class_id,attendance_date,check_in_at,status,recorded_by)
  values(sid,child,cls,(now() at time zone 'America/Port-au-Prince')::date,now(),'present',actor) returning id into att;
  set local role authenticated;
  pickup:=public.complete_kindergarten_pickup(qr,adult,'Fixture pickup');
  if pickup->>'picked_up_by'<>'Authorized Adult' then raise exception 'TEST authorized adult not recorded';end if;
  if not exists(select 1 from public.attendance where id=att and check_out_at is not null and recorded_by=actor) then raise exception 'TEST pickup did not check out attendance';end if;
  if not exists(select 1 from public.attendance_events where attendance_id=att and source='STAFF' and action='kindergarten_pickup_check_out' and actor_id=actor) then raise exception 'TEST pickup source/actor audit missing';end if;
  reset role;
  if not exists(select 1 from public.badge_scans where student_id=child and source='PICKUP' and result='pickup_complete') then raise exception 'TEST pickup badge scan not recorded';end if;
  set local role authenticated;
  failed:=false;begin perform public.complete_kindergarten_pickup(qr,adult,null);exception when others then failed:=sqlerrm='already_picked_up';end;
  if not failed then raise exception 'TEST second pickup was not rejected';end if;
  reset role;
  failed:=false;begin update public.kindergarten_pickups set reason='rewritten' where student_id=child;exception when others then failed:=sqlerrm='pickup_history_immutable';end;
  if not failed then raise exception 'TEST pickup history was mutable';end if;
  set local role authenticated;
  raise exception using errcode='ZX004',message='pickup fixtures passed';
 exception when sqlstate 'ZX004' then null;end;
end $test$;
select 'PASS authorized preschool pickup, badge scan, attendance checkout attribution, one-pickup-per-day rule, immutable pickup history; fixtures rolled back' as result;
