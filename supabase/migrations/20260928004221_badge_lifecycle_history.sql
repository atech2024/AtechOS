alter table public.student_badges add column state text not null default 'active' check(state in ('active','lost','replaced','revoked'));
alter table public.student_badges add column issued_by uuid references public.users(id),add column reason text;
update public.student_badges set state='revoked' where not active;
alter table private.student_badge_credentials add column badge_id uuid references public.student_badges(id);
create table private.badge_token_history(token_hash text primary key,badge_id uuid not null references public.student_badges(id));
create table public.badge_events(id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),student_id uuid not null references public.students(id),badge_id uuid not null references public.student_badges(id),action text not null,actor_id uuid,actor_name text,actor_role text,reason text,created_at timestamptz not null default now());
create table public.badge_scans(id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),student_id uuid not null references public.students(id),badge_id uuid not null references public.student_badges(id),source text not null default 'KIOS',result text not null,device_location text,created_at timestamptz not null default now());
create index badge_events_student_time on public.badge_events(student_id,created_at desc);
create index badge_scans_student_time on public.badge_scans(student_id,created_at desc);
alter table private.badge_token_history enable row level security;
alter table public.badge_events enable row level security;
alter table public.badge_scans enable row level security;
revoke all on private.badge_token_history,public.badge_events,public.badge_scans from public,anon,authenticated;
revoke insert,update,delete on public.student_badges from authenticated;
-- These unused legacy APIs toggled entry/exit and accepted public identifiers.
revoke all on function public.scan_student_badge(text,uuid,timestamptz,integer),public.assign_student_badge(uuid,text,text) from public,anon,authenticated;

do $$declare c record;b uuid;begin
 for c in select cr.student_id,cr.token,cr.updated_at,s.school_id from private.student_badge_credentials cr join public.students s on s.id=cr.student_id loop
  select id into b from public.student_badges where student_id=c.student_id and active;
  if b is null then
   insert into public.student_badges(school_id,student_id,badge_uid,badge_type,issued_at,reason) values(c.school_id,c.student_id,'AOSB-'||gen_random_uuid()::text,'qr',c.updated_at,'Existing private QR retained; original issuer unavailable') returning id into b;
  end if;
  update private.student_badge_credentials set badge_id=b where student_id=c.student_id;
  insert into private.badge_token_history values(encode(extensions.digest(c.token,'sha256'),'hex'),b);
 end loop;
end $$;
alter table private.student_badge_credentials alter column badge_id set not null;
create function private.can_manage_badge(p_school uuid) returns boolean language sql stable security definer set search_path='' as $$select private.has_role(p_school,array['school_admin','director','secretary','surveillant'])$$;
create function private.can_report_badge(p_student uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.students s where s.id=p_student and (private.can_manage_badge(s.school_id) or exists(select 1 from public.student_parents sp join public.parents p on p.id=sp.parent_id join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id where sp.student_id=s.id and p.school_id=s.school_id and p.user_id=auth.uid() and m.enabled and m.role='parent')))
$$;
create function private.badge_event(p_badge uuid,p_action text,p_reason text) returns void language sql security definer set search_path='' as $$
 insert into public.badge_events(school_id,student_id,badge_id,action,actor_id,actor_name,actor_role,reason)
 select b.school_id,b.student_id,b.id,p_action,auth.uid(),(select full_name from public.users where id=auth.uid()),(select role::text from public.school_members where school_id=b.school_id and user_id=auth.uid() and enabled order by case role::text when 'school_admin' then 0 when 'director' then 1 else 2 end limit 1),p_reason from public.student_badges b where b.id=p_badge
$$;
create or replace function public.get_student_badge_qr(p_student uuid,p_rotate boolean default false) returns text language plpgsql security definer set search_path='' as $$
declare s public.students;c private.student_badge_credentials;b uuid;v text;
begin
 select * into s from public.students where id=p_student for update;
 if s.id is null or not private.can_manage_badge(s.school_id) then raise exception 'not_authorized';end if;
 if not s.active or s.school_status<>'active' then raise exception 'student_inactive';end if;
 select * into c from private.student_badge_credentials where student_id=s.id;
 if c.student_id is not null and not p_rotate then
  if exists(select 1 from public.student_badges where id=c.badge_id and active and state='active') then return 'AOSQ1.'||c.token;else return null;end if;
 end if;
 update public.student_badges set active=false,state=case when state='lost' then 'lost' else 'replaced' end,revoked_at=coalesce(revoked_at,now()),updated_at=now() where student_id=s.id and active;
 if c.student_id is not null then
  perform private.badge_event(c.badge_id,'replaced','Replacement issued');
 end if;
 b:=gen_random_uuid();v:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.student_badges(id,school_id,student_id,badge_uid,badge_type,issued_by,reason) values(b,s.school_id,s.id,'AOSB-'||b::text,'qr',auth.uid(),case when c.student_id is null then 'First issue' else 'Replacement' end);
 insert into private.student_badge_credentials(student_id,token,badge_id) values(s.id,v,b) on conflict(student_id) do update set token=excluded.token,badge_id=b,updated_at=now();
 insert into private.badge_token_history values(encode(extensions.digest(v,'sha256'),'hex'),b);
 perform private.badge_event(b,'issued',case when c.student_id is null then 'First issue' else 'Replacement' end);
 return 'AOSQ1.'||v;
end $$;
create function public.report_badge_lost(p_student uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare s public.students;b public.student_badges;
begin
 select * into s from public.students where id=p_student for update;
 if s.id is null or not private.can_report_badge(s.id) then raise exception 'not_authorized';end if;
 if length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>500 then raise exception 'reason_required';end if;
 for b in select * from public.student_badges where student_id=s.id and active for update loop
  update public.student_badges set active=false,state='lost',reason=trim(p_reason),revoked_at=now(),updated_at=now() where id=b.id;
  perform private.badge_event(b.id,'lost',trim(p_reason));
  insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
  select s.school_id,m.user_id,'lost_badge','Badge perdu',s.first_name||' '||s.last_name,'high','/dashboard/badges?student='||s.id::text,'lost-badge:'||b.id::text
  from public.school_members m where m.school_id=s.school_id and m.enabled and m.role in ('school_admin','director') on conflict do nothing;
 end loop;
end $$;
create function public.badge_workspace(p_student uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sid uuid;manage boolean;begin
 select school_id into sid from public.students where id=p_student;
 if sid is null or not private.can_report_badge(p_student) then raise exception 'not_authorized';end if;manage:=private.can_manage_badge(sid);
 return jsonb_build_object('can_manage',manage,'qr',case when manage then (select 'AOSQ1.'||c.token from private.student_badge_credentials c join public.student_badges b on b.id=c.badge_id where c.student_id=p_student and b.active and b.state='active') end,
 'badges',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'serial',b.badge_uid,'state',b.state,'issued_at',b.issued_at,'issued_by',u.full_name,'revoked_at',b.revoked_at,'reason',b.reason) order by b.issued_at desc) from public.student_badges b left join public.users u on u.id=b.issued_by where b.student_id=p_student),'[]'),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from public.badge_events e where e.student_id=p_student),'[]'),
 'scans',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select source,result,device_location,created_at from public.badge_scans where student_id=p_student order by created_at desc limit 100) e),'[]'));
end $$;
create or replace function public.student_kiosk_badge(p_qr text) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.student_badges;payload jsonb;
begin
 if coalesce(p_qr,'') !~ '^AOSQ1\.[a-f0-9]{64}$' then return jsonb_build_object('error','invalid_badge');end if;
 select sb.* into b from private.badge_token_history h join public.student_badges sb on sb.id=h.badge_id where h.token_hash=encode(extensions.digest(substring(p_qr from 7),'sha256'),'hex');
 if b.id is null then return jsonb_build_object('error','invalid_badge');end if;
 -- Same lock order as issue/lost: student then credential state, so revocation
 -- cannot race an accepted scan after the lost declaration commits.
 perform 1 from public.students where id=b.student_id for update;
 select * into b from public.student_badges where id=b.id;
 if not b.active or b.state<>'active' then payload:=jsonb_build_object('error','invalid_badge');
 else payload:=private.record_student_kiosk(b.student_id);end if;
 insert into public.badge_scans(school_id,student_id,badge_id,result) values(b.school_id,b.student_id,b.id,case when not b.active then 'rejected_'||b.state else coalesce(payload->>'action',payload->>'error','error') end);
 return payload;
end $$;
do $$declare src text;begin
 select pg_get_functiondef('public.student_portal_overview(text)'::regprocedure) into src;
 src:=replace(src,'''AOSQ1.''||token from private.student_badge_credentials where student_id=s.id','''AOSQ1.''||c.token from private.student_badge_credentials c join public.student_badges b on b.id=c.badge_id where c.student_id=s.id and b.active and b.state=''active''');execute src;
end $$;
revoke all on function private.can_manage_badge(uuid),private.can_report_badge(uuid),private.badge_event(uuid,text,text),public.report_badge_lost(uuid,text),public.badge_workspace(uuid) from public,anon,authenticated;
grant execute on function public.report_badge_lost(uuid,text),public.badge_workspace(uuid) to authenticated;

create function public.revoke_student_badge(p_student uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare s public.students;b public.student_badges;begin
 select * into s from public.students where id=p_student for update;
 if auth.uid() is null or s.id is null or not private.can_manage_badge(s.school_id) then raise exception 'not_authorized';end if;
 if length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>500 then raise exception 'reason_required';end if;
 for b in select * from public.student_badges where student_id=s.id and active for update loop
  update public.student_badges set active=false,state='revoked',reason=trim(p_reason),revoked_at=now(),updated_at=now() where id=b.id;
  perform private.badge_event(b.id,'revoked',trim(p_reason));
 end loop;
end $$;
revoke all on function public.revoke_student_badge(uuid,text) from public,anon;
grant execute on function public.revoke_student_badge(uuid,text) to authenticated;
