-- Keep AtechOS IDs out of the shared kiosk display and legacy staff scan RPC.
-- Students can still use their ID as a credential; the scan response only
-- returns the name, class, action, and attendance times needed by the kiosk.
do $$
declare src text;
begin
 select pg_get_functiondef('private.record_student_kiosk(uuid)'::regprocedure) into src;
 if position('''atechos_id'',s.atechos_id' in src)=0 then raise exception 'student_kiosk_response_source_changed';end if;
 src:=replace(src,'''atechos_id'',s.atechos_id,','');
 if position('''atechos_id''' in src)>0 then raise exception 'student_kiosk_id_still_present';end if;
 execute src;

 select pg_get_functiondef('public.scan_student_code(text,uuid)'::regprocedure) into src;
 if position('''atechos_id'',s.atechos_id' in src)=0 then raise exception 'staff_scan_response_source_changed';end if;
 src:=replace(src,'''atechos_id'',s.atechos_id,','');
 if position('''atechos_id''' in src)>0 then raise exception 'staff_scan_id_still_present';end if;
 execute src;
end $$;
