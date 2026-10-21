-- Prevent duplicate pickup-status notices while allowing a parent to change
-- from on-the-way to delayed (or vice versa) once during the Haiti-local day.
create or replace function public.guardian_note_kindergarten_pickup(p_student uuid,p_status text,p_note text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid;update_id uuid;today date:=(now() at time zone 'America/Port-au-Prince')::date;
begin
 select school_id into sid from public.students
 where id=p_student and private.is_preschool_student(id);
 if sid is null or auth.uid() is null or not exists(
  select 1 from public.student_parents sp
  join public.parents p on p.id=sp.parent_id and p.school_id=sid
  join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id
   and m.enabled and m.role='parent'
  where sp.student_id=p_student and p.user_id=auth.uid()
 ) then raise exception 'not_authorized';end if;
 if p_status not in ('on_the_way','delay') or length(coalesce(p_note,''))>500 then raise exception 'invalid_status';end if;
 perform 1 from public.students where id=p_student for update;
 if exists(select 1 from public.kindergarten_pickups where student_id=p_student and pickup_date=today) then raise exception 'already_picked_up';end if;
 if exists(select 1 from public.kindergarten_pickup_updates u where u.student_id=p_student and u.parent_user_id=auth.uid() and u.status=p_status and (u.created_at at time zone 'America/Port-au-Prince')::date=today) then raise exception 'pickup_update_already_sent';end if;
 insert into public.kindergarten_pickup_updates(school_id,student_id,parent_user_id,status,note)
 values(sid,p_student,auth.uid(),p_status,nullif(trim(p_note),'')) returning id into update_id;
 insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
 select sid,m.user_id,'kindergarten_pickup','Kindergarten pickup update',
  s.first_name||' '||s.last_name||': '||p_status||case when nullif(trim(p_note),'') is null then '' else ' · '||trim(p_note) end,
  'normal','/dashboard/attendance/kindergarten-pickup',
  'kindergarten-pickup-parent:'||update_id::text||':'||m.user_id::text
 from public.students s join public.school_members m on m.school_id=s.school_id and m.enabled
  and m.role in ('school_admin','director','secretary','surveillant','censeur')
 where s.id=p_student;
end
$$;
revoke all on function public.guardian_note_kindergarten_pickup(uuid,text,text) from public,anon;
grant execute on function public.guardian_note_kindergarten_pickup(uuid,text,text) to authenticated;
