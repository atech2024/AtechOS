begin;
insert into public.schools(id) values('10000000-0000-0000-0000-000000000001');
insert into public.users(id,full_name) values
 ('20000000-0000-0000-0000-000000000001','Badge director'),
 ('20000000-0000-0000-0000-000000000002','Linked parent'),
 ('20000000-0000-0000-0000-000000000003','Unrelated parent'),
 ('20000000-0000-0000-0000-000000000004','Badge teacher'),
 ('20000000-0000-0000-0000-000000000005','Kind coordinator');
insert into public.students(id,school_id,first_name,last_name,atechos_id) values
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Synthetic','Kind Student','AOS-CI-5001'),
 ('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Synthetic','Primary Student','AOS-CI-5002');
insert into public.academic_years(id,school_id,is_current) values('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',true);
insert into public.classes(id,school_id,academic_year_id,name,grade_level) values
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','PS1 A','PS1'),
 ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','AF1 A','AF1');
insert into public.enrollments(id,school_id,student_id,class_id,status) values
 ('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','active'),
 ('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','active');
insert into public.parents(id,school_id,user_id) values
 ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002'),
 ('70000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003');
insert into public.student_parents(student_id,parent_id) values
 ('50000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001');
insert into public.school_members(school_id,user_id,role) values
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','director'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','parent'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','parent'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','teacher'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','preschool_coordinator');

insert into public.school_kiosk_schedules(school_id,entry_opens_at,preschool_entry_opens_at) values('10000000-0000-0000-0000-000000000001',time '05:15',time '05:30');

do $test$
declare qr text; primary_qr text; replacement text; result jsonb; workspace jsonb; badge_audit_workspace jsonb; failed boolean; pairing_code text; device_token text; general_token text; general_device uuid; kind_pairing jsonb; kind_token text; pairing_result jsonb; school_entry time;
begin
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 set local role authenticated;
 qr:=public.get_student_badge_qr('50000000-0000-0000-0000-000000000001',false);
 if qr !~ '^AOSQ1\.[a-f0-9]{64}$' or qr<>public.get_student_badge_qr('50000000-0000-0000-0000-000000000001',false) then raise exception 'active badge QR must be stable for physical reprint'; end if;
 primary_qr:=public.get_student_badge_qr('50000000-0000-0000-0000-000000000002',false);
 workspace:=public.badge_workspace('50000000-0000-0000-0000-000000000001');
 if not (workspace->>'can_manage')::boolean or workspace->>'qr'<>qr then raise exception 'authorized staff badge workspace mismatch'; end if;
 reset role;

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
 set local role authenticated;
 workspace:=public.badge_workspace('50000000-0000-0000-0000-000000000001');
 if (workspace->>'can_manage')::boolean or workspace->>'qr' is not null then raise exception 'parent received private operational QR'; end if;
 perform public.report_badge_lost('50000000-0000-0000-0000-000000000001','synthetic lost-badge test');
 workspace:=public.badge_workspace('50000000-0000-0000-0000-000000000001');
 reset role;

 if has_function_privilege('anon','public.student_kiosk_badge(text,text)','execute') or has_function_privilege('anon','public.student_kiosk_badge(text)','execute') then raise exception 'anonymous callers must not execute badge attendance functions'; end if;

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
 badge_audit_workspace:=public.badge_workspace('50000000-0000-0000-0000-000000000001');
 if badge_audit_workspace->>'qr'<>replacement or (select count(*) from public.student_badges where student_id='50000000-0000-0000-0000-000000000001' and active and state='active')<>1 then raise exception 'replacement must leave exactly one active badge'; end if;
 if not exists(select 1 from jsonb_array_elements(workspace->'events') event where event->>'action'='lost' and event->>'actor_role'='parent') then raise exception 'lost action must be attributed to linked parent'; end if;
 if has_table_privilege('authenticated',(select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname='badge_token_history'),'select') or has_table_privilege('authenticated',(select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname='student_badge_credentials'),'select') then raise exception 'authenticated users can read private badge credential tables'; end if;
 if has_table_privilege('authenticated','public.student_badges','update') then raise exception 'authenticated users can reactivate badges directly'; end if;
 failed:=false; begin update public.student_badges set active=true where student_id='50000000-0000-0000-0000-000000000001'; exception when insufficient_privilege then failed:=true; end;
 if not failed then raise exception 'direct badge reactivation bypassed lifecycle RPC'; end if;
 reset role;

 if has_function_privilege('anon','public.student_kiosk_scan(text,text,text)','execute') or has_function_privilege('anon','public.student_kiosk_badge(text,text)','execute') then raise exception 'anonymous attendance scan execute must be revoked';end if;
 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 set local role authenticated;
 pairing_result:=public.create_kiosk_device_pairing_code('Synthetic KIOS');
 pairing_code:=pairing_result->>'pairing_code';
 if pairing_code is null or length(pairing_code)<>32 then raise exception 'authorized staff must receive a one-time pairing code';end if;
 pairing_result:=public.pair_kiosk_device(pairing_code);
 device_token:=pairing_result->>'token';
 if device_token is null or length(device_token)<>64 then raise exception 'valid pairing code must enroll the KIOS browser';end if;
 failed:=false;begin perform public.pair_kiosk_device(pairing_code);exception when others then failed:=true;end;
 if not failed then raise exception 'pairing code must be single-use';end if;
 reset role;

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
 set local role authenticated;
 result:=public.student_kiosk_badge(replacement,device_token);
 if result->>'error'<>'invalid_badge' then raise exception 'staff without a KIOS permission cannot scan';end if;
 result:=public.student_kiosk_scan('AOS-CI-5001','123456',device_token);
 if result->>'error'<>'invalid_credentials' then raise exception 'staff without a KIOS permission cannot record manual attendance';end if;
 reset role;

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 set local role authenticated;
 result:=public.student_kiosk_badge(qr,device_token);
 if result->>'error'<>'invalid_badge' then raise exception 'lost badge QR must stop working on an enrolled device';end if;
 result:=public.student_kiosk_badge(replacement,'');
 if result->>'error'<>'invalid_badge' then raise exception 'staff session without enrolled device must not scan';end if;
 result:=public.student_kiosk_badge(replacement,device_token);
 if result->>'action'<>'check_in' then raise exception 'authorized staff and enrolled KIOS must check in';end if;
 result:=public.student_kiosk_badge(replacement,device_token);
 if result->>'action'<>'duplicate_scan' then raise exception 'duplicate scan must not toggle checkout';end if;
 result:=public.student_kiosk_scan('AOS-CI-5001','123456',device_token);
 if result->>'action'<>'duplicate_scan' then raise exception 'authorized manual scan should preserve existing attendance behavior';end if;
 perform public.revoke_kiosk_device((pairing_result->>'device_id')::uuid);
 result:=public.student_kiosk_badge(replacement,device_token);
 if result->>'error'<>'invalid_badge' then raise exception 'revoked KIOS device must lose scan access immediately';end if;
 reset role;


 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
 set local role authenticated;
 pairing_result:=public.create_kiosk_device_pairing_code('Second school KIOS',false);
 pairing_result:=public.pair_kiosk_device(pairing_result->>'pairing_code');
 general_token:=pairing_result->>'token';general_device:=(pairing_result->>'device_id')::uuid;
 pairing_result:=public.create_section_kiosk_pairing_code('Secondary KIOS','secondary');
 if pairing_result->>'section' is distinct from 'secondary' then raise exception 'pairing must keep the requested section';end if;
 pairing_result:=public.pair_kiosk_device(pairing_result->>'pairing_code');
 result:=public.student_kiosk_badge(primary_qr,pairing_result->>'token');
 if result->>'error' is distinct from 'kiosk_wrong_section_secondary' then raise exception 'Secondary KIOS must explain a Primary badge mismatch';end if;
 workspace:=public.kiosk_device_workspace();
 if not exists(select 1 from jsonb_array_elements(workspace->'devices') d where d->>'section'='secondary') then raise exception 'device list must show the new scope';end if;
 reset role;

 perform set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000005',true);
 set local role authenticated;
 failed:=false;begin perform public.create_kiosk_device_pairing_code('Coordinator wide device',false);exception when others then failed:=sqlerrm='not_authorized';end;
 if not failed then raise exception 'Kind coordinator must not create a school-wide device';end if;
 kind_pairing:=public.create_kiosk_device_pairing_code('Coordinator Kind KIOS',true);
 pairing_code:=kind_pairing->>'pairing_code';
 kind_pairing:=public.pair_kiosk_device(pairing_code);
 kind_token:=kind_pairing->>'token';
 if kind_token is null or kind_pairing->>'preschool_only'<>'true' then raise exception 'coordinator can pair a Kind-only kiosk';end if;
 workspace:=public.kiosk_device_workspace();
 if jsonb_array_length(workspace->'devices')<>1 or workspace->'devices'->0->>'preschool_only'<>'true' then raise exception 'coordinator device workspace must hide school-wide devices';end if;
 result:=public.student_kiosk_badge(replacement,general_token);
 if result->>'error'<>'invalid_badge' then raise exception 'coordinator cannot use a school-wide kiosk device';end if;
 result:=public.student_kiosk_badge(replacement,kind_token);
 if result->>'action'<>'duplicate_scan' then raise exception 'coordinator Kind kiosk can scan an actively enrolled Kind student';end if;
 result:=public.student_kiosk_badge(primary_qr,kind_token);
 if result->>'error' is distinct from 'kiosk_wrong_section_preschool' then raise exception 'Kind-only kiosk must explain the section mismatch';end if;
 failed:=false;begin perform public.create_section_kiosk_pairing_code('Coordinator primary KIOS','primary');exception when others then failed:=sqlerrm='not_authorized';end;
 if not failed then raise exception 'Kind coordinator must not create a primary device';end if;
 failed:=false;begin perform public.revoke_kiosk_device(general_device);exception when others then failed:=sqlerrm='not_authorized';end;
 if not failed then raise exception 'Kind coordinator must not revoke school-wide devices';end if;
 workspace:=public.school_kiosk_schedule_workspace();
 if (workspace->>'can_manage')::boolean or not (workspace->>'can_manage_preschool')::boolean or workspace->>'can_set_today_release'<>'false' or workspace->'schedule' ? 'entry_opens_at' then raise exception 'coordinator schedule workspace must expose only Kind settings';end if;
 failed:=false;begin perform public.save_school_kiosk_schedule(time '05:15',time '07:30',time '08:00',time '13:00',time '23:59',time '05:30',time '07:20',time '07:45',time '12:30',time '17:00');exception when others then failed:=sqlerrm='not_authorized';end;
 if not failed then raise exception 'Kind coordinator must not change school-wide hours';end if;
 perform public.save_preschool_kiosk_schedule(time '05:40',time '07:10',time '07:35',time '12:20',time '16:30');
 select entry_opens_at into school_entry from public.school_kiosk_schedules where school_id='10000000-0000-0000-0000-000000000001';
 if school_entry<>time '05:15' or (select preschool_entry_opens_at from public.school_kiosk_schedules where school_id='10000000-0000-0000-0000-000000000001')<>time '05:40' then raise exception 'Kind schedule save must not modify school-wide hours';end if;
 reset role;

 if not exists(select 1 from public.badge_scans scan where scan.student_id='50000000-0000-0000-0000-000000000002' and scan.result='kiosk_wrong_section_preschool') then raise exception 'verified wrong-section scan must appear in badge history';end if;
 if (select count(*) from public.notifications where type='lost_badge')<>1 then raise exception 'lost report should create one staff notice'; end if;
 if not exists(select 1 from public.student_badges where student_id='50000000-0000-0000-0000-000000000001' and state='lost' and not active) then raise exception 'lost badge history was not preserved'; end if;
 if not exists(select 1 from jsonb_array_elements(badge_audit_workspace->'events') event where event->>'action'='replaced') then raise exception 'badge replacement action was not audited'; end if;
end
$test$;
rollback;
