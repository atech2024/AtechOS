-- Return a tenant scope key only to the existing token-authenticated student calendar.
-- No data visibility, grants, or RLS rules change.
do $$
declare
 source text;
 patched text;
begin
 select pg_get_functiondef('public.school_calendar(uuid,text)'::regprocedure) into source;
 if position('school_scope_id' in source)>0 then return;end if;
 patched:=regexp_replace(source,
  'return jsonb_build_object[(][[:space:]]*''can_manage''[[:space:]]*,[[:space:]]*manage',
  'return jsonb_build_object(''school_scope_id'',case when p_token is not null then sid else null end,''can_manage'',manage',
  'i');
 if patched is not distinct from source then raise exception 'school_calendar_scope_patch_anchor_missing';end if;
 execute patched;
end $$;
