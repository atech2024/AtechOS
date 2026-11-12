-- Safe rollback-only fixture for the official terms migration.
-- Requires the migration to be installed. All fixture rows roll back.
do $test$
declare sid uuid; yr uuid:=gen_random_uuid(); t4 uuid;
begin
  select id into sid from public.schools order by created_at limit 1;
  if sid is null then raise exception 'TEST requires an existing school'; end if;
  begin
    insert into public.academic_years(id,school_id,name,start_date,end_date,is_current,term_count)
    values(yr,sid,'AtechOS terms fixture','2098-08-01','2099-06-30',false,3);

    begin
      insert into public.grading_periods(school_id,name,code,start_date,end_date,weight,academic_year_id,sections,is_active)
      values(sid,'Control fixture','C1','2098-08-01','2098-09-30',100,yr,array['primary'],true);
      raise exception 'TEST C1 was accepted as a grading period';
    exception when others then
      if sqlerrm='TEST C1 was accepted as a grading period' then raise; end if;
      if sqlerrm<>'assessment_is_not_a_grading_period' then raise; end if;
    end;

    begin
      insert into public.grading_periods(school_id,name,code,start_date,end_date,weight,academic_year_id,sections,is_active)
      values(sid,'Fourth term fixture','T4','2099-04-01','2099-06-30',100,yr,array['primary'],true);
      raise exception 'TEST T4 was accepted for a three-term year';
    exception when others then
      if sqlerrm='TEST T4 was accepted for a three-term year' then raise; end if;
      if sqlerrm<>'fourth_term_not_enabled' then raise; end if;
    end;

    update public.academic_years set term_count=4 where id=yr;
    insert into public.grading_periods(school_id,name,code,start_date,end_date,weight,academic_year_id,sections,is_active)
    values(sid,'Fourth term fixture','T4','2099-04-01','2099-06-30',100,yr,array['primary'],true)
    returning id into t4;
    if not exists(select 1 from public.grading_periods where id=t4 and is_active) then raise exception 'TEST T4 activation'; end if;

    raise exception using errcode='ZX001',message='rollback fixture';
  exception when sqlstate 'ZX001' then null;
  end;
end $test$;
