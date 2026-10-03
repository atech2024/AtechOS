-- Staff may review calculated grades, but families and students receive only
-- immutable bulletin snapshots that the school has published.
create function private.published_student_report_cards(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare report jsonb; published_cards jsonb;
begin
 report:=private.student_report_cards(p_student);
 if report is null then return null;end if;
 with latest as (
  select distinct on (card->>'class_id',card->>'period_id') card
  from jsonb_array_elements(coalesce(report->'document_history','[]'::jsonb)) card
  order by card->>'class_id',card->>'period_id',(card->'document'->>'version')::integer desc
 )
 select coalesce(jsonb_agg(card order by card->>'year' desc,card->>'start_date',card->>'class_name'),'[]'::jsonb)
 into published_cards from latest;
 return jsonb_set(report,'{cards}',published_cards,true);
end $$;
revoke all on function private.published_student_report_cards(uuid) from public,anon,authenticated;

create or replace function public.get_report_card(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid;
begin
 select school_id into sid from public.students where id=p_student;
 if sid is null then raise exception 'not_authorized';end if;
 if private.has_role(sid,array['school_admin','director','secretary','surveillant']) then
  return private.student_report_cards(p_student);
 end if;
 if not exists (
  select 1 from public.student_parents sp
  join public.parents p on p.id=sp.parent_id
  join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id and m.role='parent' and m.enabled
  where sp.student_id=p_student and p.school_id=sid and p.user_id=auth.uid()
 ) then raise exception 'not_authorized';end if;
 return private.published_student_report_cards(p_student);
end $$;
revoke all on function public.get_report_card(uuid) from public,anon,authenticated;
grant execute on function public.get_report_card(uuid) to authenticated;

-- Preserve the existing validated student-device token flow. Replace only
-- the report calculation inside that function; fail if its shape has changed.
do $$declare src text; patched text;begin
 select pg_get_functiondef('public.student_portal_overview(text)'::regprocedure) into src;
 patched:=regexp_replace(src,
  'private[.]student_report_cards[(][[:space:]]*s[.]id[[:space:]]*[)]',
  'private.published_student_report_cards(s.id)','g');
 if patched=src then raise exception 'student_portal_report_source_changed';end if;
 execute patched;
end $$;
