do $test$
declare owner_id uuid:=gen_random_uuid(); reviewer uuid:=gen_random_uuid(); sid uuid; member_id uuid; inv jsonb; denied boolean;
begin begin
 insert into auth.users(id,email,email_confirmed_at,role,aud) select id,id::text||'@example.invalid',now(),'authenticated','authenticated' from unnest(array[owner_id,reviewer]) id;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);set local role authenticated;
 sid:=public.create_school_onboarding('Reviewer fixture',gen_random_uuid()::text);
 inv:=public.create_school_invitation(reviewer::text||'@example.invalid','Reviewer','censeur');
 perform set_config('request.jwt.claim.sub',reviewer::text,true);perform public.accept_school_invitation(inv->>'token');
 if not private.has_role(sid,array['censeur']) or private.has_role(sid,array['surveillant','school_admin']) then raise exception 'TEST distinct reviewer role';end if;
 select id into member_id from public.school_members where school_id=sid and user_id=reviewer and role='censeur';
 denied:=false;begin perform public.manage_school_member(member_id,'role','director');exception when others then denied:=true;end;
 if not denied then raise exception 'TEST self elevation';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.manage_school_member(member_id,'role','teacher');
 perform public.manage_school_member(member_id,'role','censeur');
 if not exists(select 1 from public.school_members where id=member_id and role='censeur') then raise exception 'TEST admin role change';end if;
 reset role;raise exception using errcode='ZX004',message='fixtures passed';exception when sqlstate 'ZX004' then null;end;
end $test$;
select 'PASS censeur invitation, acceptance, role change, distinct permissions, denied self elevation; fixtures rolled back' as result;
