-- Give authorized follow-up staff a safe way to identify a student from a
-- physical badge without sending badge tokens or using a public lookup.
do $migration$
declare
  source text;
  old_projection text := 'jsonb_build_object(''id'',s.id,''name'',s.first_name||'' ''||s.last_name,''class'',cl.name)';
  new_projection text := 'jsonb_build_object(''id'',s.id,''name'',s.first_name||'' ''||s.last_name,''atechos_id'',s.atechos_id,''class'',cl.name)';
begin
  select pg_get_functiondef('public.student_followup_workspace()'::regprocedure) into source;
  if position(old_projection in source)=0 then
    raise exception 'unexpected_student_followup_workspace_projection';
  end if;
  execute replace(source,old_projection,new_projection);
end
$migration$;

create function public.lookup_student_for_followup_badge(p_qr text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  sid uuid:=public.get_my_school_id();
  result jsonb;
begin
  if not private.student_followup_authority(sid) then
    raise exception 'not_authorized';
  end if;
  if coalesce(p_qr,'') !~ '^AOSQ1\.[a-f0-9]{64}$' then
    raise exception 'invalid_badge';
  end if;

  select jsonb_build_object(
    'id',s.id,
    'name',s.first_name||' '||s.last_name,
    'atechos_id',s.atechos_id,
    'class',cl.name
  ) into result
  from private.badge_token_history h
  join public.student_badges b on b.id=h.badge_id
  join public.students s on s.id=b.student_id
  left join lateral (
    select c.name
    from public.enrollments e
    join public.classes c on c.id=e.class_id
    join public.academic_years y on y.id=c.academic_year_id
    where e.student_id=s.id and e.status='active'
      and c.school_id=s.school_id and y.is_current
    order by c.name limit 1
  ) cl on true
  where h.token_hash=encode(extensions.digest(substring(p_qr from 7),'sha256'),'hex')
    and b.school_id=sid and b.active and b.state='active'
    and s.school_id=sid and s.active and s.school_status='active';

  if result is null then raise exception 'badge_not_found'; end if;
  return result;
end $$;

revoke all on function public.lookup_student_for_followup_badge(text) from public,anon,authenticated;
grant execute on function public.lookup_student_for_followup_badge(text) to authenticated;

