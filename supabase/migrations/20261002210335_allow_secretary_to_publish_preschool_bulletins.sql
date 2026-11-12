-- Keep the Preschool publish control available to the secretary role that
-- already manages the Preschool workspace and is allowed to publish bulletins.
do $migration$
declare
 source text;
 old_rule text := 'private.has_role(sid,array[''school_admin'',''director'',''censeur''])';
 new_rule text := 'private.has_role(sid,array[''school_admin'',''director'',''censeur'',''secretary''])';
begin
 select pg_get_functiondef('public.publish_preschool_bulletins(uuid,uuid,integer,text)'::regprocedure) into source;
 if position(old_rule in source)=0 or length(source)-length(replace(source,old_rule,''))<>length(old_rule) then
  raise exception 'unexpected_preschool_bulletin_publish_policy';
 end if;
 execute replace(source,old_rule,new_rule);
end
$migration$;
