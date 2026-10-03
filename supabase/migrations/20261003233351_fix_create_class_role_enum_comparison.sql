-- The school_role enum cannot be compared with a text[] using = ANY(text[]).
-- Cast the enum to text so administrators, directors and secretaries can create
-- classes while preserving the existing section and year checks.
do $migration$
declare
  source text;
  old_rule text := 'm.role = any(array[''school_admin'', ''director'', ''secretary''])';
  new_rule text := 'm.role::text = any(array[''school_admin'', ''director'', ''secretary''])';
begin
  select pg_get_functiondef('public.create_class(uuid,text,text,text,uuid)'::regprocedure) into source;
  if position(old_rule in source)=0
    or length(source)-length(replace(source,old_rule,''))<>length(old_rule) then
    raise exception 'unexpected_create_class_role_rule';
  end if;
  execute replace(source,old_rule,new_rule);
end
$migration$;
