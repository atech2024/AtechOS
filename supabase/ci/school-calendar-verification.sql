begin;
insert into public.schools(id) values('71000000-0000-0000-0000-000000000001');
insert into public.users(id,full_name) values('72000000-0000-0000-0000-000000000001','Calendar Director');
insert into public.school_members(school_id,user_id,role) values('71000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001','director');
select set_config('request.jwt.claim.sub','72000000-0000-0000-0000-000000000001',true);

do $$
declare first_year uuid; successor public.academic_years%rowtype; n integer; duplicate_rejected boolean := false;
begin
 if not has_table_privilege('authenticated','public.official_calendar_sources','select') then raise exception 'staff cannot read detected official calendar sources'; end if;
 if has_table_privilege('authenticated','public.official_calendar_sources','insert') then raise exception 'authenticated staff can forge the global official source registry'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='official_calendar_sources' and column_name='document_kind') then raise exception 'calendar documents do not distinguish exam references'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='official_calendar_sources' and column_name='suggested_dates' and data_type='jsonb') then raise exception 'exam date proposals are not persisted for review'; end if;
 first_year:=public.create_academic_year_with_successor('2026/2027',date '2026-09-01',date '2027-06-30',true);
 select count(*) into n from public.academic_years where school_id='71000000-0000-0000-0000-000000000001';
 if n<>2 then raise exception 'first academic year did not prepare one successor'; end if;
 select * into successor from public.academic_years where school_id='71000000-0000-0000-0000-000000000001' and id<>first_year;
 if successor.start_date<>date '2027-06-30' then raise exception 'successor does not begin at configured end date'; end if;
 if (successor.end_date-successor.start_date)<>(date '2027-06-30'-date '2026-09-01') then raise exception 'successor duration was not carried forward'; end if;
 if successor.is_current then raise exception 'successor must remain inactive until staff confirms it'; end if;
 perform public.update_academic_year(successor.id,'2027/2028',date '2027-09-01',date '2028-06-30',true);
 if not exists(select 1 from public.academic_years where id=successor.id and is_current and name='2027/2028') then raise exception 'staff could not review and activate the successor year'; end if;
 begin
  update public.academic_years set is_current=true where id=first_year;
 exception when unique_violation then
  duplicate_rejected:=true;
 end;
 if not duplicate_rejected then raise exception 'a school could activate two academic years'; end if;
 if not exists(select 1 from public.academic_years where id=successor.id and is_current) then raise exception 'failed activation changed the existing current year'; end if;
 insert into public.schools(id) values('71000000-0000-0000-0000-000000000002');
 insert into public.academic_years(school_id,name,start_date,end_date,is_current)
 values('71000000-0000-0000-0000-000000000002','2026/2027',date '2026-09-01',date '2027-06-30',true);
 if (select count(*) from public.academic_years where is_current)<>2 then raise exception 'separate schools cannot each have a current year'; end if;
end $$;
rollback;
