create table public.bulletin_versions (
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),class_id uuid not null references public.classes(id),period_id uuid not null references public.grading_periods(id),
 version integer not null check(version>0),payload jsonb not null,reason text not null,
 published_by uuid not null references public.users(id),publisher_name text not null,publisher_role text not null,published_at timestamptz not null default now(),
 approved_by uuid references public.users(id),approver_name text,approved_at timestamptz,previous_id uuid references public.bulletin_versions(id),
 unique(student_id,class_id,period_id,version),
 check((approved_by is null and approver_name is null and approved_at is null) or (approved_by is not null and approver_name is not null and approved_at is not null))
);
alter table public.bulletin_versions enable row level security;
revoke all on public.bulletin_versions from public,anon,authenticated;
create index bulletin_versions_school_class_period on public.bulletin_versions(school_id,class_id,period_id);
create function private.immutable_bulletin() returns trigger language plpgsql set search_path='' as $$begin raise exception 'bulletin_version_immutable';end $$;
revoke all on function private.immutable_bulletin() from public,anon,authenticated;
create trigger bulletin_versions_immutable before update or delete on public.bulletin_versions for each row execute function private.immutable_bulletin();
create function private.notify_bulletin_version() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.notifications(school_id,recipient_id,type,title,description,priority,href,event_key)
 select new.school_id,r.user_id,'bulletins','Official bulletin available','A new official document version is available.','normal',r.href,'bulletin:'||new.id::text||':'||r.user_id::text from (
 select distinct p.user_id,'/dashboard/parent-portal'::text href from public.parents p join public.student_parents sp on sp.parent_id=p.id join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id and m.role='parent' and m.enabled where sp.student_id=new.student_id and p.school_id=new.school_id
 union select s.user_id,'/student' from public.students s where s.id=new.student_id and s.user_id is not null
 union select m.user_id,'/dashboard/publication' from public.school_members m where m.school_id=new.school_id and m.enabled and m.role in ('censeur','director','school_admin')
 )r on conflict do nothing;
 return new;
end $$;
revoke all on function private.notify_bulletin_version() from public,anon,authenticated;
create trigger bulletin_version_notification after insert on public.bulletin_versions for each row execute function private.notify_bulletin_version();

-- Preserve the existing published-grade computation as a preview source.
alter function private.student_report_cards(uuid) rename to calculated_student_report_cards;
create function private.bulletin_card(v public.bulletin_versions) returns jsonb language sql stable set search_path='' as $$
 select v.payload->'card'||jsonb_build_object('document',jsonb_build_object('id',v.id,'version',v.version,'published_at',v.published_at,'publisher',v.publisher_name,'publisher_role',v.publisher_role,'approved_by',v.approved_by,'approver',v.approver_name,'approved_at',v.approved_at,'reason',v.reason),'identity',v.payload->'student','school_identity',v.payload->'school','passing_average',v.payload->'passing_average')
$$;
create function private.student_report_cards(p_student uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare base jsonb;cards jsonb;history jsonb;begin
 base:=private.calculated_student_report_cards(p_student);if base is null then return null;end if;
 -- Published history survives later class/period configuration edits, but never crosses departure-year boundaries.
 select coalesce(jsonb_agg(private.bulletin_card(v) order by v.published_at desc,v.version desc),'[]') into history from public.bulletin_versions v
 join public.students s on s.id=v.student_id and s.school_id=v.school_id join public.classes c on c.id=v.class_id join public.academic_years y on y.id=c.academic_year_id
 where v.student_id=p_student and (s.departure_year_id is null or y.start_date<=(select start_date from public.academic_years where id=s.departure_year_id));
 with latest as(select distinct on (c->>'class_id',c->>'period_id') c from jsonb_array_elements(history) c order by c->>'class_id',c->>'period_id',(c->'document'->>'version')::int desc),
 visible as(select c from latest union all select c from jsonb_array_elements(base->'cards') c where not exists(select 1 from latest l where l.c->>'class_id'=c->>'class_id' and l.c->>'period_id'=c->>'period_id'))
 select coalesce(jsonb_agg(c order by c->>'year' desc,c->>'start_date',c->>'class_name'),'[]') into cards from visible;
 return base||jsonb_build_object('cards',cards,'document_history',history);
end $$;
revoke all on function private.calculated_student_report_cards(uuid),private.bulletin_card(public.bulletin_versions),private.student_report_cards(uuid) from public,anon,authenticated;

-- PL/pgSQL callers bind by function name. Explicitly recompile both entry points.
do $$declare src text;begin
 select pg_get_functiondef('public.get_report_card(uuid)'::regprocedure) into src;execute src;
 select pg_get_functiondef('public.student_portal_overview(text)'::regprocedure) into src;execute src;
end $$;

create function public.publish_class_bulletins(p_class uuid,p_period uuid,p_reason text) returns integer language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();actor text;actor_role text;n integer;begin
 if not private.has_role(sid,array['school_admin','director','censeur']) then raise exception 'not_authorized';end if;
 if length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>2000 then raise exception 'reason_required';end if;
 if not exists(select 1 from public.classes c join public.grading_periods p on p.academic_year_id=c.academic_year_id and p.school_id=c.school_id where c.id=p_class and c.school_id=sid and p.id=p_period and public.grade_section(c.grade_level)=any(p.sections)) then raise exception 'invalid_class_period';end if;
 if not exists(select 1 from public.grades where class_id=p_class and grading_period_id=p_period and published) then raise exception 'no_published_grades';end if;
 perform pg_advisory_xact_lock(hashtextextended('bulletin:'||p_class::text||p_period::text,0));
 select coalesce(nullif(full_name,''),auth.uid()::text) into actor from public.users where id=auth.uid();
 select role::text into actor_role from public.school_members where school_id=sid and user_id=auth.uid() and enabled order by case role::text when 'school_admin' then 0 when 'director' then 1 when 'censeur' then 2 else 3 end limit 1;
 if exists(select 1 from public.schools where id=sid and owner_user_id=auth.uid()) then actor_role:='school_admin';end if;
 -- One statement gives every student the same source snapshot, including ranking.
 with roster as (select student_id from public.enrollments where class_id=p_class union select student_id from public.grades where class_id=p_class and grading_period_id=p_period),
 reports as (select r.student_id,private.calculated_student_report_cards(r.student_id) doc from roster r),
 contents as (select r.student_id,jsonb_build_object('student',r.doc->'student','school',r.doc->'school','passing_average',r.doc->'passing_average','card',card) payload from reports r cross join lateral jsonb_array_elements(r.doc->'cards') card where card->>'class_id'=p_class::text and card->>'period_id'=p_period::text)
 insert into public.bulletin_versions(school_id,student_id,class_id,period_id,version,payload,reason,published_by,publisher_name,publisher_role,previous_id)
 select sid,c.student_id,p_class,p_period,coalesce(last.version,0)+1,c.payload,trim(p_reason),auth.uid(),actor,actor_role,last.id from contents c
 left join lateral(select id,version from public.bulletin_versions where student_id=c.student_id and class_id=p_class and period_id=p_period order by version desc limit 1) last on true;
 get diagnostics n=row_count;
 return n;
end $$;

create function public.approve_bulletin_version(p_version uuid,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();v public.bulletin_versions;new_id uuid;actor text;begin
 if not exists(select 1 from public.school_members where school_id=sid and user_id=auth.uid() and enabled and role='censeur') then raise exception 'censeur_approval_required';end if;
 if length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>2000 then raise exception 'reason_required';end if;
 select * into v from public.bulletin_versions where id=p_version and school_id=sid;if v.id is null then raise exception 'not_authorized';end if;
 perform pg_advisory_xact_lock(hashtextextended('bulletin:'||v.class_id::text||v.period_id::text,0));
 if exists(select 1 from public.bulletin_versions where student_id=v.student_id and class_id=v.class_id and period_id=v.period_id and version>v.version) then raise exception 'newer_bulletin_exists';end if;
 if v.approved_by is not null then raise exception 'already_approved';end if;
 select coalesce(nullif(full_name,''),auth.uid()::text) into actor from public.users where id=auth.uid();
 insert into public.bulletin_versions(school_id,student_id,class_id,period_id,version,payload,reason,published_by,publisher_name,publisher_role,approved_by,approver_name,approved_at,previous_id)
 values(v.school_id,v.student_id,v.class_id,v.period_id,v.version+1,v.payload,trim(p_reason),auth.uid(),actor,'censeur',auth.uid(),actor,now(),v.id) returning id into new_id;
 return new_id;
end $$;

create function public.bulletin_publication_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();begin
 if not private.has_role(sid,array['school_admin','director','censeur']) then raise exception 'not_authorized';end if;
 return jsonb_build_object('can_approve',exists(select 1 from public.school_members where school_id=sid and user_id=auth.uid() and enabled and role='censeur'),
 'classes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'year_id',y.id,'year',y.name,'section',public.grade_section(c.grade_level)) order by y.start_date desc,c.name) from public.classes c join public.academic_years y on y.id=c.academic_year_id where c.school_id=sid),'[]'),
 'periods',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'year_id',academic_year_id,'sections',sections) order by start_date) from public.grading_periods where school_id=sid),'[]'),
 'versions',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'student',v.payload->'student','class_id',v.class_id,'period_id',v.period_id,'card',private.bulletin_card(v)) order by v.published_at desc,v.version desc) from public.bulletin_versions v where v.school_id=sid),'[]'));
end $$;
create function public.bulletin_class_preview(p_class uuid,p_period uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();begin
 if not private.has_role(sid,array['school_admin','director','censeur']) or not exists(select 1 from public.classes c join public.grading_periods p on p.academic_year_id=c.academic_year_id and p.school_id=c.school_id where c.id=p_class and c.school_id=sid and p.id=p_period and public.grade_section(c.grade_level)=any(p.sections)) then raise exception 'not_authorized';end if;
 return coalesce((with roster as(select student_id from public.enrollments where class_id=p_class union select student_id from public.grades where class_id=p_class and grading_period_id=p_period),reports as(select private.calculated_student_report_cards(student_id) doc from roster)
 select jsonb_agg(doc||jsonb_build_object('cards',jsonb_build_array(card),'attendance','[]'::jsonb) order by doc->'student'->>'last_name',doc->'student'->>'first_name') from reports cross join lateral jsonb_array_elements(doc->'cards') card where card->>'class_id'=p_class::text and card->>'period_id'=p_period::text),'[]');
end $$;
revoke all on function public.bulletin_class_preview(uuid,uuid) from public,anon,authenticated;
grant execute on function public.bulletin_class_preview(uuid,uuid) to authenticated;
revoke all on function public.publish_class_bulletins(uuid,uuid,text),public.approve_bulletin_version(uuid,text),public.bulletin_publication_workspace() from public,anon,authenticated;
grant execute on function public.publish_class_bulletins(uuid,uuid,text),public.approve_bulletin_version(uuid,text),public.bulletin_publication_workspace() to authenticated;
