do $test$
declare owner_id uuid:=gen_random_uuid(); reviewer uuid:=gen_random_uuid(); sid uuid; member_id uuid; inv jsonb; denied boolean; yr uuid; cls uuid; child uuid;
begin begin
 insert into auth.users(id,email,email_confirmed_at,role,aud) select id,id::text||'@example.invalid',now(),'authenticated','authenticated' from unnest(array[owner_id,reviewer]) id;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);set local role authenticated;
 sid:=public.create_school_onboarding('Reviewer fixture',gen_random_uuid()::text);
 yr:=public.create_academic_year('Reviewer verification',current_date-30,current_date+300,true);
 cls:=public.create_class(yr,'Reviewer class','AF7');
 child:=public.save_student_record(jsonb_build_object('first_name','Fixture','last_name','Learner','class_id',cls));
 inv:=public.create_school_invitation(reviewer::text||'@example.invalid','Reviewer','censeur');
 perform set_config('request.jwt.claim.sub',reviewer::text,true);perform public.accept_school_invitation(inv->>'token');
 if not private.has_role(sid,array['censeur']) or not private.has_role(sid,array['surveillant']) or private.has_role(sid,array['school_admin','director','secretary','teacher','parent']) then raise exception 'TEST supervision inheritance only';end if;
 if private.has_role(gen_random_uuid(),array['surveillant']) then raise exception 'TEST cross school inheritance';end if;
 if not private.read_class(cls) or not private.read_student(child) then raise exception 'TEST supervision resources';end if;
 if not exists(select 1 from public.classes where id=cls) then raise exception 'TEST class RLS';end if;
 perform public.staff_mark_attendance(child,cls,'present');
 if not exists(select 1 from public.attendance_events where student_id=child and actor_id=reviewer and actor_role='censeur' and source='STAFF') then raise exception 'TEST actual Censeur attribution';end if;
 perform public.report_students();perform public.student_change_history(child);perform public.badge_workspace(child);
 if private.write_academic(sid,cls) then raise exception 'TEST unassigned grade entry granted';end if;
 select id into member_id from public.school_members where school_id=sid and user_id=reviewer and role='censeur';
 denied:=false;begin perform public.manage_school_member(member_id,'role','director');exception when others then denied:=true;end;
 if not denied then raise exception 'TEST self elevation';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 -- Teacher role removal now uses the two-approval fixture; keep this test on non-teacher role changes.
 perform public.manage_school_member(member_id,'role','director');
 perform public.manage_school_member(member_id,'role','censeur');
 if not exists(select 1 from public.school_members where id=member_id and role='censeur') then raise exception 'TEST admin role change';end if;
 reset role;update public.school_members set enabled=false where id=member_id;
 perform set_config('request.jwt.claim.sub',reviewer::text,true);set local role authenticated;
 if private.has_role(sid,array['surveillant']) or private.read_class(cls) then raise exception 'TEST disabled membership retained permissions';end if;
 denied:=false;begin perform public.staff_mark_attendance(child,cls,'late');exception when others then denied:=true;end;
 if not denied then raise exception 'TEST disabled attendance permission';end if;
 reset role;raise exception using errcode='ZX004',message='fixtures passed';exception when sqlstate 'ZX004' then null;end;
end $test$;
select 'PASS Censeur invitation, supervision inheritance and RLS, actual attendance actor, no admin/self elevation/cross-school/unassigned grade permission, disabled access revoked; fixtures rolled back' as result;
