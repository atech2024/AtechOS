alter table public.subjects
 add column if not exists default_max_score numeric(10,2);

do $$ begin
 if not exists (
  select 1 from pg_constraint
  where conrelid='public.subjects'::regclass
   and conname='subjects_default_max_score_positive'
 ) then
  alter table public.subjects add constraint subjects_default_max_score_positive
   check (default_max_score is null or default_max_score > 0);
 end if;
end $$;

create table public.grade_deadline_exceptions (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 teacher_id uuid not null references public.users(id),
 class_id uuid not null references public.classes(id),
 subject_id uuid not null references public.subjects(id),
 period_id uuid not null references public.grading_periods(id),
 expires_at timestamptz not null,
 granted_by uuid not null references public.users(id),
 reason text not null check (length(trim(reason)) >= 3),
 created_at timestamptz not null default now(),
 revoked_at timestamptz,
 revoked_by uuid references public.users(id),
 revoke_reason text
);
create index grade_deadline_exceptions_scope_idx
 on public.grade_deadline_exceptions(school_id,teacher_id,class_id,subject_id,period_id,expires_at desc)
 where revoked_at is null;
alter table public.grade_deadline_exceptions enable row level security;
revoke all on public.grade_deadline_exceptions from public,anon,authenticated;

create or replace function private.grade_deadline_exception_active(
 p_school uuid,p_teacher uuid,p_class uuid,p_subject uuid,p_period uuid
) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid()=p_teacher and exists(
  select 1 from public.grade_deadline_exceptions x
  where x.school_id=p_school and x.teacher_id=p_teacher and x.class_id=p_class
   and x.subject_id=p_subject and x.period_id=p_period
   and x.revoked_at is null and x.created_at<=now() and x.expires_at>now()
 )
$$;
revoke all on function private.grade_deadline_exception_active(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.grant_grade_deadline_exception(
 p_teacher uuid,p_class uuid,p_subject uuid,p_period uuid,p_expires_at timestamptz,p_reason text
) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id(); actor uuid:=auth.uid(); new_id uuid; section_name text;
begin
 if actor is null or sid is null or not private.grade_reviewer(sid) then raise exception 'not_authorized';end if;
 if p_teacher is null or p_class is null or p_subject is null or p_period is null
  or p_expires_at is null or not isfinite(p_expires_at) or p_expires_at<=now()
  or length(trim(coalesce(p_reason,'')))<3 then raise exception 'invalid_grade_deadline_exception';end if;
 select public.grade_section(c.grade_level) into section_name
 from public.classes c join public.academic_years y on y.id=c.academic_year_id and y.is_current and y.school_id=sid
 join public.grading_periods p on p.id=p_period and p.school_id=sid and p.academic_year_id=y.id and p.is_active
 where c.id=p_class and c.school_id=sid and c.enabled
  and public.grade_section(c.grade_level)=any(p.sections);
 if section_name is null
  or not exists(select 1 from public.school_members m where m.school_id=sid and m.user_id=p_teacher and m.enabled and m.role='teacher')
  or not exists(select 1 from public.class_subjects cs where cs.school_id=sid and cs.class_id=p_class and cs.subject_id=p_subject and cs.teacher_id=p_teacher)
  or not exists(select 1 from public.category_grade_deadlines d where d.period_id=p_period and d.section=section_name and d.deadline<now())
 then raise exception 'invalid_grade_deadline_scope';end if;
 insert into public.grade_deadline_exceptions(school_id,teacher_id,class_id,subject_id,period_id,expires_at,granted_by,reason)
 values(sid,p_teacher,p_class,p_subject,p_period,p_expires_at,actor,trim(p_reason))
 returning id into new_id;
 return new_id;
end $$;
revoke all on function public.grant_grade_deadline_exception(uuid,uuid,uuid,uuid,timestamptz,text) from public,anon;
grant execute on function public.grant_grade_deadline_exception(uuid,uuid,uuid,uuid,timestamptz,text) to authenticated;

create or replace function private.enforce_grade_deadline() returns trigger language plpgsql security definer set search_path='' as $$
declare g public.grades; old_g public.grades; expired boolean;
begin
 if tg_op='DELETE' then g:=old;else g:=new;end if;
 if private.grade_reviewer(g.school_id) then
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 select exists(
  select 1 from public.category_grade_deadlines d
  join public.classes c on c.id=g.class_id
  where d.period_id=g.grading_period_id
   and d.section=public.grade_section(c.grade_level) and now()>d.deadline
 ) into expired;
 if expired and (tg_op='DELETE' or not private.grade_deadline_exception_active(g.school_id,g.teacher_id,g.class_id,g.subject_id,g.grading_period_id)) then
  raise exception 'grade_deadline_passed';
 end if;
 if tg_op='UPDATE' then
  old_g:=old;
  select exists(
   select 1 from public.category_grade_deadlines d
   join public.classes c on c.id=old_g.class_id
   where d.period_id=old_g.grading_period_id
    and d.section=public.grade_section(c.grade_level) and now()>d.deadline
  ) into expired;
  if expired and not private.grade_deadline_exception_active(old_g.school_id,old_g.teacher_id,old_g.class_id,old_g.subject_id,old_g.grading_period_id) then
   raise exception 'grade_deadline_passed';
  end if;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;

create or replace function private.enforce_grade_subject_max_score() returns trigger language plpgsql security definer set search_path='' as $$
declare configured numeric;
begin
 select s.default_max_score into configured from public.subjects s
 where s.id=new.subject_id and s.school_id=new.school_id;
 if configured is not null and new.max_score is distinct from configured then
  raise exception 'subject_max_score_mismatch';
 end if;
 return new;
end $$;
drop trigger if exists grades_subject_max_score_guard on public.grades;
create trigger grades_subject_max_score_guard
 before insert on public.grades for each row execute function private.enforce_grade_subject_max_score();
revoke all on function private.enforce_grade_subject_max_score() from public,anon,authenticated;

create or replace function public.create_subject_with_max_score(p_name text,p_code text,p_max_score numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id(); actor uuid:=auth.uid(); new_id uuid;
begin
 if actor is null or sid is null or not (
  private.has_role(sid,array['school_admin','director'])
  or exists(select 1 from public.schools s where s.id=sid and s.owner_user_id=actor)
 ) then raise exception 'not_authorized';end if;
 if nullif(trim(p_name),'') is null then raise exception 'subject_name_required';end if;
 if p_max_score is null or p_max_score::text in ('NaN','Infinity','-Infinity') or p_max_score<=0 then raise exception 'invalid_max_score';end if;
 if exists(select 1 from public.subjects s where s.school_id=sid and lower(s.name)=lower(trim(p_name))) then raise exception 'subject_already_exists';end if;
 if nullif(trim(p_code),'') is not null and exists(select 1 from public.subjects s where s.school_id=sid and lower(s.code)=lower(trim(p_code))) then raise exception 'subject_code_already_exists';end if;
 insert into public.subjects(school_id,name,code,default_max_score)
 values(sid,trim(p_name),nullif(upper(trim(p_code)),''),p_max_score)
 returning id into new_id;
 return new_id;
end $$;
create or replace function public.set_subject_default_max_score(p_subject uuid,p_max_score numeric)
returns void language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id(); actor uuid:=auth.uid();
begin
 if actor is null or sid is null or not (
  private.has_role(sid,array['school_admin','director'])
  or exists(select 1 from public.schools s where s.id=sid and s.owner_user_id=actor)
 ) then raise exception 'not_authorized';end if;
 if p_subject is null or p_max_score is null or p_max_score::text in ('NaN','Infinity','-Infinity') or p_max_score<=0 then raise exception 'invalid_max_score';end if;
 update public.subjects set default_max_score=p_max_score where id=p_subject and school_id=sid;
 if not found then raise exception 'subject_not_found';end if;
end $$;
revoke all on function public.create_subject_with_max_score(text,text,numeric),public.set_subject_default_max_score(uuid,numeric) from public,anon;
grant execute on function public.create_subject_with_max_score(text,text,numeric),public.set_subject_default_max_score(uuid,numeric) to authenticated;
