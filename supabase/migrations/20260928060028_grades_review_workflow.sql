-- Keep existing official grades; never invent historical reviewer identities.
alter table public.grades add column workflow_state text not null default 'draft'
 check(workflow_state in ('draft','submitted','returned','reviewed','published'));
-- Backfill status without revalidating historical periods or deadlines.
alter table public.grades disable trigger enforce_grade_deadline;
alter table public.grades disable trigger validate_grade_period;
update public.grades set workflow_state='published' where published;
alter table public.grades enable trigger validate_grade_period;
alter table public.grades enable trigger enforce_grade_deadline;
alter table public.grades add constraint grade_publication_state check(published=(workflow_state='published'));
create table public.grade_events(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 grade_id uuid not null references public.grades(id),actor_id uuid,actor_name text,actor_role text,
 action text not null,reason text,old_value jsonb,new_value jsonb,created_at timestamptz not null default now()
);
create index grade_events_record_time on public.grade_events(grade_id,created_at desc);
create table public.grade_corrections(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 grade_id uuid not null references public.grades(id),requested_by uuid not null references public.users(id),
 proposed jsonb not null,reason text not null,state text not null default 'submitted'
 check(state in ('submitted','returned','reviewed','published')),
 reviewed_by uuid references public.users(id),published_by uuid references public.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index grade_one_pending_correction on public.grade_corrections(grade_id) where state in ('submitted','reviewed');
alter table public.grade_events enable row level security;
alter table public.grade_corrections enable row level security;
revoke all on public.grade_events,public.grade_corrections from public,anon,authenticated;
revoke insert,update,delete on public.grades from public,anon,authenticated;
revoke all on function public.update_grade(uuid,numeric,numeric,text,text,uuid,numeric),public.publish_class_grades(uuid,uuid) from public,anon,authenticated;
-- create_grade already validates the school, role, active enrollment and assigned subject.
alter function public.create_grade(uuid,uuid,uuid,text,numeric,numeric,text,uuid,numeric) security definer;
alter function public.create_grade(uuid,uuid,uuid,text,numeric,numeric,text,uuid,numeric) set search_path='';
revoke all on function public.create_grade(uuid,uuid,uuid,text,numeric,numeric,text,uuid,numeric) from public,anon;
grant execute on function public.create_grade(uuid,uuid,uuid,text,numeric,numeric,text,uuid,numeric) to authenticated;
create function private.grade_reviewer(p_school uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.has_role(p_school,array['school_admin','director','censeur'])
$$;
create policy grades_reviewer_read on public.grades for select to authenticated using(private.grade_reviewer(school_id));
create function private.grade_event(p_grade uuid,p_action text,p_reason text,p_old jsonb,p_new jsonb) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;eid uuid;uid uuid:=auth.uid();begin
 select school_id into sid from public.grades where id=p_grade;
 insert into public.grade_events(school_id,grade_id,actor_id,actor_name,actor_role,action,reason,old_value,new_value)
 values(sid,p_grade,uid,(select full_name from public.users where id=uid),
 (select role::text from public.school_members where school_id=sid and user_id=uid and enabled order by case role::text when 'school_admin' then 0 when 'director' then 1 when 'censeur' then 2 else 3 end limit 1),p_action,p_reason,p_old,p_new) returning id into eid;
 if p_action in ('submitted','correction_requested') then
  insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
  select distinct sid,m.user_id,'grades','Grades awaiting review','A teacher submitted grades for academic review.','normal','/dashboard/publication','grade:'||eid::text||':'||m.user_id::text
  from public.school_members m where m.school_id=sid and m.enabled and m.role in ('school_admin','director','censeur');
 elsif p_action in ('returned','reviewed','published','correction_returned','correction_reviewed','correction_published') then
  insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
  select sid,g.teacher_id,'grades','Grade workflow updated',p_action||coalesce(': '||p_reason,''),'normal','/dashboard/grades','grade:'||eid::text
  from public.grades g where g.id=p_grade and g.teacher_id is not null;
 end if;
end $$;
create function private.audit_grade_insert() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform private.grade_event(new.id,'created',null,null,to_jsonb(new));return new;
end $$;
create trigger grade_created_audit after insert on public.grades for each row execute function private.audit_grade_insert();
create or replace function private.protect_grade_publication() returns trigger language plpgsql security definer set search_path='' as $$begin
 if (tg_op='INSERT' and new.published) or (tg_op='UPDATE' and new.published is distinct from old.published) then
  if not private.grade_reviewer(new.school_id) then raise exception 'publication_requires_reviewer';end if;
 end if;return new;
end $$;
create or replace function private.enforce_grade_deadline() returns trigger language plpgsql security definer set search_path='' as $$
declare g public.grades;begin
 if tg_op='DELETE' then g:=old;else g:=new;end if;
 if not private.grade_reviewer(g.school_id) and exists(select 1 from public.category_grade_deadlines d join public.classes c on c.id=g.class_id where d.period_id=g.grading_period_id and d.section=public.grade_section(c.grade_level) and now()>d.deadline) then raise exception 'grade_deadline_passed';end if;
 if tg_op='UPDATE' and not private.grade_reviewer(old.school_id) and exists(select 1 from public.category_grade_deadlines d join public.classes c on c.id=old.class_id where d.period_id=old.grading_period_id and d.section=public.grade_section(c.grade_level) and now()>d.deadline) then raise exception 'grade_deadline_passed';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create function public.revise_grade(p_grade uuid,p_score numeric,p_max_score numeric,p_note text,p_reason text)
returns text language plpgsql security definer set search_path='' as $$
declare g public.grades;after_grade public.grades;proposal jsonb;begin
 select * into g from public.grades where id=p_grade for update;
 if g.id is null or g.school_id is distinct from public.get_my_school_id() or not private.write_academic(g.school_id,g.class_id,g.subject_id) or not (g.teacher_id=auth.uid() or private.has_role(g.school_id,array['school_admin','director'])) then raise exception 'not_authorized';end if;
 if p_score is null or p_max_score is null or p_score::text in ('NaN','Infinity','-Infinity') or p_max_score::text in ('NaN','Infinity','-Infinity') or p_score<0 or p_max_score<=0 or p_score>p_max_score then raise exception 'invalid_grade';end if;
 if length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>1000 then raise exception 'reason_required';end if;
 if g.workflow_state in ('submitted','reviewed') then raise exception 'grade_locked_pending_review';end if;
 if not private.grade_reviewer(g.school_id) and exists(select 1 from public.category_grade_deadlines d join public.classes c on c.id=g.class_id where d.period_id=g.grading_period_id and d.section=public.grade_section(c.grade_level) and now()>d.deadline) then raise exception 'grade_deadline_passed';end if;
 proposal:=jsonb_build_object('score',p_score,'max_score',p_max_score,'note',p_note);
 if g.published then
  if exists(select 1 from public.grade_corrections where grade_id=g.id and state in ('submitted','reviewed')) then raise exception 'correction_already_pending';end if;
  insert into public.grade_corrections(school_id,grade_id,requested_by,proposed,reason) values(g.school_id,g.id,auth.uid(),proposal,trim(p_reason));
  perform private.grade_event(g.id,'correction_requested',trim(p_reason),to_jsonb(g),proposal);
  return 'correction_submitted';
 end if;
 update public.grades set score=p_score,max_score=p_max_score,note=p_note,graded_at=now(),workflow_state='draft' where id=g.id returning * into after_grade;
 perform private.grade_event(g.id,'modified',trim(p_reason),to_jsonb(g),to_jsonb(after_grade));return 'draft';
end $$;
create function public.submit_grades(p_ids uuid[]) returns integer language plpgsql security definer set search_path='' as $$
declare g public.grades;n integer:=0;begin
 if auth.uid() is null or coalesce(cardinality(p_ids),0)=0 then raise exception 'empty_selection';end if;
 if cardinality(p_ids)>1000 then raise exception 'selection_too_large';end if;
 perform 1 from public.grades where id=any(p_ids) order by id for update;
 if exists(select 1 from unnest(p_ids) x(id) where not exists(select 1 from public.grades where id=x.id)) then raise exception 'invalid_selection';end if;
 for g in select * from public.grades where id=any(p_ids) order by id loop
  if g.school_id is distinct from public.get_my_school_id() or not private.write_academic(g.school_id,g.class_id,g.subject_id) or not (g.teacher_id=auth.uid() or private.has_role(g.school_id,array['school_admin','director'])) then raise exception 'not_authorized';end if;
  if g.workflow_state not in ('draft','returned') or g.grading_period_id is null then raise exception 'grade_not_submittable';end if;
  update public.grades set workflow_state='submitted' where id=g.id;
  perform private.grade_event(g.id,'submitted',null,to_jsonb(g),jsonb_build_object('workflow_state','submitted'));n:=n+1;
 end loop;return n;
end $$;
create function public.review_grades(p_ids uuid[],p_action text,p_reason text default null) returns integer language plpgsql security definer set search_path='' as $$
declare g public.grades;n integer:=0;target text;begin
 if not private.grade_reviewer(public.get_my_school_id()) then raise exception 'not_authorized';end if;
 if p_action is null or p_action not in ('approve','return') or coalesce(cardinality(p_ids),0)=0 or cardinality(p_ids)>1000 then raise exception 'invalid_selection';end if;
 if p_action='return' and length(trim(coalesce(p_reason,'')))<3 then raise exception 'reason_required';end if;
 target:=case when p_action='approve' then 'reviewed' else 'returned' end;
 perform 1 from public.grades where id=any(p_ids) order by id for update;
 if exists(select 1 from unnest(p_ids) x(id) where not exists(select 1 from public.grades where id=x.id)) then raise exception 'invalid_selection';end if;
 for g in select * from public.grades where id=any(p_ids) order by id loop
  if g.school_id is distinct from public.get_my_school_id() or g.workflow_state<>'submitted' then raise exception 'grade_not_pending_review';end if;
  update public.grades set workflow_state=target where id=g.id;
  perform private.grade_event(g.id,target,p_reason,to_jsonb(g),jsonb_build_object('workflow_state',target));n:=n+1;
 end loop;return n;
end $$;
create or replace function public.publish_reviewed_grades(p_ids uuid[]) returns integer language plpgsql security definer set search_path='' as $$
declare g public.grades;n integer:=0;begin
 if not private.grade_reviewer(public.get_my_school_id()) then raise exception 'not_authorized';end if;
 if coalesce(cardinality(p_ids),0)=0 or cardinality(p_ids)>1000 then raise exception 'invalid_selection';end if;
 perform 1 from public.grades where id=any(p_ids) order by id for update;
 if exists(select 1 from unnest(p_ids) x(id) where not exists(select 1 from public.grades where id=x.id)) then raise exception 'invalid_selection';end if;
 for g in select * from public.grades where id=any(p_ids) order by id loop
  if g.school_id is distinct from public.get_my_school_id() or g.workflow_state<>'reviewed' or g.grading_period_id is null then raise exception 'review_required';end if;
  update public.grades set published=true,workflow_state='published' where id=g.id;
  perform private.grade_event(g.id,'published',null,to_jsonb(g),jsonb_build_object('workflow_state','published','published',true));n:=n+1;
 end loop;return n;
end $$;
create function public.review_grade_correction(p_id uuid,p_action text,p_reason text default null) returns void language plpgsql security definer set search_path='' as $$
declare c public.grade_corrections;g public.grades;after_grade public.grades;begin
 if not private.grade_reviewer(public.get_my_school_id()) then raise exception 'not_authorized';end if;
 select * into c from public.grade_corrections where id=p_id;
 if c.id is null or c.school_id is distinct from public.get_my_school_id() then raise exception 'not_authorized';end if;
 select * into g from public.grades where id=c.grade_id for update;
 select * into c from public.grade_corrections where id=p_id for update;
 if p_action='approve' and c.state='submitted' then
  update public.grade_corrections set state='reviewed',reviewed_by=auth.uid(),updated_at=now() where id=c.id;
  perform private.grade_event(g.id,'correction_reviewed',p_reason,to_jsonb(g),c.proposed);
 elsif p_action='return' and c.state in ('submitted','reviewed') then
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'reason_required';end if;
  update public.grade_corrections set state='returned',reviewed_by=auth.uid(),updated_at=now() where id=c.id;
  perform private.grade_event(g.id,'correction_returned',p_reason,to_jsonb(g),c.proposed);
 elsif p_action='publish' and c.state='reviewed' then
  if not g.published then raise exception 'original_not_published';end if;
  update public.grades set score=(c.proposed->>'score')::numeric,max_score=(c.proposed->>'max_score')::numeric,note=c.proposed->>'note',graded_at=now() where id=g.id returning * into after_grade;
  update public.grade_corrections set state='published',published_by=auth.uid(),updated_at=now() where id=c.id;
  perform private.grade_event(g.id,'correction_published',c.reason,to_jsonb(g),to_jsonb(after_grade));
 else raise exception 'invalid_correction_transition';end if;
end $$;
create function public.grade_history(p_grade uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare g public.grades;begin
 select * into g from public.grades where id=p_grade;
 if g.id is null or g.school_id is distinct from public.get_my_school_id() or not (private.grade_reviewer(g.school_id) or (g.teacher_id=auth.uid() and private.teaches(g.class_id,g.subject_id))) then raise exception 'not_authorized';end if;
 return jsonb_build_object('events',coalesce((select jsonb_agg(to_jsonb(e) order by created_at desc) from public.grade_events e where grade_id=p_grade),'[]'),'corrections',coalesce((select jsonb_agg(to_jsonb(c) order by created_at desc) from public.grade_corrections c where grade_id=p_grade),'[]'));
end $$;
revoke all on function private.grade_reviewer(uuid),private.grade_event(uuid,text,text,jsonb,jsonb),private.audit_grade_insert() from public,anon,authenticated;
-- RLS policy helper must be executable by authenticated; it reveals only their own reviewer status.
grant execute on function private.grade_reviewer(uuid) to authenticated;
revoke all on function public.revise_grade(uuid,numeric,numeric,text,text),public.submit_grades(uuid[]),public.review_grades(uuid[],text,text),public.review_grade_correction(uuid,text,text),public.grade_history(uuid),public.publish_reviewed_grades(uuid[]) from public,anon;
grant execute on function public.revise_grade(uuid,numeric,numeric,text,text),public.submit_grades(uuid[]),public.review_grades(uuid[],text,text),public.review_grade_correction(uuid,text,text),public.grade_history(uuid),public.publish_reviewed_grades(uuid[]) to authenticated;

-- Extend the existing review data without changing report-card calculations.
do $$declare src text;begin
 select pg_get_functiondef('public.grade_publication_review()'::regprocedure) into src;
 if position('''school_admin'',''director'',''secretary'',''surveillant''' in src)=0 then raise exception 'unexpected_publication_review_definition';end if;
 src:=replace(src,'''school_admin'',''director'',''secretary'',''surveillant''','''school_admin'',''director'',''censeur''');
 src:=replace(src,'''published'',g.published','''published'',g.published,''workflow_state'',g.workflow_state');
 execute src;
end $$;
create function public.grade_corrections_review() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not private.grade_reviewer(public.get_my_school_id()) then raise exception 'not_authorized';end if;
 return coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('student',s.first_name||' '||s.last_name,'subject',su.name,'class',cl.name,'score',g.score,'max_score',g.max_score,'teacher',u.full_name) order by c.created_at desc) from public.grade_corrections c join public.grades g on g.id=c.grade_id join public.students s on s.id=g.student_id join public.subjects su on su.id=g.subject_id join public.classes cl on cl.id=g.class_id join public.users u on u.id=c.requested_by where c.school_id=public.get_my_school_id() and c.state in ('submitted','reviewed')),'[]');
end $$;
create function public.grade_workflow_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();reviewer boolean:=private.grade_reviewer(sid);begin
 if auth.uid() is null then raise exception 'not_authorized';end if;
 return jsonb_build_object('reviewer',reviewer,'submitted',(select count(*) from public.grades g where g.school_id=sid and g.workflow_state='submitted' and (reviewer or(g.teacher_id=auth.uid() and private.teaches(g.class_id,g.subject_id)))),
 'reviewed',(select count(*) from public.grades g where g.school_id=sid and g.workflow_state='reviewed' and (reviewer or(g.teacher_id=auth.uid() and private.teaches(g.class_id,g.subject_id)))),
 'returned',(select count(*) from public.grades g where g.school_id=sid and g.workflow_state='returned' and (reviewer or(g.teacher_id=auth.uid() and private.teaches(g.class_id,g.subject_id)))),
 'corrections',(select count(*) from public.grade_corrections c where c.school_id=sid and c.state in ('submitted','reviewed') and (reviewer or c.requested_by=auth.uid())));
end $$;
create or replace function public.save_grade_deadline(p_period uuid,p_section text,p_deadline timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;begin
 select school_id into sid from public.grading_periods where id=p_period;
 if sid is null or not private.grade_reviewer(sid) or sid is distinct from public.get_my_school_id() then raise exception 'not_authorized';end if;
 if p_section is null or p_section not in ('preschool','primary','fundamental','secondary') or p_deadline is null then raise exception 'invalid_deadline';end if;
 insert into public.category_grade_deadlines(period_id,section,deadline) values(p_period,p_section,p_deadline) on conflict(period_id,section) do update set deadline=excluded.deadline;
end $$;
-- Old deadline RPC cannot overwrite published exam dates through this screen.
revoke all on function public.set_category_grade_deadline(uuid,text,timestamptz,date,date) from public,anon,authenticated;
revoke all on function public.grade_corrections_review(),public.grade_workflow_summary(),public.save_grade_deadline(uuid,text,timestamptz) from public,anon;
grant execute on function public.grade_corrections_review(),public.grade_workflow_summary(),public.save_grade_deadline(uuid,text,timestamptz) to authenticated;

create function private.validate_grade_values() returns trigger language plpgsql set search_path='' as $$begin
 if new.score::text in ('NaN','Infinity','-Infinity') or new.max_score::text in ('NaN','Infinity','-Infinity') or new.assessment_weight::text in ('NaN','Infinity','-Infinity') then raise exception 'invalid_grade';end if;
 return new;
end $$;
create trigger validate_grade_values before insert or update of score,max_score,assessment_weight on public.grades for each row execute function private.validate_grade_values();
revoke all on function private.validate_grade_values() from public,anon,authenticated;
