begin;

insert into public.schools(id,name) values
 ('12000000-0000-0000-0000-000000000001','Class section CI');
insert into public.users(id,full_name,email) values
 ('22000000-0000-0000-0000-000000000001','Section Director','director@class-ci.invalid'),
 ('22000000-0000-0000-0000-000000000002','Section Teacher','teacher@class-ci.invalid');
insert into public.academic_years(id,school_id,name,start_date,end_date,is_current) values
 ('32000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000001','Section year A','2026-08-01','2027-07-31',true),
 ('32000000-0000-0000-0000-000000000002','12000000-0000-0000-0000-000000000001','Section year B','2027-08-01','2028-07-31',false);
insert into public.school_members(school_id,user_id,role) values
 ('12000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000001','director'),
 ('12000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000002','teacher');
insert into public.grade_levels(id,code,name,sort_order) values
 ('42000000-0000-0000-0000-000000000001','PS1','Petite Section',1),
 ('42000000-0000-0000-0000-000000000002','PS2','Moyenne Section',2),
 ('42000000-0000-0000-0000-000000000003','PS3','Grande Section',3),
 ('42000000-0000-0000-0000-000000000004','AF1','1re AF',4),
 ('42000000-0000-0000-0000-000000000005','AF2','2e AF',5),
 ('42000000-0000-0000-0000-000000000006','AF3','3e AF',6),
 ('42000000-0000-0000-0000-000000000007','AF4','4e AF',7),
 ('42000000-0000-0000-0000-000000000008','AF5','5e AF',8),
 ('42000000-0000-0000-0000-000000000009','AF6','6e AF',9),
 ('42000000-0000-0000-0000-000000000010','AF7','7e AF',10),
 ('42000000-0000-0000-0000-000000000011','AF8','8e AF',11),
 ('42000000-0000-0000-0000-000000000012','AF9','9e AF',12),
 ('42000000-0000-0000-0000-000000000013','NS1','NS1',13),
 ('42000000-0000-0000-0000-000000000014','NS2','NS2',14),
 ('42000000-0000-0000-0000-000000000015','NS3','NS3',15),
 ('42000000-0000-0000-0000-000000000016','NS4','NS4',16);

select set_config('request.jwt.claim.sub','22000000-0000-0000-0000-000000000001',true);

do $test$
declare failed boolean:=false; class_id uuid;
begin
 perform public.activate_school_section('32000000-0000-0000-0000-000000000001','primary',true);
 if (select count(*) from public.classes c join public.grade_levels g on g.id=c.grade_level_id where c.academic_year_id='32000000-0000-0000-0000-000000000001' and g.code between 'AF1' and 'AF6' and c.enabled)<>6 then
  raise exception 'activation did not seed and enable all six primary grades';
 end if;

 class_id:=public.create_class('32000000-0000-0000-0000-000000000001','2e AF - B','AF2');
 if not exists(select 1 from public.classes where id=class_id and enabled) then raise exception 'class in enabled primary section was not created'; end if;

 begin
  perform public.create_class('32000000-0000-0000-0000-000000000001','7e AF - A','AF7');
  raise exception 'inactive section class was created';
 exception when raise_exception then
  if sqlerrm<>'school_section_not_enabled' then raise; end if;
 end;

 begin
  perform public.create_class('32000000-0000-0000-0000-000000000001','Ungraded class',null);
  raise exception 'ungraded class was created';
 exception when raise_exception then
  if sqlerrm<>'invalid_grade_level' then raise; end if;
 end;

 perform public.activate_school_section('32000000-0000-0000-0000-000000000001','primary',false);
 begin
  perform public.create_class('32000000-0000-0000-0000-000000000001','1re AF - B','AF1');
  raise exception 'class was created after section deactivation';
 exception when raise_exception then
  if sqlerrm<>'school_section_not_enabled' then raise; end if;
 end;

 perform public.activate_school_section('32000000-0000-0000-0000-000000000001','primary',true);
 perform public.activate_school_section('32000000-0000-0000-0000-000000000001','fundamental',true);
 class_id:=public.create_class('32000000-0000-0000-0000-000000000001','8e AF - B','AF8');
 if not exists(select 1 from public.classes where id=class_id and enabled) then raise exception 'enabled fundamental class was not created'; end if;

 begin
  perform public.create_class('32000000-0000-0000-0000-000000000002','1re AF in inactive year','AF1');
  raise exception 'class was created in a year with no activated section';
 exception when raise_exception then
  if sqlerrm<>'school_section_not_enabled' then raise; end if;
 end;

 perform set_config('request.jwt.claim.sub','22000000-0000-0000-0000-000000000002',true);
 begin
  perform public.create_class('32000000-0000-0000-0000-000000000001','Teacher bypass','AF1');
  raise exception 'teacher created a class';
 exception when raise_exception then
  if sqlerrm<>'school_membership_required' then raise; end if;
 end;
 begin
  perform public.activate_school_section('32000000-0000-0000-0000-000000000001','primary',false);
  raise exception 'teacher changed an activated section';
 exception when raise_exception then
  if sqlerrm<>'not_authorized' then raise; end if;
 end;
end;
$test$;

rollback;
