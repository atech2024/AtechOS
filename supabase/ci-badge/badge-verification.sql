begin;
insert into public.schools(id) values('10000000-0000-0000-0000-000000000001');
insert into public.users(id,full_name) values
 ('20000000-0000-0000-0000-000000000001','Badge director'),
 ('20000000-0000-0000-0000-000000000002','Linked parent'),
 ('20000000-0000-0000-0000-000000000003','Unrelated parent'),
 ('20000000-0000-0000-0000-000000000004','Badge teacher');
insert into public.students(id,school_id,first_name,last_name,atechos_id) values
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Synthetic','Student','AOS-CI-5001');
insert into public.parents(id,school_id,user_id) values
 ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002'),
 ('70000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003');
insert into public.student_parents(student_id,parent_id) values
 ('50000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001');
insert into public.school_members(school_id,user_id,role) values
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','director'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','parent'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','parent'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','teacher');

do $test$
declare qr text; replacement text; result jsonb; workspace jsonb; failed boolean;
begin
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 set local role authenticated;
 qr:=public.get_student_badge_qr('50000000-0000-0000-0000-000000000001',false);
 if qr !~ '^AOSQ1\.[a-f0-9]{64}$' or qr<>public.get_student_badge_qr('50000000-0000-0000-0000-000000000001',false) then raise exception 'active badge QR must be stable for physical reprint'; end if;
 workspace:=public.badge_workspace('50000000-0000-0000-0000-000000000001');
 if not (workspace->>'can_manage')::boolean or workspace->>'qr'<>qr then raise exception 'authorized staff badge workspace mismatch'; end if;
 reset role;

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 set local role authenticated;
 workspace:=public.badge_workspace('50000000-0000-0000-0000-000000000001');
 if (workspace->>'can_manage')::boolean or workspace->>'qr' is not null then raise exception 'parent received private operational QR'; end if;
 perform public.report_badge_lost('50000000-0000-0000-0000-000000000001','synthetic lost-badge test');
 reset role;

 set local role anon;
 result:=public.student_kiosk_badge(qr);
 if result->>'error'<>'invalid_badge' then raise exception 'lost badge QR must stop working immediately'; end if;
 reset role;

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
 set local role authenticated;
 failed:=false; begin perform public.badge_workspace('50000000-0000-0000-0000-000000000001'); exception when others then failed:=sqlerrm='not_authorized'; end;
 if not failed then raise exception 'unrelated parent accessed badge workspace'; end if;
 failed:=false; begin perform public.report_badge_lost('50000000-0000-0000-0000-000000000001','unauthorized loss report'); exception when others then failed:=sqlerrm='not_authorized'; end;
 if not failed then raise exception 'unrelated parent reported badge loss'; end if;
 reset role;

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
 set local role authenticated;
 failed:=false; begin perform public.badge_workspace('50000000-0000-0000-0000-000000000001'); exception when others then failed:=sqlerrm='not_authorized'; end;
 if not failed then raise exception 'teacher accessed badge workspace'; end if;
 reset role;

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 set local role authenticated;
 replacement:=public.get_student_badge_qr('50000000-0000-0000-0000-000000000001',true);
 if replacement is null or replacement=qr or replacement !~ '^AOSQ1\.[a-f0-9]{64}$' then raise exception 'replacement must rotate private QR'; end if;
 workspace:=public.badge_workspace('50000000-0000-0000-0000-000000000001');
 if workspace->>'qr'<>replacement or (select count(*) from public.student_badges where student_id='50000000-0000-0000-0000-000000000001' and active and state='active')<>1 then raise exception 'replacement must leave exactly one active badge'; end if;
 if not exists(select 1 from jsonb_array_elements(workspace->'events') event where event->>'action'='lost' and event->>'actor_role'='parent') then raise exception 'lost action must be attributed to linked parent'; end if;
 if has_table_privilege('authenticated','private.badge_token_history','select') or has_table_privilege('authenticated','private.student_badge_credentials','select') then raise exception 'authenticated users can read private badge credential tables'; end if;
 if has_table_privilege('authenticated','public.student_badges','update') then raise exception 'authenticated users can reactivate badges directly'; end if;
 failed:=false; begin update public.student_badges set active=true where student_id='50000000-0000-0000-0000-000000000001'; exception when insufficient_privilege then failed:=true; end;
 if not failed then raise exception 'direct badge reactivation bypassed lifecycle RPC'; end if;
 reset role;

 set local role anon;
 result:=public.student_kiosk_badge(qr);
 if result->>'error'<>'invalid_badge' then raise exception 'old QR accepted after replacement'; end if;
 result:=public.student_kiosk_badge(replacement);
 if result->>'action'<>'check_in' then raise exception 'replacement QR failed student-only KIOS check-in'; end if;
 result:=public.student_kiosk_badge(replacement);
 if result->>'action'<>'duplicate_scan' then raise exception 'duplicate scan toggled a KIOS checkout'; end if;
 reset role;

 if (select count(*) from public.notifications where type='lost_badge')<>1 then raise exception 'lost report should create one staff notice'; end if;
 if not exists(select 1 from public.student_badges where student_id='50000000-0000-0000-0000-000000000001' and state='lost' and not active) then raise exception 'lost badge history was not preserved'; end if;
 if not exists(select 1 from jsonb_array_elements(workspace->'events') event where event->>'action'='replaced') then raise exception 'badge replacement action was not audited'; end if;
end
$test$;
rollback;
