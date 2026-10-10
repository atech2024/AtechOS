-- Academic-year create and update permissions must match the existing management UI and RLS policy.
create or replace function public.create_academic_year(
 p_name text,p_start_date date,p_end_date date,p_is_current boolean default false
) returns uuid
language plpgsql security invoker set search_path='public','pg_temp' as $$
declare sid uuid:=public.get_my_school_id();v_id uuid;
begin
 if not private.has_role(sid,array['school_admin','director']) then raise exception 'not_authorized'; end if;
 if nullif(trim(p_name),'') is null or p_end_date<p_start_date then raise exception 'invalid_date_range'; end if;
 if p_is_current then update public.academic_years set is_current=false where school_id=sid; end if;
 insert into public.academic_years(school_id,name,start_date,end_date,is_current) values(sid,trim(p_name),p_start_date,p_end_date,p_is_current) returning id into v_id;
 return v_id;
end $$;
