-- Censeur inherits supervision capabilities, never administrator membership.
create or replace function private.has_role(sid uuid,roles text[]) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
  exists(select 1 from public.schools where id=sid and owner_user_id=auth.uid())
  or exists(select 1 from public.school_members where school_id=sid and user_id=auth.uid() and enabled
   and (role::text=any(roles) or (role='censeur' and 'surveillant'=any(roles))))
 );
$$;
-- Retain the actual account role in staff attendance attribution.
do $$declare src text;anchor text:='role in (''school_admin'',''director'',''secretary'',''surveillant'')';begin
 select pg_get_functiondef('public.staff_mark_attendance(uuid,uuid,text)'::regprocedure) into src;
 if position(anchor in src)=0 then raise exception 'attendance_role_anchor_missing';end if;
 src:=replace(src,anchor,'role in (''school_admin'',''director'',''secretary'',''surveillant'',''censeur'')');
 execute src;
end $$;
