-- Audit verified wrong-section QR scans without recording attendance.
do $audit_patch$
declare src text; anchor text:='if scope_result<>''authorized'' then';
begin
 select pg_get_functiondef('public.student_kiosk_badge(text,text)'::regprocedure) into src;
 if length(src)-length(replace(src,anchor,''))<>length(anchor) then
   raise exception 'kiosk_section_audit_anchor_mismatch';
 end if;
 execute replace(src,anchor,anchor||$body$
     if scope_result in ('kiosk_wrong_section_preschool','kiosk_wrong_section_primary','kiosk_wrong_section_fundamental','kiosk_wrong_section_secondary')
        and b.active and b.state='active' then
       insert into public.badge_scans(school_id,student_id,badge_id,result)
       values(b.school_id,b.student_id,b.id,scope_result);
     end if;
 $body$);
end
$audit_patch$;
