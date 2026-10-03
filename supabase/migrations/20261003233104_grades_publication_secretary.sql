-- Keep grade publication aligned with the authorized school roles:
-- administrators, directors, censeurs and secretaries. Surveillants and teachers
-- remain excluded from the publication workflow.
create or replace function private.grade_reviewer(p_school uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null
    and private.has_role(p_school,array['school_admin','director','censeur','secretary'])
$$;

-- The review RPC has its own role check in addition to the shared helper.
do $migration$
declare
  source text;
  old_rule text := '''school_admin'',''director'',''censeur''';
  new_rule text := '''school_admin'',''director'',''censeur'',''secretary''';
begin
  select pg_get_functiondef('public.grade_publication_review()'::regprocedure) into source;
  if position(old_rule in source)=0
    or length(source)-length(replace(source,old_rule,''))<>length(old_rule) then
    raise exception 'unexpected_grade_publication_review_policy';
  end if;
  execute replace(source,old_rule,new_rule);
end
$migration$;

-- Notify every authorized reviewer when teachers submit grades for review.
do $migration$
declare
  source text;
  old_rule text := '''school_admin'',''director'',''censeur''';
  new_rule text := '''school_admin'',''director'',''censeur'',''secretary''';
begin
  select pg_get_functiondef('private.grade_event(uuid,text,text,jsonb,jsonb)'::regprocedure) into source;
  if position(old_rule in source)=0
    or length(source)-length(replace(source,old_rule,''))<>length(old_rule) then
    raise exception 'unexpected_grade_event_reviewer_policy';
  end if;
  execute replace(source,old_rule,new_rule);
end
$migration$;
