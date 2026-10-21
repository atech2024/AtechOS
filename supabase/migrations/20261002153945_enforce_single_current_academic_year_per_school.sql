-- Fail closed if historical data already violates the invariant. A read-only
-- production preflight found no schools with multiple current years.
do $$
begin
  if exists (
    select 1 from public.academic_years
    where is_current
    group by school_id
    having count(*) > 1
  ) then
    raise exception 'multiple_current_academic_years_found';
  end if;
end;
$$;

create unique index academic_years_one_current_per_school_idx
  on public.academic_years (school_id)
  where is_current;
