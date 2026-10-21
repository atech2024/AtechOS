begin;

insert into public.users(id,full_name,email) values
 ('21000000-0000-0000-0000-000000000001','Kind Director','director@example.invalid'),
 ('21000000-0000-0000-0000-000000000004','Kind Coordinator','coordinator@example.invalid'),
 ('21000000-0000-0000-0000-000000000006','Kind Censeur','censeur@example.invalid'),
 ('21000000-0000-0000-0000-000000000007','Kind Secretary','secretary@example.invalid'),
 ('21000000-0000-0000-0000-000000000008','Kind Admin','admin@example.invalid'),
 ('21000000-0000-0000-0000-000000000009','Teacher Applicant','applicant@example.invalid'),
 ('21000000-0000-0000-0000-000000000010','Next Coordinator','next@example.invalid'),
 ('21000000-0000-0000-0000-000000000011','Other School Staff','other@example.invalid'),
 ('21000000-0000-0000-0000-000000000012','Other School Applicant','other-applicant@example.invalid'),
 ('21000000-0000-0000-0000-000000000013','Censeur Applicant','censeur-applicant@example.invalid'),
 ('21000000-0000-0000-0000-000000000014','Director Applicant','director-applicant@example.invalid'),
 ('21000000-0000-0000-0000-000000000015','Admin Applicant','admin-applicant@example.invalid');
insert into public.schools(id,owner_user_id) values
 ('21000000-0000-0000-0000-000000000101','21000000-0000-0000-0000-000000000008'),
 ('21000000-0000-0000-0000-000000000102','21000000-0000-0000-0000-000000000011');
insert into public.school_members(school_id,user_id,role,enabled) values
 ('21000000-0000-0000-0000-000000000101','21000000-0000-0000-0000-000000000001','director',true),
 ('21000000-0000-0000-0000-000000000101','21000000-0000-0000-0000-000000000004','teacher',true),
 ('21000000-0000-0000-0000-000000000101','21000000-0000-0000-0000-000000000006','censeur',true),
 ('21000000-0000-0000-0000-000000000101','21000000-0000-0000-0000-000000000007','secretary',true),
 ('21000000-0000-0000-0000-000000000101','21000000-0000-0000-0000-000000000008','school_admin',true),
 ('21000000-0000-0000-0000-000000000101','21000000-0000-0000-0000-000000000009','parent',true),
 ('21000000-0000-0000-0000-000000000101','21000000-0000-0000-0000-000000000010','teacher',true),
 ('21000000-0000-0000-0000-000000000102','21000000-0000-0000-0000-000000000011','school_admin',true),
 ('21000000-0000-0000-0000-000000000102','21000000-0000-0000-0000-000000000012','parent',true);
insert into public.preschool_program_settings(school_id,coordinator_user_id)
values('21000000-0000-0000-0000-000000000101','21000000-0000-0000-0000-000000000004');
insert into public.teacher_join_requests(school_id,user_id) values
 ('21000000-0000-0000-0000-000000000101','21000000-0000-0000-0000-000000000009'),
 ('21000000-0000-0000-0000-000000000101','21000000-0000-0000-0000-000000000013'),
 ('21000000-0000-0000-0000-000000000101','21000000-0000-0000-0000-000000000014'),
 ('21000000-0000-0000-0000-000000000101','21000000-0000-0000-0000-000000000015'),
 ('21000000-0000-0000-0000-000000000102','21000000-0000-0000-0000-000000000012');

do $test$
declare invited jsonb; invite_id uuid; request_id uuid; failed boolean;
begin
 perform set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000004',true);
 if not public.teacher_staff_management_access() then raise exception 'designated Kind coordinator should get the narrow teacher-management access'; end if;
 if private.can_manage_teacher_access('21000000-0000-0000-0000-000000000102',auth.uid()) then raise exception 'coordinator access leaked to another school'; end if;
 perform public.save_preschool_settings('21000000-0000-0000-0000-000000000004',true,false,false);
 failed:=false; begin perform public.save_preschool_coordinator('21000000-0000-0000-0000-000000000010'); exception when others then failed:=sqlerrm='not_authorized'; end;
 if not failed then raise exception 'coordinator must not be able to appoint or replace the coordinator'; end if;
 invited:=public.create_school_invitation('new-teacher@example.invalid','Invited Teacher','teacher');
 invite_id:=(invited->>'id')::uuid;
 failed:=false; begin perform public.create_school_invitation('new-parent@example.invalid','Invited Parent','parent'); exception when others then failed:=sqlerrm='not_authorized'; end;
 if not failed then raise exception 'coordinator must not invite parent or non-teacher roles'; end if;
 perform public.cancel_school_invitation(invite_id);
 if (select status from public.school_invitations where id=invite_id)<>'cancelled' then raise exception 'authorized coordinator could not cancel a teacher invitation'; end if;
 select id into request_id from public.teacher_join_requests where school_id='21000000-0000-0000-0000-000000000101' and user_id='21000000-0000-0000-0000-000000000009';
 if jsonb_array_length(public.get_teacher_requests())<>4 then raise exception 'coordinator should see only pending requests from the active school'; end if;
 perform public.review_teacher_request(request_id,true);
 if not exists(select 1 from public.school_members where school_id='21000000-0000-0000-0000-000000000101' and user_id='21000000-0000-0000-0000-000000000009' and role='teacher' and enabled) then raise exception 'approved teacher was not enabled in the same school'; end if;
 failed:=false; begin perform public.review_teacher_request((select id from public.teacher_join_requests where school_id='21000000-0000-0000-0000-000000000102'),true); exception when others then failed:=sqlerrm='not_authorized'; end;
 if not failed then raise exception 'coordinator reviewed another school request'; end if;

 perform set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000006',true);
 if not public.teacher_staff_management_access() then raise exception 'Censeur should have teacher-management access'; end if;
 failed:=false; begin perform public.save_preschool_coordinator('21000000-0000-0000-0000-000000000010'); exception when others then failed:=sqlerrm='not_authorized'; end;
 if not failed then raise exception 'Censeur must not assign or replace the Preschool coordinator'; end if;
 perform public.create_school_invitation('censeur-teacher@example.invalid','Censeur Teacher','teacher');
 failed:=false; begin perform public.create_school_invitation('censeur-parent@example.invalid','Censeur Parent','parent'); exception when others then failed:=sqlerrm='not_authorized'; end;
 if not failed then raise exception 'Censeur must not invite non-teacher roles through this access'; end if;
 perform public.review_teacher_request((select id from public.teacher_join_requests where user_id='21000000-0000-0000-0000-000000000013'),true);

 perform set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000001',true);
 perform public.create_school_invitation('director-teacher@example.invalid','Director Teacher','teacher');
 perform public.review_teacher_request((select id from public.teacher_join_requests where user_id='21000000-0000-0000-0000-000000000014'),true);
 perform public.create_school_invitation('director-parent@example.invalid','Director Parent','parent');
 perform public.save_preschool_coordinator('21000000-0000-0000-0000-000000000010');
 if public.teacher_staff_management_access() then raise exception 'former coordinator retained access after replacement'; end if;

 perform set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000010',true);
 if not public.teacher_staff_management_access() then raise exception 'newly assigned coordinator did not receive access'; end if;
 perform public.create_school_invitation('next-coordinator-teacher@example.invalid','New Coordinator Teacher','teacher');

 perform set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000008',true);
 perform public.save_preschool_coordinator('21000000-0000-0000-0000-000000000004');
 if not public.teacher_staff_management_access() then raise exception 'school administrator should be able to restore the designated coordinator'; end if;
 perform set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000010',true);
 if public.teacher_staff_management_access() then raise exception 'replaced coordinator retained teacher-management access'; end if;
 perform set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000008',true);
 perform public.review_teacher_request((select id from public.teacher_join_requests where user_id='21000000-0000-0000-0000-000000000015'),true);
 perform public.create_school_invitation('admin-parent@example.invalid','Admin Parent','parent');

 perform set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000007',true);
 if public.teacher_staff_management_access() then raise exception 'unassigned secretary should not receive teacher-management access'; end if;
 failed:=false; begin perform public.create_school_invitation('secretary-teacher@example.invalid','Secretary Teacher','teacher'); exception when others then failed:=sqlerrm='not_authorized'; end;
 if not failed then raise exception 'unassigned secretary created a teacher invitation'; end if;

 perform set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000004',true);
 if position('private.can_manage_teacher_access' in pg_get_functiondef('public.accept_school_invitation(text)'::regprocedure))=0 then raise exception 'teacher invitation acceptance does not revalidate inviter authorization'; end if;
 if position('i.role=''parent'' and exists(select 1 from public.school_members m where m.school_id=i.school_id and m.user_id=i.invited_by and m.role=''director'' and m.enabled)' in pg_get_functiondef('public.accept_school_invitation(text)'::regprocedure))=0 then raise exception 'teacher invitation update removed the existing Director parent-invitation path'; end if;
end
$test$;

set local role authenticated;
select set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000010',true);
do $rls$
begin
 if (select count(*) from public.teacher_join_requests)<>4 then raise exception 'teacher request RLS did not scope the coordinator to their school'; end if;
end
$rls$;

rollback;
