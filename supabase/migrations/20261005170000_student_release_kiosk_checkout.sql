-- A staff-recorded departure authorization may check an already-present
-- student out outside normal KIOS hours. Other blocked-window scans stay closed.
do $patch$
declare src text;anchor text;
begin
 select pg_get_functiondef('private.record_student_kiosk(uuid)'::regprocedure) into src;
 if position('student_release_kiosk_checkout' in src)>0 then return;end if;
 anchor:='if window_name=''blocked'' then return jsonb_build_object(''error'',''kiosk_closed'');end if;';
 if position(anchor in src)=0 then raise exception 'student_release_kiosk_patch_anchor_missing';end if;
 src:=replace(src,anchor,
   'if window_name=''blocked'' and exists(select 1 from public.student_release_cases r where r.student_id=s.id and r.school_id=s.school_id and r.status=''released'' and (r.released_at at time zone ''America/Port-au-Prince'')::date=d) then window_name:=''checkout'';end if;'
   ||anchor);
 -- Keep a marker in the function body so repeat application is idempotent.
 src:=replace(src,'if window_name=''blocked'' and exists(','/* student_release_kiosk_checkout */ if window_name=''blocked'' and exists(');
 execute src;
end $patch$;
