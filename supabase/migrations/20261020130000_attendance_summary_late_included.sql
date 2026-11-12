-- Dashboard presence totals treat a late arrival as present while keeping the
-- late count as a useful subset for staff.
do $attendance_summary_patch$
declare src text; old_count text:='a.status=''present''';
begin
 select pg_get_functiondef('public.dashboard_summary()'::regprocedure) into src;
 if length(src)-length(replace(src,old_count,''))<>length(old_count) then
  raise exception 'dashboard_summary_presence_anchor_missing_or_ambiguous';
 end if;
 src:=replace(src,old_count,'a.status in (''present'',''late'')');
 execute src;
end $attendance_summary_patch$;
