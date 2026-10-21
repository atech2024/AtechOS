-- Recreate the pickup RPC with the already-supported STAFF attendance source.
-- The badge scan itself remains source PICKUP for a distinct physical scan record.
create or replace function public.complete_kindergarten_pickup(p_qr text,p_authorization uuid,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare b public.student_badges;s public.students;sid uuid;today date:=(now() at time zone 'America/Port-au-Prince')::date;actor_role text;actor_name text;pickup_id uuid;adult public.kindergarten_pickup_authorizations;attendance_id uuid;checkout timestamptz:=now();
begin
 if auth.uid() is null or coalesce(p_qr,'') !~ '^AOSQ1\.[a-f0-9]{64}$' then raise exception 'invalid_badge';end if;
 select sb.* into b from private.badge_token_history h join public.student_badges sb on sb.id=h.badge_id where h.token_hash=encode(extensions.digest(substring(p_qr from 7),'sha256'),'hex');
 if b.id is null then raise exception 'invalid_badge';end if;
 select * into s from public.students where id=b.student_id for update;
 sid:=s.school_id;
 if sid is null or not private.can_operate_kindergarten_pickup(sid) then raise exception 'not_authorized';end if;
 if not b.active or b.state<>'active' then raise exception 'invalid_badge';end if;
 if not private.is_preschool_student(s.id) then raise exception 'preschool_only';end if;
 select * into adult from public.kindergarten_pickup_authorizations where id=p_authorization and student_id=s.id and school_id=sid and active;
 if adult.id is null then raise exception 'pickup_person_not_authorized';end if;
 if exists(select 1 from public.kindergarten_pickups where student_id=s.id and pickup_date=today) then raise exception 'already_picked_up';end if;
 select id into attendance_id from public.attendance a where a.student_id=s.id and a.school_id=sid and a.attendance_date=today and a.check_in_at is not null and a.status in ('present','late') and a.check_out_at is null for update;
 if attendance_id is null then raise exception 'student_not_on_campus';end if;
 select role::text into actor_role from public.school_members where school_id=sid and user_id=auth.uid() and enabled order by case role::text when 'school_admin' then 0 when 'director' then 1 when 'secretary' then 2 else 3 end limit 1;
 select full_name into actor_name from public.users where id=auth.uid();
 insert into public.kindergarten_pickups(school_id,student_id,authorization_id,badge_id,pickup_date,recorded_by,recorder_name,recorder_role,reason)
 values(sid,s.id,adult.id,b.id,today,auth.uid(),coalesce(actor_name,'Staff'),coalesce(actor_role,'staff'),nullif(trim(p_reason),''))
 on conflict(student_id,pickup_date) do nothing returning id into pickup_id;
 if pickup_id is null then raise exception 'already_picked_up';end if;
 update public.attendance set check_out_at=checkout,updated_at=checkout,recorded_by=auth.uid() where id=attendance_id and check_out_at is null returning id into attendance_id;
 if attendance_id is null then raise exception 'already_checked_out';end if;
 insert into public.attendance_events(attendance_id,student_id,source,actor_id,actor_name,actor_role,action,recorded_at,attendance_date)
 values(attendance_id,s.id,'STAFF',auth.uid(),coalesce(actor_name,'Staff'),coalesce(actor_role,'staff'),'kindergarten_pickup_check_out',checkout,today);
 insert into public.badge_scans(school_id,student_id,badge_id,source,result) values(sid,s.id,b.id,'PICKUP','pickup_complete');
 insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
 select sid,m.user_id,'kindergarten_pickup','Kindergarten pickup recorded',s.first_name||' '||s.last_name||' was picked up by '||adult.full_name,'normal','/dashboard/attendance/kindergarten-pickup','kindergarten-pickup:'||pickup_id::text||':'||m.user_id::text
 from public.student_parents sp join public.parents pa on pa.id=sp.parent_id join public.school_members m on m.school_id=pa.school_id and m.user_id=pa.user_id and m.enabled and m.role='parent'
 where sp.student_id=s.id and pa.school_id=sid on conflict do nothing;
 return jsonb_build_object('pickup_id',pickup_id,'student',s.first_name||' '||s.last_name,'class',(select c.name from public.enrollments e join public.classes c on c.id=e.class_id where e.student_id=s.id and e.status='active' limit 1),'picked_up_by',adult.full_name,'pickup_at',checkout);
end
$$;

revoke all on function public.complete_kindergarten_pickup(text,uuid,text) from public,anon,authenticated;
grant execute on function public.complete_kindergarten_pickup(text,uuid,text) to authenticated;
