-- Let Censeurs administer sanctions and confirm school departure decisions.
-- Emergency medical/exceptional release cases remain restricted to the existing
-- school_admin, director, and secretary authority.
create or replace function private.student_sanction_management_authority(p_school uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null
    and private.has_role(p_school,array['school_admin','director','secretary','censeur'])
$$;
revoke all on function private.student_sanction_management_authority(uuid) from public,anon,authenticated;

create or replace function private.student_followup_actor_role(p_school uuid)
returns text language sql stable security definer set search_path=''
as $$
  select coalesce(
    (select m.role::text from public.school_members m
      where m.school_id=p_school and m.user_id=auth.uid() and m.enabled
        and m.role::text in ('school_admin','director','censeur','secretary')
      order by case m.role::text when 'school_admin' then 0 when 'director' then 1 when 'censeur' then 2 else 3 end
      limit 1),
    (select m.role::text from public.school_members m
      where m.school_id=p_school and m.user_id=auth.uid() and m.enabled and m.role::text='parent' limit 1)
  )
$$;
revoke all on function private.student_followup_actor_role(uuid) from public,anon,authenticated;

do $censeur_sanction_permissions$
declare
  target regprocedure;
  source text;
  rewritten text;
  targets regprocedure[] := array[
    'public.save_student_sanction_type(uuid,text,boolean,text,smallint)'::regprocedure,
    'private.create_student_sanction_record(uuid,uuid,text,timestamp with time zone)'::regprocedure,
    'public.create_student_sanction(uuid,uuid,text,timestamp with time zone)'::regprocedure,
    'public.create_student_sanctions_bulk(uuid[],uuid,text,timestamp with time zone)'::regprocedure,
    'public.student_followup_class_attendees(uuid,date)'::regprocedure,
    'public.create_class_student_sanctions(uuid,uuid,text,timestamp with time zone,uuid[])'::regprocedure,
    'public.student_followup_workspace()'::regprocedure,
    'public.resolve_student_sanction(uuid,text)'::regprocedure,
    'public.decide_student_sanction_departure(uuid,text,text)'::regprocedure
  ];
begin
  foreach target in array targets loop
    select pg_get_functiondef(target) into source;
    rewritten:=replace(source,'private.student_followup_authority(','private.student_sanction_management_authority(');
    if target='public.decide_student_sanction_departure(uuid,text,text)'::regprocedure then
      rewritten:=replace(rewritten,
        'private.has_role(sid,array[''director'',''school_admin''])',
        'private.has_role(sid,array[''director'',''school_admin'',''censeur''])');
    end if;
    if target='public.student_followup_workspace()'::regprocedure then
      if position('return result;' in rewritten)=0 then raise exception 'censeur_workspace_return_anchor_missing'; end if;
      rewritten:=replace(rewritten,'return result;',
        'result:=result||jsonb_build_object(''can_manage_releases'',private.student_followup_authority(sid));'||
        'if not private.student_followup_authority(sid) then result:=result||jsonb_build_object(''contacts'',''[]''::jsonb,''releases'',''[]''::jsonb); end if;'||
        'return result;');
    end if;
    if rewritten=source then raise exception 'censeur_sanction_authorization_anchor_missing: %',target; end if;
    execute rewritten;
  end loop;
end
$censeur_sanction_permissions$;

revoke all on function public.save_student_sanction_type(uuid,text,boolean,text,smallint),
  public.create_student_sanction(uuid,uuid,text,timestamptz),
  public.create_student_sanctions_bulk(uuid[],uuid,text,timestamptz),
  public.student_followup_class_attendees(uuid,date),
  public.create_class_student_sanctions(uuid,uuid,text,timestamptz,uuid[]),
  public.student_followup_workspace(),public.resolve_student_sanction(uuid,text),
  public.decide_student_sanction_departure(uuid,text,text) from public,anon;
grant execute on function public.save_student_sanction_type(uuid,text,boolean,text,smallint),
  public.create_student_sanction(uuid,uuid,text,timestamptz),
  public.create_student_sanctions_bulk(uuid[],uuid,text,timestamptz),
  public.student_followup_class_attendees(uuid,date),
  public.create_class_student_sanctions(uuid,uuid,text,timestamptz,uuid[]),
  public.student_followup_workspace(),public.resolve_student_sanction(uuid,text),
  public.decide_student_sanction_departure(uuid,text,text) to authenticated;
