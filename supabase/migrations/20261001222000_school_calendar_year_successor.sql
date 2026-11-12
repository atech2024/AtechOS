-- Create the next academic year as an inactive draft when a year is created.
-- Its first day is the configured end date of the year being created.
create or replace function public.create_academic_year_with_successor(
 p_name text, p_start_date date, p_end_date date, p_is_current boolean default false
) returns uuid
language plpgsql security invoker set search_path to 'public','pg_temp' as $$
declare
 current_id uuid;
 successor_start date;
 successor_end date;
 span_days integer;
 successor_name text;
begin
 if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
  raise exception 'invalid_date_range';
 end if;

 current_id:=public.create_academic_year(p_name,p_start_date,p_end_date,p_is_current);
 successor_start:=p_end_date;
 span_days:=greatest(p_end_date-p_start_date,1);
 successor_end:=successor_start+span_days;
 successor_name:=extract(year from successor_start)::integer::text||'/'||extract(year from successor_end)::integer::text;

 -- Keep one future year ready. Do not duplicate a year a school has already
 -- created after this one, and leave the generated year inactive.
 if not exists (
  select 1 from public.academic_years
  where school_id=public.get_my_school_id() and id<>current_id and start_date>=successor_start
 ) then
  perform public.create_academic_year(successor_name,successor_start,successor_end,false);
 end if;
 return current_id;
end $$;
revoke all on function public.create_academic_year_with_successor(text,date,date,boolean) from public,anon;
grant execute on function public.create_academic_year_with_successor(text,date,date,boolean) to authenticated;

create or replace function public.update_academic_year(
 p_id uuid,p_name text,p_start_date date,p_end_date date,p_is_current boolean
) returns void
language plpgsql security invoker set search_path to 'public','pg_temp' as $$
declare sid uuid:=public.get_my_school_id();
begin
 if not private.has_role(sid,array['school_admin','director']) then raise exception 'not_authorized'; end if;
 if nullif(trim(p_name),'') is null or p_start_date is null or p_end_date is null or p_end_date<p_start_date then
  raise exception 'invalid_academic_year';
 end if;
 if not exists(select 1 from public.academic_years where id=p_id and school_id=sid) then
  raise exception 'academic_year_access_denied';
 end if;
 if p_is_current then update public.academic_years set is_current=false where school_id=sid and id<>p_id; end if;
 update public.academic_years set name=trim(p_name),start_date=p_start_date,end_date=p_end_date,is_current=p_is_current
 where id=p_id and school_id=sid;
end $$;
revoke all on function public.update_academic_year(uuid,text,date,date,boolean) from public,anon;
grant execute on function public.update_academic_year(uuid,text,date,date,boolean) to authenticated;
