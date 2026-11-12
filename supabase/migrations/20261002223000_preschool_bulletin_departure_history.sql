-- Keep Preschool bulletin history within the student's recorded departure year,
-- matching the family-specific Preschool bulletin RPC and numeric report cards.
create or replace function private.student_report_cards(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare base jsonb;cards jsonb;history jsonb;sid uuid;
begin
 base:=private.calculated_student_report_cards(p_student);
 if base is null then return null;end if;
 select school_id into sid from public.students where id=p_student;
 select coalesce(jsonb_agg(private.bulletin_card(v) order by v.published_at desc,v.version desc),'[]') into history
 from public.bulletin_versions v
 join public.students s on s.id=v.student_id and s.school_id=v.school_id
 join public.classes c on c.id=v.class_id
 join public.academic_years y on y.id=c.academic_year_id
 where v.student_id=p_student
  and (s.departure_year_id is null or y.start_date<=(select start_date from public.academic_years where id=s.departure_year_id));
 with latest as(
  select distinct on (c->>'class_id',c->>'period_id') c
  from jsonb_array_elements(history) c
  order by c->>'class_id',c->>'period_id',(c->'document'->>'version')::int desc
 ), visible as(
  select c from latest
  union all
  select c from jsonb_array_elements(base->'cards') c
  where not exists(select 1 from latest l where l.c->>'class_id'=c->>'class_id' and l.c->>'period_id'=c->>'period_id')
 )
 select coalesce(jsonb_agg(c order by c->>'year' desc,c->>'start_date',c->>'class_name'),'[]') into cards from visible;
 return base||jsonb_build_object(
  'cards',cards,
  'document_history',history,
  'preschool_cards',coalesce((
   select jsonb_agg(jsonb_build_object('id',v.id,'version',v.version,'published_at',v.published_at,'payload',v.payload) order by y.start_date desc,p.start_date desc,v.published_at desc)
   from public.preschool_bulletin_versions v
   join public.academic_years y on y.id=v.academic_year_id
   join public.grading_periods p on p.id=v.period_id
   join public.students s on s.id=v.student_id and s.school_id=v.school_id
   where v.school_id=sid and v.student_id=p_student
    and (s.departure_year_id is null or y.start_date<=(select start_date from public.academic_years where id=s.departure_year_id))
  ),'[]')
 );
end $$;
revoke all on function private.student_report_cards(uuid) from public,anon,authenticated;
