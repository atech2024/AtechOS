do $test$
declare actor uuid:=gen_random_uuid(); sid uuid;yr uuid;nextyr uuid;c1 uuid;c2 uuid;c3 uuid;child uuid;ident text;failed boolean;
begin begin
 insert into auth.users(id,email,email_confirmed_at,role,aud) values(actor,actor::text||'@example.invalid',now(),'authenticated','authenticated');
 perform set_config('request.jwt.claim.sub',actor::text,true);set local role authenticated;
 sid:=public.create_school_onboarding('Class guard fixture',gen_random_uuid()::text);
 yr:=public.create_academic_year('Source','2025-09-01','2026-06-30',true);
 nextyr:=public.create_academic_year('Target','2026-09-01','2027-06-30',false);
 c1:=public.create_class(yr,'First','AF1');c2:=public.create_class(yr,'Other','AF2');c3:=public.create_class(nextyr,'Next','AF2');
 child:=public.save_student_record(jsonb_build_object('first_name','Fixture','last_name','Child','class_id',c1));
 select r->>'atechos_id' into ident from public.get_student_records(child) r;
 perform public.save_student_record(jsonb_build_object('first_name','Updated','last_name','Child'),child);
 if not exists(select 1 from public.enrollments where student_id=child and class_id=c1 and status='active') then raise exception 'TEST profile update moved enrollment';end if;
 failed:=false;begin perform public.save_student_record(jsonb_build_object('first_name','Fixture','last_name','Child','class_id',c2),child);exception when others then failed:=sqlerrm='use_academic_progression';end;
 if not failed then raise exception 'TEST transfer RPC allowed';end if;
 failed:=false;begin update public.enrollments set class_id=c2 where student_id=child;exception when insufficient_privilege then failed:=true;end;
 if not failed then raise exception 'TEST direct enrollment write';end if;
 failed:=false;begin update public.students set atechos_id='FORGED' where id=child;exception when insufficient_privilege then failed:=true;end;
 if not failed then raise exception 'TEST permanent ID write';end if;
 failed:=false;begin perform public.apply_student_progression(nextyr,jsonb_build_array(jsonb_build_object('student_id',child,'class_id',c3)));exception when insufficient_privilege then failed:=true;end;
 if not failed then raise exception 'TEST unchecked progression endpoint';end if;
 perform public.confirm_student_progression(yr,nextyr,jsonb_build_array(jsonb_build_object('student_id',child,'decision','placement','class_id',c3)));
 if not exists(select 1 from public.enrollments where student_id=child and class_id=c3 and status='active') then raise exception 'TEST confirmed progression failed';end if;
 if not exists(select 1 from public.enrollments where student_id=child and class_id=c1) then raise exception 'TEST history lost';end if;
 if not exists(select 1 from public.get_student_records(child) r where r->>'atechos_id'=ident) then raise exception 'TEST identity changed';end if;
 reset role;raise exception using errcode='ZX004',message='fixtures passed';exception when sqlstate 'ZX004' then null;end;
end $test$;
select 'PASS initial enrollment, profile-only edit, blocked transfer/direct writes/ID changes, confirmed progression, preserved history; rolled back fixtures' as result;
