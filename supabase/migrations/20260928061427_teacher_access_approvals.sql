-- Generic request/vote/audit records; the first executor handles teacher access.
create table public.school_approval_requests(
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 kind text not null,target_id uuid not null,target_user_id uuid not null references public.users(id),
 target_name text not null,requested_by uuid not null references public.users(id),reason text not null,
 payload jsonb not null default '{}',required_approvals integer not null default 2 check(required_approvals between 1 and 2),
 status text not null default 'pending' check(status in ('pending','executing','applied','rejected','cancelled')),
 created_at timestamptz not null default now(),completed_at timestamptz,
 check(kind not in ('teacher_disable','teacher_role') or required_approvals=2)
);
create unique index school_approval_open_target on public.school_approval_requests(school_id,target_id) where status in ('pending','executing');
create index school_approval_school_time on public.school_approval_requests(school_id,created_at desc);
create table public.school_approval_votes(
 request_id uuid not null references public.school_approval_requests(id),actor_id uuid not null references public.users(id),
 actor_name text,actor_role text,decision text not null check(decision in ('approve','reject')),
 comment text,created_at timestamptz not null default now(),primary key(request_id,actor_id)
);
create table public.school_approval_events(
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.school_approval_requests(id),
 actor_id uuid,actor_name text,actor_role text,action text not null,detail jsonb,created_at timestamptz not null default now()
);
alter table public.school_approval_requests enable row level security;
alter table public.school_approval_votes enable row level security;
alter table public.school_approval_events enable row level security;
revoke all on public.school_approval_requests,public.school_approval_votes,public.school_approval_events from public,anon,authenticated;
create function private.approval_authority(p_school uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.has_role(p_school,array['school_admin','director','censeur'])
$$;
create function private.approval_event(p_request uuid,p_action text,p_detail jsonb) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;begin
 select school_id into sid from public.school_approval_requests where id=p_request;
 insert into public.school_approval_events(request_id,actor_id,actor_name,actor_role,action,detail)
 select p_request,auth.uid(),u.full_name,(select m.role::text from public.school_members m where m.school_id=sid and m.user_id=auth.uid() and m.enabled order by case m.role::text when 'school_admin' then 0 when 'director' then 1 when 'censeur' then 2 else 3 end limit 1),p_action,p_detail from public.users u where u.id=auth.uid();
 if p_action in ('approve','reject','cancelled') then
  insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
  select r.school_id,r.requested_by,'approvals','Approval decision recorded',p_action,'normal','/dashboard/approvals','approval-decision:'||r.id::text||':'||p_action||':'||auth.uid()::text from public.school_approval_requests r where r.id=p_request and r.requested_by<>auth.uid();
 end if;
end $$;
-- Protect every write path, including the old management RPC and role-change bypass.
create function private.guard_teacher_access() returns trigger language plpgsql security definer set search_path='' as $$begin
 if old.role='teacher' then
  if tg_op='DELETE' then raise exception 'teacher_access_requires_two_approvals';end if;
  if new.id is distinct from old.id or new.school_id is distinct from old.school_id or new.user_id is distinct from old.user_id then raise exception 'membership_identity_immutable';end if;
  if (old.enabled and not new.enabled) or new.role is distinct from old.role then
   if not exists(select 1 from public.school_approval_requests r where r.school_id=old.school_id and r.target_id=old.id and r.target_user_id=old.user_id and r.status='executing' and r.required_approvals>=2 and
    ((r.kind='teacher_disable' and not new.enabled and new.role=old.role) or (r.kind='teacher_role' and new.role::text=r.payload->>'role' and new.enabled=old.enabled)) and
    (select count(*) from public.school_approval_votes v where v.request_id=r.id and v.decision='approve' and v.actor_id<>r.target_user_id and exists(select 1 from public.school_members a where a.school_id=r.school_id and a.user_id=v.actor_id and a.enabled and a.role in ('school_admin','director','censeur')))>=r.required_approvals)
   then raise exception 'teacher_access_requires_two_approvals';end if;
  end if;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger guard_teacher_access before update or delete on public.school_members for each row execute function private.guard_teacher_access();
create function public.request_teacher_access_change(p_member uuid,p_action text,p_reason text,p_role public.school_role default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare m public.school_members;sid uuid:=public.get_my_school_id();rid uuid;owner_id uuid;begin
 if not private.approval_authority(sid) then raise exception 'not_authorized';end if;
 select * into m from public.school_members where id=p_member for update;
 select owner_user_id into owner_id from public.schools where id=sid;
 if m.id is null or m.school_id is distinct from sid or m.role<>'teacher' or m.user_id=auth.uid() or m.user_id=owner_id then raise exception 'invalid_teacher_target';end if;
 if p_action is null or p_action not in ('disable','role') or length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>2000 then raise exception 'reason_and_action_required';end if;
 if p_action='disable' and not m.enabled then raise exception 'already_disabled';end if;
 if p_action='role' and (p_role is null or p_role='teacher') then raise exception 'invalid_role';end if;
 if p_role='school_admin' and auth.uid()<>owner_id then raise exception 'owner_required';end if;
 if p_role='student' and not exists(select 1 from public.students where school_id=sid and user_id=m.user_id) then raise exception 'link_student_account_with_invitation_first';end if;
 if exists(select 1 from public.school_approval_requests where school_id=sid and target_id=m.id and status in ('pending','executing')) then raise exception 'approval_already_pending';end if;
 insert into public.school_approval_requests(school_id,kind,target_id,target_user_id,target_name,requested_by,reason,payload,required_approvals)
 values(sid,case when p_action='disable' then 'teacher_disable' else 'teacher_role' end,m.id,m.user_id,(select full_name from public.users where id=m.user_id),auth.uid(),trim(p_reason),jsonb_build_object('role',p_role,'old_role',m.role,'old_enabled',m.enabled),2) returning id into rid;
 perform private.approval_event(rid,'requested',jsonb_build_object('reason',trim(p_reason),'member',to_jsonb(m)));
 insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
 select distinct sid,a.user_id,'approvals','Teacher access approval requested','Two different authorized people must approve before access changes.','normal','/dashboard/approvals','approval:'||rid::text||':'||a.user_id::text from public.school_members a where a.school_id=sid and a.enabled and a.role in ('school_admin','director','censeur') and a.user_id<>m.user_id;
 return rid;
end $$;
create function public.review_school_approval(p_request uuid,p_decision text,p_comment text default null)
returns text language plpgsql security definer set search_path='' as $$
declare r public.school_approval_requests;m public.school_members;after_member public.school_members;uid uuid:=auth.uid();total integer;role_value public.school_role;person public.users;parent_record public.parents;begin
 select * into r from public.school_approval_requests where id=p_request for update;
 if r.id is null or r.school_id is distinct from public.get_my_school_id() or not private.approval_authority(r.school_id) or uid=r.target_user_id then raise exception 'not_authorized';end if;
 if r.status<>'pending' then raise exception 'request_closed';end if;
 if p_decision is null or p_decision not in ('approve','reject','cancel') or length(coalesce(p_comment,''))>2000 then raise exception 'invalid_decision';end if;
 if p_decision in ('reject','cancel') and length(trim(coalesce(p_comment,'')))<3 then raise exception 'reason_required';end if;
 if p_decision='cancel' then
  if uid<>r.requested_by and not private.has_role(r.school_id,array['school_admin']) then raise exception 'not_authorized';end if;
  update public.school_approval_requests set status='cancelled',completed_at=now() where id=r.id;
  perform private.approval_event(r.id,'cancelled',jsonb_build_object('comment',p_comment));return 'cancelled';
 end if;
 if exists(select 1 from public.school_approval_votes where request_id=r.id and actor_id=uid) then raise exception 'already_voted';end if;
 insert into public.school_approval_votes(request_id,actor_id,actor_name,actor_role,decision,comment)
 select r.id,uid,u.full_name,(select role::text from public.school_members where school_id=r.school_id and user_id=uid and enabled and role in ('school_admin','director','censeur') order by role::text limit 1),p_decision,nullif(trim(p_comment),'') from public.users u where u.id=uid;
 perform private.approval_event(r.id,p_decision,jsonb_build_object('comment',p_comment));
 if p_decision='reject' then update public.school_approval_requests set status='rejected',completed_at=now() where id=r.id;return 'rejected';end if;
 perform 1 from public.school_members a where a.school_id=r.school_id and exists(select 1 from public.school_approval_votes v where v.request_id=r.id and v.actor_id=a.user_id and v.decision='approve') order by a.id for update;
 select count(*) into total from public.school_approval_votes v where v.request_id=r.id and v.decision='approve' and exists(select 1 from public.school_members a where a.school_id=r.school_id and a.user_id=v.actor_id and a.enabled and a.role in ('school_admin','director','censeur'));
 if total<r.required_approvals then return 'pending';end if;
 select * into m from public.school_members where id=r.target_id for update;
 if m.id is null or m.user_id<>r.target_user_id or m.role::text<>r.payload->>'old_role' or m.enabled is distinct from (r.payload->>'old_enabled')::boolean then raise exception 'target_changed_create_new_request';end if;
 update public.school_approval_requests set status='executing' where id=r.id;
 if r.kind='teacher_disable' then update public.school_members set enabled=false where id=m.id returning * into after_member;
 elsif r.kind='teacher_role' then
  role_value:=(r.payload->>'role')::public.school_role;
  if role_value='school_admin' and r.requested_by is distinct from (select owner_user_id from public.schools where id=r.school_id) then raise exception 'owner_required';end if;
  if exists(select 1 from public.school_members where school_id=r.school_id and user_id=m.user_id and role=role_value and id<>m.id) then raise exception 'role_already_assigned';end if;
  if role_value='student' and not exists(select 1 from public.students where school_id=r.school_id and user_id=m.user_id) then raise exception 'link_student_account_with_invitation_first';end if;
  if role_value='parent' then
   select * into person from public.users where id=m.user_id;
   perform pg_advisory_xact_lock(hashtextextended(r.school_id::text||m.user_id::text,0));
   select * into parent_record from public.parents where school_id=r.school_id and user_id=m.user_id limit 1;
   if parent_record.id is null then
    select * into parent_record from public.parents where school_id=r.school_id and lower(email)=lower(person.email) limit 1 for update;
    if parent_record.id is not null and parent_record.user_id is not null and parent_record.user_id<>m.user_id then raise exception 'parent_record_belongs_to_another_account';end if;
    if parent_record.id is null then insert into public.parents(school_id,user_id,full_name,email) values(r.school_id,m.user_id,person.full_name,person.email);
    else update public.parents set user_id=m.user_id where id=parent_record.id;end if;
   end if;
  end if;
  update public.school_members set role=role_value where id=m.id returning * into after_member;
 else raise exception 'unsupported_approval_kind';end if;
 update public.school_approval_requests set status='applied',completed_at=now() where id=r.id;
 perform private.approval_event(r.id,'applied',jsonb_build_object('old',to_jsonb(m),'new',to_jsonb(after_member)));
 insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
 select distinct r.school_id,a.user_id,'approvals','Teacher access decision applied','Two authorized approvals completed the requested change.','normal','/dashboard/approvals','approval-applied:'||r.id::text||':'||a.user_id::text from public.school_members a where a.school_id=r.school_id and a.enabled and a.role in ('school_admin','director','censeur');
 return 'applied';
end $$;
create function public.school_approval_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();begin
 if not private.approval_authority(sid) then raise exception 'not_authorized';end if;
 return jsonb_build_object('user_id',auth.uid(),'owner',exists(select 1 from public.schools where id=sid and owner_user_id=auth.uid()),
 'teachers',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',u.full_name,'enabled',m.enabled)) from public.school_members m join public.users u on u.id=m.user_id join public.schools s on s.id=m.school_id where m.school_id=sid and m.role='teacher' and m.user_id<>auth.uid() and m.user_id<>s.owner_user_id),'[]'),
 'requests',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('requester',(select full_name from public.users where id=r.requested_by),
 'approval_count',(select count(*) from public.school_approval_votes v where v.request_id=r.id and v.decision='approve' and (r.status='applied' or exists(select 1 from public.school_members a where a.school_id=r.school_id and a.user_id=v.actor_id and a.enabled and a.role in ('school_admin','director','censeur')))),
 'can_vote',r.status='pending' and r.target_user_id<>auth.uid() and not exists(select 1 from public.school_approval_votes where request_id=r.id and actor_id=auth.uid()),
 'can_cancel',r.status='pending' and (r.requested_by=auth.uid() or private.has_role(sid,array['school_admin'])),
 'votes',coalesce((select jsonb_agg(to_jsonb(v) order by created_at) from public.school_approval_votes v where request_id=r.id),'[]'),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by created_at) from public.school_approval_events e where request_id=r.id),'[]')) order by r.created_at desc) from public.school_approval_requests r where r.school_id=sid),'[]'));
end $$;
revoke all on function private.approval_authority(uuid),private.approval_event(uuid,text,jsonb),private.guard_teacher_access() from public,anon,authenticated;
revoke all on function public.request_teacher_access_change(uuid,text,text,public.school_role),public.review_school_approval(uuid,text,text),public.school_approval_workspace() from public,anon;
grant execute on function public.request_teacher_access_change(uuid,text,text,public.school_role),public.review_school_approval(uuid,text,text),public.school_approval_workspace() to authenticated;
