-- Preschool observation-based reporting. This stays separate from numeric grades.
create table public.preschool_program_settings (
 school_id uuid primary key references public.schools(id),
 coordinator_user_id uuid references public.users(id),
 english_enabled boolean not null default false,
 religion_enabled boolean not null default false,
 direction_signature boolean not null default false,
 evaluation_scale jsonb not null default '[{"code":"very_good","label":"Très bien"},{"code":"good","label":"Bien"},{"code":"developing","label":"En développement"},{"code":"reinforce","label":"À renforcer"},{"code":"not_observed","label":"Non observé"}]'::jsonb,
 updated_by uuid references public.users(id),
 updated_at timestamptz not null default now(),
 check(jsonb_typeof(evaluation_scale)='array' and jsonb_array_length(evaluation_scale) between 2 and 8)
);

create table public.preschool_competencies (
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 grade_code text not null check(grade_code in ('PS1','PS2','PS3')),
 domain_code text not null check(domain_code in ('language','math','motor','art','world','social','optional_english','optional_religion')),
 label text not null check(length(trim(label)) between 2 and 180),sort_order integer not null default 0,
 active boolean not null default true,created_by uuid references public.users(id),created_at timestamptz not null default now(),
 unique(school_id,grade_code,domain_code,label)
);
create index preschool_competencies_lookup on public.preschool_competencies(school_id,grade_code,active,sort_order);

create table public.preschool_class_staff (
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 class_id uuid not null references public.classes(id),user_id uuid not null references public.users(id),
 assignment_role text not null check(assignment_role in ('titulaire','aide_educatrice')),
 assigned_by uuid not null references public.users(id),assigned_at timestamptz not null default now(),
 unique(class_id,assignment_role),unique(class_id,user_id)
);
create index preschool_class_staff_user on public.preschool_class_staff(school_id,user_id,class_id);

create table public.preschool_evaluations (
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),class_id uuid not null references public.classes(id),
 period_id uuid not null references public.grading_periods(id),competency_id uuid not null references public.preschool_competencies(id),
 rating text not null check(rating in ('very_good','good','developing','reinforce','not_observed')),
 comment text check(comment is null or length(comment)<=2000),updated_by uuid not null references public.users(id),updated_at timestamptz not null default now(),
 unique(student_id,period_id,competency_id)
);
create index preschool_evaluations_student on public.preschool_evaluations(school_id,student_id,period_id);

create table public.preschool_student_remarks (
 school_id uuid not null references public.schools(id),student_id uuid not null references public.students(id),
 class_id uuid not null references public.classes(id),period_id uuid not null references public.grading_periods(id),
 remark text check(remark is null or length(remark)<=3000),updated_by uuid not null references public.users(id),updated_at timestamptz not null default now(),
 primary key(student_id,period_id)
);

create table public.preschool_evaluation_events (
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 evaluation_id uuid not null references public.preschool_evaluations(id),actor_id uuid not null references public.users(id),
 action text not null check(action in ('created','updated')),old_value jsonb,new_value jsonb,created_at timestamptz not null default now()
);
create table public.preschool_bulletin_versions (
 id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),class_id uuid not null references public.classes(id),
 academic_year_id uuid not null references public.academic_years(id),period_id uuid not null references public.grading_periods(id),
 version integer not null check(version>0),exam_month smallint not null check(exam_month between 1 and 12),
 payload jsonb not null,published_by uuid not null references public.users(id),publisher_name text not null,
 published_at timestamptz not null default now(),previous_id uuid references public.preschool_bulletin_versions(id),
 unique(student_id,class_id,period_id,version)
);
create index preschool_bulletin_history on public.preschool_bulletin_versions(school_id,student_id,academic_year_id,period_id,published_at desc);

alter table public.preschool_program_settings enable row level security;
alter table public.preschool_competencies enable row level security;
alter table public.preschool_class_staff enable row level security;
alter table public.preschool_evaluations enable row level security;
alter table public.preschool_student_remarks enable row level security;
alter table public.preschool_evaluation_events enable row level security;
alter table public.preschool_bulletin_versions enable row level security;
revoke all on public.preschool_program_settings,public.preschool_competencies,public.preschool_class_staff,public.preschool_evaluations,public.preschool_student_remarks,public.preschool_evaluation_events,public.preschool_bulletin_versions from public,anon,authenticated;

create function private.can_manage_preschool(p_school uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_role(p_school,array['school_admin','director','secretary','censeur'])
$$;
create function private.can_access_preschool_class(p_class uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.classes c left join public.grade_levels gl on gl.id=c.grade_level_id where c.id=p_class and public.grade_section(coalesce(c.grade_level,gl.code))='preschool' and
  (private.can_manage_preschool(c.school_id) or c.homeroom_teacher_id=auth.uid() or exists(select 1 from public.preschool_program_settings ps where ps.school_id=c.school_id and ps.coordinator_user_id=auth.uid()) or
   exists(select 1 from public.preschool_class_staff cs join public.school_members m on m.school_id=cs.school_id and m.user_id=auth.uid() and m.enabled and m.role='teacher' where cs.class_id=c.id and cs.user_id=auth.uid())))
$$;
create function private.can_edit_preschool_class(p_class uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.classes c left join public.grade_levels gl on gl.id=c.grade_level_id where c.id=p_class and public.grade_section(coalesce(c.grade_level,gl.code))='preschool' and
  (private.can_manage_preschool(c.school_id) or c.homeroom_teacher_id=auth.uid() or exists(select 1 from public.preschool_program_settings ps where ps.school_id=c.school_id and ps.coordinator_user_id=auth.uid()) or exists(select 1 from public.preschool_class_staff cs join public.school_members m on m.school_id=cs.school_id and m.user_id=auth.uid() and m.enabled and m.role='teacher' where cs.class_id=c.id and cs.user_id=auth.uid())))
$$;
create function private.audit_preschool_evaluation() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.preschool_evaluation_events(school_id,evaluation_id,actor_id,action,old_value,new_value)
 values(new.school_id,new.id,auth.uid(),case when tg_op='INSERT' then 'created' else 'updated' end,case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));return new;end $$;
create trigger preschool_evaluation_audit after insert or update on public.preschool_evaluations for each row execute function private.audit_preschool_evaluation();
create function private.immutable_preschool_bulletin() returns trigger language plpgsql set search_path='' as $$begin raise exception 'preschool_bulletin_immutable';end $$;
create trigger preschool_bulletin_immutable before update or delete on public.preschool_bulletin_versions for each row execute function private.immutable_preschool_bulletin();
revoke all on function private.can_manage_preschool(uuid),private.can_access_preschool_class(uuid),private.can_edit_preschool_class(uuid),private.audit_preschool_evaluation(),private.immutable_preschool_bulletin() from public,anon,authenticated;

create function public.preschool_report_workspace(p_class uuid default null,p_period uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();selected uuid;year_id uuid;allowed boolean;begin
 if sid is null then raise exception 'not_authorized';end if;
 for selected in select c.id from public.classes c left join public.grade_levels gl on gl.id=c.grade_level_id where c.school_id=sid and c.enabled and public.grade_section(coalesce(c.grade_level,gl.code))='preschool' and private.can_access_preschool_class(c.id) loop
  perform 1 from public.preschool_program_settings where school_id=sid;
  insert into public.preschool_program_settings(school_id) values(sid) on conflict do nothing;
  insert into public.preschool_competencies(school_id,grade_code,domain_code,label,sort_order,created_by)
  select sid,v.grade_code,v.domain_code,v.label,v.sort_order,auth.uid() from (values
   ('PS1','language','Écoute une consigne courte',10),('PS1','language','Exprime ses besoins par des mots ou des gestes',20),('PS1','math','Trie des objets selon une caractéristique',30),('PS1','math','Reconnaît quelques formes familières',40),('PS1','motor','Coordonne ses gestes dans un jeu moteur',50),('PS1','motor','Manipule crayons et objets avec contrôle progressif',60),('PS1','art','Explore couleurs, textures et matériaux',70),('PS1','art','Participe à une comptine ou activité rythmique',80),('PS1','world','Observe des objets et phénomènes familiers',90),('PS1','world','Participe à des routines d’hygiène',100),('PS1','social','Participe à une activité avec ses camarades',110),('PS1','social','Suit une consigne avec accompagnement',120),
   ('PS2','language','Raconte une expérience avec des phrases simples',10),('PS2','language','Écoute une histoire et en repère des éléments',20),('PS2','math','Compare des quantités et utilise des repères numériques',30),('PS2','math','Classe et poursuit une suite simple',40),('PS2','motor','Reproduit des tracés et gestes graphiques',50),('PS2','motor','Se repère dans l’espace et dans son corps',60),('PS2','art','Réalise une création en choisissant des matériaux',70),('PS2','art','Chante ou suit un rythme appris',80),('PS2','world','Décrit des éléments de son environnement',90),('PS2','world','Participe à une observation ou expérience guidée',100),('PS2','social','Collabore et partage le matériel',110),('PS2','social','Réalise une routine avec une autonomie croissante',120),
   ('PS3','language','Comprend une histoire et en raconte les étapes',10),('PS3','language','Repère des sons, lettres ou mots familiers',20),('PS3','math','Associe nombres et quantités dans des activités',30),('PS3','math','Compare, classe et explique un raisonnement simple',40),('PS3','motor','Écrit son prénom ou reproduit des tracés préparatoires',50),('PS3','motor','Coordonne ses gestes fins et se repère latéralement',60),('PS3','art','Mène à terme une création en plusieurs étapes',70),('PS3','art','Présente une production, chanson ou jeu dramatique',80),('PS3','world','Formule des observations sur la nature et le quotidien',90),('PS3','world','Suit les étapes d’une activité d’éveil',100),('PS3','social','Exprime ses besoins et gère progressivement ses émotions',110),('PS3','social','Travaille avec autonomie et respecte les consignes',120)
  ) v(grade_code,domain_code,label,sort_order) where grade_code=coalesce((select gl.code from public.classes c left join public.grade_levels gl on gl.id=c.grade_level_id where c.id=selected), (select grade_level from public.classes where id=selected))
  on conflict(school_id,grade_code,domain_code,label) do nothing;
 end loop;
 if p_class is null then
  return jsonb_build_object('classes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'grade',coalesce(c.grade_level,gl.code),'year_id',y.id,'year',y.name) order by y.start_date desc,c.name) from public.classes c left join public.grade_levels gl on gl.id=c.grade_level_id join public.academic_years y on y.id=c.academic_year_id where c.school_id=sid and c.enabled and public.grade_section(coalesce(c.grade_level,gl.code))='preschool' and private.can_access_preschool_class(c.id)),'[]'),'settings',(select to_jsonb(ps) - 'school_id' - 'updated_by' from public.preschool_program_settings ps where ps.school_id=sid));
 end if;
 if not private.can_access_preschool_class(p_class) or not exists(select 1 from public.classes where id=p_class and school_id=sid) then raise exception 'not_authorized';end if;
 select academic_year_id into year_id from public.classes where id=p_class;
 if p_period is not null and not exists(select 1 from public.grading_periods p where p.id=p_period and p.school_id=sid and p.academic_year_id=year_id and 'preschool'=any(p.sections)) then raise exception 'invalid_period';end if;
 return jsonb_build_object(
  'classes',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'grade',coalesce(c.grade_level,gl.code),'year_id',y.id,'year',y.name) order by y.start_date desc,c.name),'[]') from public.classes c left join public.grade_levels gl on gl.id=c.grade_level_id join public.academic_years y on y.id=c.academic_year_id where c.school_id=sid and c.enabled and public.grade_section(coalesce(c.grade_level,gl.code))='preschool' and private.can_access_preschool_class(c.id)),
  'periods',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'code',code,'start_date',start_date,'end_date',end_date) order by start_date),'[]') from public.grading_periods where school_id=sid and academic_year_id=year_id and is_active and 'preschool'=any(sections)),
  'students',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.first_name||' '||s.last_name,'photo_url',s.photo_url) order by s.last_name,s.first_name),'[]') from public.enrollments e join public.students s on s.id=e.student_id and s.school_id=sid where e.class_id=p_class and e.school_id=sid and e.status='active'),
  'competencies',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'grade_code',grade_code,'domain_code',domain_code,'label',label,'sort_order',sort_order,'active',active) order by sort_order,label),'[]') from public.preschool_competencies pc where pc.school_id=sid and pc.grade_code=(select coalesce(gl.code,c.grade_level) from public.classes c left join public.grade_levels gl on gl.id=c.grade_level_id where c.id=p_class) and pc.active),
  'evaluations',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'student_id',student_id,'competency_id',competency_id,'rating',rating,'comment',comment,'updated_by',updated_by,'updated_at',updated_at)),'[]') from public.preschool_evaluations where class_id=p_class and period_id=p_period and school_id=sid),
  'remarks',(select coalesce(jsonb_agg(jsonb_build_object('student_id',student_id,'remark',remark)),'[]') from public.preschool_student_remarks where class_id=p_class and period_id=p_period and school_id=sid),
  'staff',(select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',u.full_name,'role',cs.assignment_role) order by cs.assignment_role),'[]') from public.preschool_class_staff cs join public.users u on u.id=cs.user_id join public.school_members m on m.school_id=cs.school_id and m.user_id=cs.user_id and m.enabled where cs.class_id=p_class),
  'staff_options',(case when private.can_manage_preschool(sid) then (select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',u.full_name) order by u.full_name),'[]') from public.school_members m join public.users u on u.id=m.user_id where m.school_id=sid and m.enabled and m.role in ('teacher','school_admin','director','secretary')) else '[]'::jsonb end),
  'settings',(select jsonb_build_object('coordinator_user_id',coordinator_user_id,'english_enabled',english_enabled,'religion_enabled',religion_enabled,'direction_signature',direction_signature,'evaluation_scale',evaluation_scale) from public.preschool_program_settings where school_id=sid),
  'editable',private.can_edit_preschool_class(p_class),'manager',private.can_manage_preschool(sid));
end $$;

create function public.save_preschool_evaluation(p_student uuid,p_class uuid,p_period uuid,p_competency uuid,p_rating text,p_comment text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();eid uuid;begin
 if not private.can_edit_preschool_class(p_class) or not exists(select 1 from public.classes c left join public.grade_levels gl on gl.id=c.grade_level_id join public.enrollments e on e.class_id=c.id and e.student_id=p_student and e.status='active' join public.grading_periods p on p.id=p_period and p.school_id=c.school_id and p.academic_year_id=c.academic_year_id and 'preschool'=any(p.sections) join public.preschool_competencies pc on pc.id=p_competency and pc.school_id=c.school_id and pc.grade_code=coalesce(c.grade_level,gl.code) and pc.active where c.id=p_class and c.school_id=sid and public.grade_section(coalesce(c.grade_level,gl.code))='preschool') then raise exception 'not_authorized';end if;
 if p_rating not in ('very_good','good','developing','reinforce','not_observed') or length(coalesce(p_comment,''))>2000 then raise exception 'invalid_evaluation';end if;
 insert into public.preschool_evaluations(school_id,student_id,class_id,period_id,competency_id,rating,comment,updated_by) values(sid,p_student,p_class,p_period,p_competency,p_rating,nullif(trim(p_comment),''),auth.uid()) on conflict(student_id,period_id,competency_id) do update set rating=excluded.rating,comment=excluded.comment,updated_by=auth.uid(),updated_at=now() returning id into eid;return eid;
end $$;

create function public.save_preschool_remark(p_student uuid,p_class uuid,p_period uuid,p_remark text) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();begin
 if not private.can_edit_preschool_class(p_class) or length(coalesce(p_remark,''))>3000 or not exists(select 1 from public.enrollments e join public.students s on s.id=e.student_id and s.school_id=sid where e.student_id=p_student and e.class_id=p_class and e.school_id=sid and e.status='active') or not exists(select 1 from public.grading_periods p join public.classes c on c.academic_year_id=p.academic_year_id and c.school_id=p.school_id where p.id=p_period and c.id=p_class and 'preschool'=any(p.sections)) then raise exception 'not_authorized';end if;
 insert into public.preschool_student_remarks(school_id,student_id,class_id,period_id,remark,updated_by) values(sid,p_student,p_class,p_period,nullif(trim(p_remark),''),auth.uid()) on conflict(student_id,period_id) do update set remark=excluded.remark,updated_by=auth.uid(),updated_at=now();
end $$;

create function public.save_preschool_class_staff(p_class uuid,p_role text,p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();begin
 if not private.can_manage_preschool(sid) then raise exception 'not_authorized';end if;
 if p_role not in ('titulaire','aide_educatrice') then raise exception 'invalid_preschool_class_role';end if;
 if not exists(select 1 from public.classes c left join public.grade_levels gl on gl.id=c.grade_level_id where c.id=p_class and c.school_id=sid and public.grade_section(coalesce(c.grade_level,gl.code))='preschool') then raise exception 'preschool_class_not_found';end if;
 if not exists(select 1 from public.school_members m where m.school_id=sid and m.user_id=p_user and m.enabled and m.role in ('teacher','school_admin','director','secretary')) then raise exception 'staff_member_not_found';end if;
 if exists(select 1 from public.preschool_class_staff where class_id=p_class and user_id=p_user and assignment_role<>p_role) then raise exception 'staff_cannot_hold_both_class_roles';end if;
 insert into public.preschool_class_staff(school_id,class_id,user_id,assignment_role,assigned_by) values(sid,p_class,p_user,p_role,auth.uid()) on conflict(class_id,assignment_role) do update set user_id=excluded.user_id,assigned_by=auth.uid(),assigned_at=now();
end $$;

create function public.save_preschool_settings(p_coordinator uuid,p_english boolean,p_religion boolean,p_direction_signature boolean) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();begin
 if not private.can_manage_preschool(sid) or (p_coordinator is not null and not exists(select 1 from public.school_members where school_id=sid and user_id=p_coordinator and enabled and role in ('teacher','school_admin','director','secretary'))) then raise exception 'not_authorized';end if;
 insert into public.preschool_program_settings(school_id,coordinator_user_id,english_enabled,religion_enabled,direction_signature,updated_by,updated_at) values(sid,p_coordinator,p_english,p_religion,p_direction_signature,auth.uid(),now()) on conflict(school_id) do update set coordinator_user_id=excluded.coordinator_user_id,english_enabled=excluded.english_enabled,religion_enabled=excluded.religion_enabled,direction_signature=excluded.direction_signature,updated_by=auth.uid(),updated_at=now();
end $$;

create function public.save_preschool_evaluation_scale(p_scale jsonb) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();begin
 if not private.can_manage_preschool(sid) or jsonb_typeof(p_scale)<>'array' or jsonb_array_length(p_scale)<>5 or exists(select 1 from jsonb_array_elements(p_scale) e where e->>'code' not in ('very_good','good','developing','reinforce','not_observed') or length(trim(coalesce(e->>'label','')))=0 or length(e->>'label')>80) or (select count(distinct e->>'code') from jsonb_array_elements(p_scale) e)<>5 then raise exception 'invalid_evaluation_scale';end if;
 insert into public.preschool_program_settings(school_id,evaluation_scale,updated_by,updated_at) values(sid,p_scale,auth.uid(),now()) on conflict(school_id) do update set evaluation_scale=excluded.evaluation_scale,updated_by=auth.uid(),updated_at=now();
end $$;

create function public.save_preschool_competency(p_id uuid,p_grade text,p_domain text,p_label text,p_active boolean default true) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();cid uuid;begin
 if not private.can_manage_preschool(sid) or p_grade not in ('PS1','PS2','PS3') or p_domain not in ('language','math','motor','art','world','social','optional_english','optional_religion') or length(trim(coalesce(p_label,''))) not between 2 and 180 then raise exception 'not_authorized';end if;
 if p_domain='optional_english' and not coalesce((select english_enabled from public.preschool_program_settings where school_id=sid),false) then raise exception 'optional_subject_disabled';end if;
 if p_domain='optional_religion' and not coalesce((select religion_enabled from public.preschool_program_settings where school_id=sid),false) then raise exception 'optional_subject_disabled';end if;
 if p_id is null then insert into public.preschool_competencies(school_id,grade_code,domain_code,label,created_by) values(sid,p_grade,p_domain,trim(p_label),auth.uid()) returning id into cid;
 else update public.preschool_competencies set label=trim(p_label),active=p_active where id=p_id and school_id=sid and grade_code=p_grade and domain_code=p_domain returning id into cid; if cid is null then raise exception 'not_authorized';end if;end if;return cid;
end $$;

create function public.publish_preschool_bulletins(p_class uuid,p_period uuid,p_exam_month integer,p_reason text default null) returns integer language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();n integer;begin
 if not private.has_role(sid,array['school_admin','director','censeur']) or p_exam_month not between 1 and 12 or length(coalesce(p_reason,''))>500 or not exists(select 1 from public.classes c left join public.grade_levels gl on gl.id=c.grade_level_id join public.grading_periods p on p.school_id=c.school_id and p.academic_year_id=c.academic_year_id where c.id=p_class and c.school_id=sid and public.grade_section(coalesce(c.grade_level,gl.code))='preschool' and p.id=p_period and 'preschool'=any(p.sections)) then raise exception 'not_authorized';end if;
 perform pg_advisory_xact_lock(hashtextextended('preschool-bulletin:'||p_class::text||p_period::text,0));
 with roster as(select s.id student_id,s.first_name,s.last_name,s.atechos_id,s.photo_url,c.name class_name,coalesce(c.grade_level,gl.code) grade_level,y.id year_id,y.name year_name,p.name period_name,ps.name school_name,ps.code school_code,ps.address school_address,ps.phone school_phone,ps.logo_url school_logo,coalesce(setting.direction_signature,false) direction_signature,setting.english_enabled,setting.religion_enabled,setting.coordinator_user_id,(select full_name from public.users where id=setting.coordinator_user_id) coordinator_name
  from public.enrollments e join public.students s on s.id=e.student_id join public.classes c on c.id=e.class_id left join public.grade_levels gl on gl.id=c.grade_level_id join public.academic_years y on y.id=c.academic_year_id join public.grading_periods p on p.id=p_period join public.schools ps on ps.id=sid left join public.preschool_program_settings setting on setting.school_id=sid where e.class_id=p_class and e.status='active' and e.school_id=sid), docs as(select r.*,(select coalesce(jsonb_agg(jsonb_build_object('role',cs.assignment_role,'name',u.full_name) order by cs.assignment_role),'[]') from public.preschool_class_staff cs join public.users u on u.id=cs.user_id where cs.class_id=p_class) staff,(select coalesce(jsonb_agg(jsonb_build_object('domain',pc.domain_code,'competency',pc.label,'rating',coalesce(ev.rating,'not_observed'),'comment',ev.comment) order by pc.sort_order,pc.label),'[]') from public.preschool_competencies pc left join public.preschool_evaluations ev on ev.competency_id=pc.id and ev.student_id=r.student_id and ev.period_id=p_period where pc.school_id=sid and pc.grade_code=r.grade_level and pc.active and (pc.domain_code not like 'optional_%' or (pc.domain_code='optional_english' and r.english_enabled) or (pc.domain_code='optional_religion' and r.religion_enabled))) evaluations,(select remark from public.preschool_student_remarks where student_id=r.student_id and period_id=p_period) remark from roster r)
 insert into public.preschool_bulletin_versions(school_id,student_id,class_id,academic_year_id,period_id,version,exam_month,payload,published_by,publisher_name,previous_id)
 select sid,d.student_id,p_class,d.year_id,p_period,coalesce(last.version,0)+1,p_exam_month,jsonb_build_object('school',jsonb_build_object('name',d.school_name,'code',d.school_code,'address',d.school_address,'phone',d.school_phone,'logo_url',d.school_logo),'student',jsonb_build_object('id',d.student_id,'name',d.first_name||' '||d.last_name,'atechos_id',d.atechos_id,'photo_url',d.photo_url),'class',jsonb_build_object('id',p_class,'name',d.class_name,'grade',d.grade_level),'academic_year',d.year_name,'period',d.period_name,'period_id',p_period,'exam_month',p_exam_month,'evaluation_scale',(select evaluation_scale from public.preschool_program_settings where school_id=sid),'staff',d.staff,'coordinator',d.coordinator_name,'direction_signature',d.direction_signature,'competencies',d.evaluations,'remark',d.remark,'attendance',(select jsonb_build_object('present',count(*) filter(where a.status='present'),'late',count(*) filter(where a.status='late'),'absent',count(*) filter(where a.status='absent')) from public.attendance a join public.grading_periods gp on gp.id=p_period where a.student_id=d.student_id and a.class_id=p_class and a.school_id=sid and a.attendance_date between gp.start_date and gp.end_date),'published_reason',nullif(trim(p_reason),'')),auth.uid(),coalesce((select full_name from public.users where id=auth.uid()),'Direction'),last.id
 from docs d left join lateral(select id,version from public.preschool_bulletin_versions v where v.student_id=d.student_id and v.class_id=p_class and v.period_id=p_period order by version desc limit 1)last on true;
 get diagnostics n=row_count;return n;
end $$;

create function public.family_preschool_bulletins() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sid uuid:=public.get_my_school_id();begin
 if not exists(select 1 from public.school_members where school_id=sid and user_id=auth.uid() and enabled and role='parent') then raise exception 'not_authorized';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'version',v.version,'published_at',v.published_at,'payload',v.payload) order by y.start_date desc,p.start_date desc,v.published_at desc) from public.preschool_bulletin_versions v join public.students s on s.id=v.student_id join public.academic_years y on y.id=v.academic_year_id join public.grading_periods p on p.id=v.period_id where v.school_id=sid and private.family_student(s.id) and (s.departure_year_id is null or y.start_date<=(select start_date from public.academic_years where id=s.departure_year_id))),'[]');
end $$;

alter function private.student_report_cards(uuid) rename to calculated_student_report_cards;
create function private.student_report_cards(p_student uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare base jsonb;sid uuid;begin
 base:=private.calculated_student_report_cards(p_student);select school_id into sid from public.students where id=p_student;
 return base||jsonb_build_object('preschool_cards',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'version',v.version,'published_at',v.published_at,'payload',v.payload) order by y.start_date desc,p.start_date desc,v.published_at desc) from public.preschool_bulletin_versions v join public.academic_years y on y.id=v.academic_year_id join public.grading_periods p on p.id=v.period_id where v.school_id=sid and v.student_id=p_student),'[]'));
end $$;
revoke all on function private.calculated_student_report_cards(uuid),private.student_report_cards(uuid) from public,anon,authenticated;

create or replace function public.get_report_card(p_student uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sid uuid;begin
 select school_id into sid from public.students where id=p_student;
 if sid is null or not (private.has_role(sid,array['school_admin','director','secretary','surveillant']) or exists(select 1 from public.student_parents sp join public.parents p on p.id=sp.parent_id join public.school_members m on m.school_id=p.school_id and m.user_id=p.user_id and m.role='parent' and m.enabled where sp.student_id=p_student and p.school_id=sid and p.user_id=auth.uid())) then raise exception 'not_authorized';end if;
 return private.student_report_cards(p_student);
end $$;

revoke all on function public.preschool_report_workspace(uuid,uuid),public.save_preschool_evaluation(uuid,uuid,uuid,uuid,text,text),public.save_preschool_remark(uuid,uuid,uuid,text),public.save_preschool_class_staff(uuid,text,uuid),public.save_preschool_settings(uuid,boolean,boolean,boolean),public.save_preschool_evaluation_scale(jsonb),public.save_preschool_competency(uuid,text,text,text,boolean),public.publish_preschool_bulletins(uuid,uuid,integer,text),public.get_report_card(uuid) from public,anon,authenticated;
grant execute on function public.preschool_report_workspace(uuid,uuid),public.save_preschool_evaluation(uuid,uuid,uuid,uuid,text,text),public.save_preschool_remark(uuid,uuid,uuid,text),public.save_preschool_class_staff(uuid,text,uuid),public.save_preschool_settings(uuid,boolean,boolean,boolean),public.save_preschool_evaluation_scale(jsonb),public.save_preschool_competency(uuid,text,text,text,boolean),public.publish_preschool_bulletins(uuid,uuid,integer,text),public.get_report_card(uuid),public.family_preschool_bulletins() to authenticated;
