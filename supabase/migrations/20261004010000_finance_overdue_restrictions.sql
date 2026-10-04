-- Finance restrictions are explicit school choices and remain disabled by default.
-- Only an elapsed due date with a positive balance after validated payments and
-- approved reductions qualifies. Published bulletins from prior school years stay visible.
alter table public.finance_settings
  add column restrict_kiosk boolean not null default false,
  add column restrict_exams boolean not null default false,
  add column restrict_bulletins boolean not null default false;

drop function public.save_finance_settings(text,boolean,boolean);
create function public.save_finance_settings(
  p_currency_code text,
  p_director_can_validate boolean,
  p_proof_required boolean,
  p_restrict_kiosk boolean,
  p_restrict_exams boolean,
  p_restrict_bulletins boolean
) returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();
begin
  if auth.uid() is null or sid is null or not private.finance_manager(sid) then raise exception 'not_authorized'; end if;
  if p_currency_code !~ '^[A-Z]{3}$' then raise exception 'invalid_currency_code'; end if;
  insert into public.finance_settings(school_id,currency_code,director_can_validate,proof_required,restrict_kiosk,restrict_exams,restrict_bulletins,updated_at,updated_by)
  values(sid,p_currency_code,p_director_can_validate,p_proof_required,p_restrict_kiosk,p_restrict_exams,p_restrict_bulletins,now(),auth.uid())
  on conflict(school_id) do update set currency_code=excluded.currency_code,director_can_validate=excluded.director_can_validate,proof_required=excluded.proof_required,restrict_kiosk=excluded.restrict_kiosk,restrict_exams=excluded.restrict_exams,restrict_bulletins=excluded.restrict_bulletins,updated_at=now(),updated_by=auth.uid();
end $$;

-- Keep the previous RPC shape usable during staggered database/app rollouts;
-- an older client may update currency/proof rules without erasing restriction choices.
create function public.save_finance_settings(p_currency_code text,p_director_can_validate boolean,p_proof_required boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id(); kiosk boolean:=false; exams boolean:=false; bulletins boolean:=false;
begin
  if sid is not null then select restrict_kiosk,restrict_exams,restrict_bulletins into kiosk,exams,bulletins from public.finance_settings where school_id=sid; end if;
  perform public.save_finance_settings(p_currency_code,p_director_can_validate,p_proof_required,coalesce(kiosk,false),coalesce(exams,false),coalesce(bulletins,false));
end $$;

create or replace function private.finance_restriction_active(p_student uuid,p_channel text)
returns boolean language sql stable security definer set search_path=''
as $$
  select case p_channel
    when 'kiosk' then coalesce((select fs.restrict_kiosk from public.finance_settings fs where fs.school_id=s.school_id),false)
    when 'exams' then coalesce((select fs.restrict_exams from public.finance_settings fs where fs.school_id=s.school_id),false)
    when 'bulletins' then coalesce((select fs.restrict_bulletins from public.finance_settings fs where fs.school_id=s.school_id),false)
    else false
  end
  and exists (
    select 1 from public.finance_charges c
    where c.school_id=s.school_id and c.student_id=s.id
      and c.due_date < (now() at time zone 'America/Port-au-Prince')::date
      and greatest(0,c.amount
        - coalesce((select sum(a.amount) from public.finance_adjustments a where a.charge_id=c.id and a.status='approved' and a.adjustment_type<>'temporary_clearance'),0)
        - coalesce((select sum(p.amount) from public.finance_payments p where p.charge_id=c.id and p.status='validated'),0)) > 0
      and not exists (
        select 1 from public.finance_adjustments a where a.charge_id=c.id
          and a.status='approved' and a.adjustment_type='temporary_clearance'
          and a.valid_from<=now() and a.valid_until>now()
      )
  )
  from public.students s where s.id=p_student and s.active and s.school_status='active'
$$;
revoke all on function private.finance_restriction_active(uuid,text) from public,anon,authenticated;

-- Keep the exam calendar visible to staff and teachers. For the student/family
-- view, apply the school's optional restriction to both regular and official dates.
do $$
declare src text;
begin
  select pg_get_functiondef('public.school_calendar(uuid,text)'::regprocedure) into src;
  if position('official_exam_dates' in src)=0 then raise exception 'finance_exam_calendar_patch_anchor_missing'; end if;
  src:=replace(src,
    'where ex.school_id=sid and (staff_view or',
    'where ex.school_id=sid and (st is null or not private.finance_restriction_active(st,''exams'')) and (staff_view or');
  src:=replace(src,
    'where d.school_id=sid and (',
    'where d.school_id=sid and (st is null or not private.finance_restriction_active(st,''exams'')) and (');
  if position('not private.finance_restriction_active(st,''exams'')' in src)=0 then raise exception 'finance_exam_calendar_guard_patch_failed'; end if;
  execute src;
end $$;

-- Add an academic-year ID to the Preschool card payload so the visibility
-- filter can preserve every prior-year published card even when restrictions apply.
do $$
declare src text; patched text; count_before integer;
begin
  select pg_get_functiondef('private.student_report_cards(uuid)'::regprocedure) into src;
  count_before:=length(src)-length(replace(src,'jsonb_build_object(''id'',v.id,''version'',v.version',''));
  if count_before=0 then raise exception 'finance_preschool_bulletin_patch_anchor_missing'; end if;
  patched:=replace(src,'jsonb_build_object(''id'',v.id,''version'',v.version','jsonb_build_object(''id'',v.id,''academic_year_id'',v.academic_year_id,''version'',v.version');
  execute patched;
end $$;

create or replace function private.filter_finance_restricted_bulletins(p_student uuid,p_report jsonb)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid; current_year uuid; restricted boolean; result jsonb:=p_report;
begin
  if result is null then return null; end if;
  select school_id into sid from public.students where id=p_student;
  if sid is null or not private.finance_restriction_active(p_student,'bulletins') then return result; end if;
  select id into current_year from public.academic_years where school_id=sid and is_current order by start_date desc limit 1;
  if current_year is null then return result; end if;
  select coalesce(jsonb_agg(card),'[]'::jsonb) into result
  from jsonb_array_elements(coalesce(p_report->'cards','[]'::jsonb)) card
  where not exists(select 1 from public.classes c where c.id=(card->>'class_id')::uuid and c.academic_year_id=current_year);
  p_report:=jsonb_set(p_report,'{cards}',result,true);
  select coalesce(jsonb_agg(card),'[]'::jsonb) into result
  from jsonb_array_elements(coalesce(p_report->'document_history','[]'::jsonb)) card
  where not exists(select 1 from public.classes c where c.id=(card->>'class_id')::uuid and c.academic_year_id=current_year);
  p_report:=jsonb_set(p_report,'{document_history}',result,true);
  select coalesce(jsonb_agg(card),'[]'::jsonb) into result
  from jsonb_array_elements(coalesce(p_report->'preschool_cards','[]'::jsonb)) card
  where card->>'academic_year_id' is distinct from current_year::text;
  return jsonb_set(p_report,'{preschool_cards}',result,true);
end $$;
revoke all on function private.filter_finance_restricted_bulletins(uuid,jsonb) from public,anon,authenticated;

create or replace function private.published_student_report_cards(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare report jsonb; published_cards jsonb;
begin
 report:=private.student_report_cards(p_student);
 if report is null then return null; end if;
 with latest as (
  select distinct on (card->>'class_id',card->>'period_id') card
  from jsonb_array_elements(coalesce(report->'document_history','[]'::jsonb)) card
  order by card->>'class_id',card->>'period_id',(card->'document'->>'version')::integer desc
 )
 select coalesce(jsonb_agg(card order by card->>'year' desc,card->>'start_date',card->>'class_name'),'[]'::jsonb)
 into published_cards from latest;
 report:=jsonb_set(report,'{cards}',published_cards,true);
 return private.filter_finance_restricted_bulletins(p_student,report);
end $$;

-- Recompile the family report RPC so it calls the newly protected wrapper.
do $$declare src text;begin
 select pg_get_functiondef('public.get_report_card(uuid)'::regprocedure) into src;execute src;
end $$;

-- Protect the public QR scan at its database boundary; rejected scans are still
-- logged as rejected and carry no student identity in the public response.
create or replace function public.student_kiosk_badge(p_qr text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.student_badges; payload jsonb;
begin
 if coalesce(p_qr,'') !~ '^AOSQ1\.[a-f0-9]{64}$' then return jsonb_build_object('error','invalid_badge'); end if;
 select sb.* into b from private.badge_token_history h join public.student_badges sb on sb.id=h.badge_id
 where h.token_hash=encode(extensions.digest(substring(p_qr from 7),'sha256'),'hex');
 if b.id is null then return jsonb_build_object('error','invalid_badge'); end if;
 perform 1 from public.students where id=b.student_id for update;
 select * into b from public.student_badges where id=b.id;
 if not b.active or b.state<>'active' then payload:=jsonb_build_object('error','invalid_badge');
 elsif private.finance_restriction_active(b.student_id,'kiosk') then payload:=jsonb_build_object('error','financial_restriction');
 else payload:=private.record_student_kiosk(b.student_id); end if;
 insert into public.badge_scans(school_id,student_id,badge_id,result)
 values(b.school_id,b.student_id,b.id,case when not b.active then 'rejected_'||b.state else coalesce(payload->>'action',payload->>'error','error') end);
 return payload;
end $$;

-- The legacy typed-ID/PIN KIOS path remains supported and must obey the same
-- selected school restriction after successful authentication.
do $$
declare src text;
begin
  select pg_get_functiondef('public.student_kiosk_scan(text,text)'::regprocedure) into src;
  src:=replace(src,
    'return private.record_student_kiosk(s.id);',
    'if private.finance_restriction_active(s.id,''kiosk'') then return jsonb_build_object(''error'',''financial_restriction''); end if; return private.record_student_kiosk(s.id);');
  if position('finance_restriction_active(s.id,''kiosk'')' in src)=0 then raise exception 'finance_typed_kiosk_patch_anchor_missing'; end if;
  execute src;
end $$;

revoke all on function public.save_finance_settings(text,boolean,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.save_finance_settings(text,boolean,boolean,boolean,boolean,boolean) to authenticated;
revoke all on function public.save_finance_settings(text,boolean,boolean) from public,anon;
grant execute on function public.save_finance_settings(text,boolean,boolean) to authenticated;
revoke all on function public.student_kiosk_badge(text) from public,anon,authenticated;
grant execute on function public.student_kiosk_badge(text) to anon,authenticated;
