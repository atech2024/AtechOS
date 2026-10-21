create table public.notifications(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 recipient_id uuid not null references public.users(id),type text not null,title text not null,description text not null default '',
 priority text not null default 'normal' check(priority in ('normal','high','urgent')),
 href text not null check(href like '/dashboard/%' and href not like '//%'),
 created_at timestamptz not null default now(),read_at timestamptz, event_key text not null,
 unique(school_id,recipient_id,event_key)
);
create index notifications_recipient_created on public.notifications(recipient_id,school_id,created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from public,anon,authenticated;
grant select on public.notifications to authenticated;
create policy notifications_own on public.notifications for select to authenticated using(recipient_id=(select auth.uid()) and school_id=(select public.get_my_school_id()) and exists(select 1 from public.school_members m where m.school_id=notifications.school_id and m.user_id=(select auth.uid()) and m.enabled));
create function public.mark_notification_read(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.notifications n set read_at=coalesce(read_at,now()) where n.id=p_id and n.recipient_id=auth.uid() and n.school_id=public.get_my_school_id()
 and exists(select 1 from public.school_members m where m.school_id=n.school_id and m.user_id=auth.uid() and m.enabled);
 if not found then raise exception 'not_authorized';end if;
end $$;

-- Invoker uses existing row and column permissions. No student identifiers or
-- private guardian contacts are returned to teacher searches.
create function public.school_search(p_query text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare sid uuid:=public.get_my_school_id(); q text:=trim(coalesce(p_query,'')); admin boolean; rows jsonb;
begin
 if auth.uid() is null or sid is null then raise exception 'not_authorized';end if;
 if length(q)<2 then return '[]';end if;
 if length(q)>100 then raise exception 'query_too_long';end if;
 q:='%'||replace(replace(replace(q,'\','\\'),'%','\%'),'_','\_')||'%';
 admin:=private.has_role(sid,array['school_admin','director','secretary']);
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from (
 select 'student'::text as kind,s.first_name||' '||s.last_name as label,'/dashboard/students/'||s.id::text as href
 from public.students s where s.school_id=sid and (admin or private.has_role(sid,array['teacher','surveillant'])) and (s.first_name||' '||s.last_name) ilike q
 union all select 'parent',p.full_name,'/dashboard/parents' from public.parents p where p.school_id=sid and admin and p.full_name ilike q
 union all select 'teacher',u.full_name,'/dashboard/subjects' from public.school_members m join public.users u on u.id=m.user_id where m.school_id=sid and m.enabled and m.role='teacher' and admin and u.full_name ilike q
 union all select 'class',c.name,case when admin then '/dashboard/classes' else '/dashboard/grades' end from public.classes c where c.school_id=sid and (admin or private.has_role(sid,array['teacher'])) and c.name ilike q
 order by label limit 20) r;
 return rows;
end $$;
create function public.dashboard_summary() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare sid uuid:=public.get_my_school_id(); d date:=(now() at time zone 'America/Port-au-Prince')::date;staff boolean;
begin
 if auth.uid() is null or sid is null then raise exception 'not_authorized';end if;
 staff:=private.has_role(sid,array['school_admin','director','secretary','surveillant','teacher']);
 return jsonb_build_object('date',d,'school_scope',private.has_role(sid,array['school_admin','director','secretary','surveillant']),
 'students',case when staff then (select count(*) from public.students s where s.school_id=sid and s.active and s.school_status='active') end,
 'present',case when staff then (select count(*) from public.attendance a where a.school_id=sid and a.attendance_date=d and a.status='present') end,
 'late',case when staff then (select count(*) from public.attendance a where a.school_id=sid and a.attendance_date=d and a.status='late') end,
 'absent',case when staff then (select count(*) from public.attendance a where a.school_id=sid and a.attendance_date=d and a.status='absent') end,
 'draft_grades',case when private.has_role(sid,array['school_admin','director','teacher']) then (select count(*) from public.grades g where g.school_id=sid and not g.published) end);
end $$;
revoke all on function public.mark_notification_read(uuid),public.school_search(text),public.dashboard_summary() from public,anon,authenticated;
grant execute on function public.mark_notification_read(uuid),public.school_search(text),public.dashboard_summary() to authenticated;
