-- View-only pickup staff do not need contact details for authorized adults.
-- Keep the phone field available only to roles that can manage that list.
create or replace function public.kindergarten_pickup_workspace()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare sid uuid:=public.get_my_school_id();manage boolean;
begin
 if auth.uid() is null or sid is null or not private.can_operate_kindergarten_pickup(sid) then raise exception 'not_authorized';end if;
 manage:=private.has_role(sid,array['school_admin','director','secretary']);
 return jsonb_build_object(
  'can_manage_authorizations',manage,
  'students',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',s.id,'name',s.first_name||' '||s.last_name,'class',c.name,
    'status',a.status,'check_in_at',a.check_in_at,
    'picked_up',p.id is not null,'pickup_at',p.pickup_at,'picked_up_by',authz.full_name,
    'authorizations',coalesce((
      select jsonb_agg(
       case when manage then jsonb_build_object('id',pa.id,'name',pa.full_name,'relationship',pa.relationship,'phone',pa.phone)
       else jsonb_build_object('id',pa.id,'name',pa.full_name,'relationship',pa.relationship) end
       order by pa.full_name)
      from public.kindergarten_pickup_authorizations pa
      where pa.student_id=s.id and pa.active
    ),'[]'::jsonb)
   ) order by c.name,s.first_name,s.last_name)
   from public.attendance a join public.students s on s.id=a.student_id and s.school_id=a.school_id
   join public.classes c on c.id=a.class_id and c.school_id=a.school_id
   left join public.grade_levels gl on gl.id=c.grade_level_id
   left join public.kindergarten_pickups p on p.student_id=s.id and p.pickup_date=(now() at time zone 'America/Port-au-Prince')::date
   left join public.kindergarten_pickup_authorizations authz on authz.id=p.authorization_id
   where a.school_id=sid and a.attendance_date=(now() at time zone 'America/Port-au-Prince')::date
    and a.check_in_at is not null and a.status in ('present','late')
    and public.grade_section(coalesce(c.grade_level,gl.code))='preschool'
  ),'[]'::jsonb),
  'today',((now() at time zone 'America/Port-au-Prince')::date)
 );
end
$$;
revoke all on function public.kindergarten_pickup_workspace() from public,anon,authenticated;
grant execute on function public.kindergarten_pickup_workspace() to authenticated;
