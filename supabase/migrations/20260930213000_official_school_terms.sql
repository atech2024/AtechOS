-- Official grading periods are academic-year terms (3 or 4). Legacy controls stay intact for history.
alter table public.academic_years
  add column term_count integer not null default 3
  check (term_count in (3,4));

create or replace function public.set_academic_year_term_count(p_year uuid,p_term_count integer)
returns void language plpgsql security invoker set search_path='' as $$
declare sid uuid:=public.get_my_school_id();
begin
  if p_term_count not in (3,4) or p_term_count is null then raise exception 'invalid_term_count'; end if;
  if not private.has_role(sid,array['school_admin','director']) then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.academic_years where id=p_year and school_id=sid) then raise exception 'invalid_year'; end if;
  if p_term_count=3 and exists(
    select 1 from public.grading_periods p
    where p.school_id=sid and p.academic_year_id=p_year and p.code='T4' and p.is_active
  ) then raise exception 'deactivate_fourth_term_first'; end if;
  update public.academic_years set term_count=p_term_count where id=p_year and school_id=sid;
end $$;
revoke all on function public.set_academic_year_term_count(uuid,integer) from public,anon;
grant execute on function public.set_academic_year_term_count(uuid,integer) to authenticated;

create or replace function private.validate_official_grading_period()
returns trigger language plpgsql security definer set search_path='' as $$
declare terms integer;
begin
  if new.code in ('C1','C2','C3','C4') then raise exception 'assessment_is_not_a_grading_period'; end if;
  if new.code='T4' then
    select term_count into terms from public.academic_years
    where id=new.academic_year_id and school_id=new.school_id;
    if terms is distinct from 4 then raise exception 'fourth_term_not_enabled'; end if;
  end if;
  return new;
end $$;
drop trigger if exists validate_official_grading_period on public.grading_periods;
create trigger validate_official_grading_period
before insert or update of code,academic_year_id on public.grading_periods
for each row execute function private.validate_official_grading_period();
revoke all on function private.validate_official_grading_period() from public,anon,authenticated;
