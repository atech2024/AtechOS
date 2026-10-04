begin;

insert into public.schools(id) values ('fa000000-0000-0000-0000-000000000001');
insert into public.academic_years(id,school_id,name,start_date,end_date,is_current) values
 ('fa100000-0000-0000-0000-000000000001','fa000000-0000-0000-0000-000000000001','Finance CI 2026-2027','2026-08-01','2027-07-31',true),
 ('fa100000-0000-0000-0000-000000000002','fa000000-0000-0000-0000-000000000001','Finance CI 2025-2026','2025-08-01','2026-07-31',false);
insert into public.classes(id,school_id,academic_year_id,name,enabled) values
 ('fa200000-0000-0000-0000-000000000001','fa000000-0000-0000-0000-000000000001','fa100000-0000-0000-0000-000000000001','Finance CI Class',true),
 ('fa200000-0000-0000-0000-000000000002','fa000000-0000-0000-0000-000000000001','fa100000-0000-0000-0000-000000000002','Finance CI Historic Class',true);
insert into public.users(id,full_name) values
 ('fa300000-0000-0000-0000-000000000001','Finance Director'),
 ('fa300000-0000-0000-0000-000000000002','Finance Administrator'),
 ('fa300000-0000-0000-0000-000000000003','Finance Secretary'),
 ('fa300000-0000-0000-0000-000000000004','Finance Accountant'),
 ('fa300000-0000-0000-0000-000000000005','Finance Parent');
insert into public.students(id,school_id,first_name,last_name,atechos_id,active,school_status) values
 ('fa400000-0000-0000-0000-000000000001','fa000000-0000-0000-0000-000000000001','Finance','Student','AOS-FINANCE-CI',true,'active'),
 ('fa400000-0000-0000-0000-000000000002','fa000000-0000-0000-0000-000000000001','Future','Due Date Student','AOS-FINANCE-CI-2',true,'active');
insert into public.enrollments(id,school_id,student_id,class_id,status) values
 ('fa500000-0000-0000-0000-000000000001','fa000000-0000-0000-0000-000000000001','fa400000-0000-0000-0000-000000000001','fa200000-0000-0000-0000-000000000001','active');
insert into public.school_members(school_id,user_id,role,enabled) values
 ('fa000000-0000-0000-0000-000000000001','fa300000-0000-0000-0000-000000000001','director',true),
 ('fa000000-0000-0000-0000-000000000001','fa300000-0000-0000-0000-000000000002','school_admin',true),
 ('fa000000-0000-0000-0000-000000000001','fa300000-0000-0000-0000-000000000003','secretary',true),
 ('fa000000-0000-0000-0000-000000000001','fa300000-0000-0000-0000-000000000004','accountant',true),
 ('fa000000-0000-0000-0000-000000000001','fa300000-0000-0000-0000-000000000005','parent',true);
insert into public.parents(id,school_id,user_id,full_name,email) values
 ('fa600000-0000-0000-0000-000000000001','fa000000-0000-0000-0000-000000000001','fa300000-0000-0000-0000-000000000005','Finance Parent','finance-parent@example.test');
insert into public.student_parents(student_id,parent_id,relationship) values
 ('fa400000-0000-0000-0000-000000000001','fa600000-0000-0000-0000-000000000001','parent');

do $$
declare plan_id uuid; charge_id uuid; future_charge uuid; payment_id uuid; credit_payment_id uuid; second_payment_id uuid; adjustment_id uuid; generated integer; workspace jsonb; denied boolean; future_installment uuid; class_plan_id uuid; class_charge_id uuid; entry_plan_id uuid; entry_charge_id uuid; entry_installment uuid; second_entry_charge_id uuid;
begin
  if has_table_privilege('authenticated','public.finance_payments','INSERT') or has_table_privilege('authenticated','public.finance_payments','UPDATE') or has_table_privilege('authenticated','public.finance_payments','DELETE') then raise exception 'authenticated can directly mutate finance payments'; end if;
  if has_table_privilege('authenticated','public.finance_audit_events','UPDATE') or has_table_privilege('authenticated','public.finance_audit_events','DELETE') then raise exception 'finance audit events are mutable through the Data API'; end if;
  if not (select relrowsecurity from pg_class where oid='public.finance_payments'::regclass) or not (select relrowsecurity from pg_class where oid='public.finance_audit_events'::regclass) then raise exception 'finance RLS is disabled'; end if;

  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000001',true);
  perform public.save_finance_settings('HTG',false,false);
  workspace:=public.finance_workspace('fa100000-0000-0000-0000-000000000001','fa200000-0000-0000-0000-000000000001');
  if (workspace->'settings'->>'restrict_kiosk')::boolean or (workspace->'settings'->>'restrict_exams')::boolean or (workspace->'settings'->>'restrict_bulletins')::boolean then raise exception 'finance restrictions must default off'; end if;
  plan_id:=public.create_finance_fee_plan('fa100000-0000-0000-0000-000000000001','fa200000-0000-0000-0000-000000000001','rentree','Rentrée 2026',
    '[{"amount":100,"due_date":"2026-09-01"},{"amount":200,"due_date":"2027-01-15"}]'::jsonb);
  generated:=public.issue_finance_fee_plan(plan_id);
  if generated<>2 or public.issue_finance_fee_plan(plan_id)<>0 then raise exception 'fee issuance should create installment charges once and be idempotent'; end if;
  select id into charge_id from public.finance_charges where fee_plan_id=plan_id order by due_date limit 1;
  if charge_id is null then raise exception 'fee plan did not create student charges'; end if;
  class_plan_id:=public.create_finance_fee_plan('fa100000-0000-0000-0000-000000000001','fa200000-0000-0000-0000-000000000001','class_fee','Tuition fee',
    '[{"amount":10,"due_date":"2026-08-15"}]'::jsonb);
  if public.issue_finance_fee_plan(class_plan_id)<>1 then raise exception 'class fee was not generated'; end if;
  select id into class_charge_id from public.finance_charges where fee_plan_id=class_plan_id;
  entry_plan_id:=public.create_finance_fee_plan('fa100000-0000-0000-0000-000000000001','fa200000-0000-0000-0000-000000000001','inscription','Entry fee',
    '[{"amount":25,"due_date":"2026-09-01"}]'::jsonb);
  if public.issue_finance_fee_plan(entry_plan_id)<>1 then raise exception 'entry fee was not generated'; end if;
  select id into entry_charge_id from public.finance_charges where fee_plan_id=entry_plan_id;
  select id into entry_installment from public.finance_fee_installments where fee_plan_id=entry_plan_id;
  insert into public.finance_charges(school_id,student_id,academic_year_id,class_id,fee_plan_id,fee_installment_id,description,amount,currency_code,due_date,created_by)
  values('fa000000-0000-0000-0000-000000000001','fa400000-0000-0000-0000-000000000002','fa100000-0000-0000-0000-000000000001','fa200000-0000-0000-0000-000000000001',entry_plan_id,entry_installment,'Second student entry fee',25,'HTG','2026-09-01','fa300000-0000-0000-0000-000000000002') returning id into second_entry_charge_id;
  select id into future_installment from public.finance_fee_installments where fee_plan_id=plan_id and due_date='2027-01-15';
  insert into public.finance_charges(school_id,student_id,academic_year_id,class_id,fee_plan_id,fee_installment_id,description,amount,currency_code,due_date,created_by)
  values('fa000000-0000-0000-0000-000000000001','fa400000-0000-0000-0000-000000000002','fa100000-0000-0000-0000-000000000001','fa200000-0000-0000-0000-000000000001',plan_id,future_installment,'Future installment',200,'HTG','2027-01-15','fa300000-0000-0000-0000-000000000002') returning id into future_charge;

  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000003',true);
  payment_id:=public.record_finance_payment(charge_id,50,'Cash','CI-PARTIAL-1',null,'2026-09-01 12:00:00-04');
  denied:=false;
  begin perform public.review_finance_payment(payment_id,'validated',null); exception when others then denied:=sqlerrm='not_authorized'; end;
  if not denied then raise exception 'secretary validated a payment'; end if;
  denied:=false;
  begin perform public.record_finance_payment(class_charge_id,11,'Cash','CI-CLASS-OVERPAY',null,'2026-09-01 12:00:00-04'); exception when others then denied:=sqlerrm='overpayment_only_allowed_for_entry_fees'; end;
  if not denied then raise exception 'non-entry fee unexpectedly accepted an overpayment'; end if;
  credit_payment_id:=public.record_finance_payment(entry_charge_id,45,'Cash','CI-ENTRY-OVERPAY',null,'2026-09-01 12:00:00-04');
  if (select applied_amount from public.finance_payments where id=credit_payment_id)<>25 then raise exception 'entry overpayment was not split into charge payment and student credit'; end if;
  second_payment_id:=public.record_finance_payment(second_entry_charge_id,300,'Cash','CI-UNAPPLIED-CREDIT',null,'2026-09-01 12:00:00-04');
  select id into payment_id from public.finance_payments where reference='CI-PARTIAL-1';

  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000001',true);
  denied:=false;
  begin perform public.review_finance_payment(payment_id,'validated',null); exception when others then denied:=sqlerrm='not_authorized'; end;
  if not denied then raise exception 'director validated a payment without school setting'; end if;

  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000004',true);
  perform public.review_finance_payment(credit_payment_id,'validated',null);
  if not exists(select 1 from public.finance_credit_allocations a join public.finance_charges c on c.id=a.charge_id where a.credit_id=(select id from public.finance_student_credits where source_payment_id=credit_payment_id) and c.id=class_charge_id and a.amount=10) then raise exception 'overpayment credit was not automatically applied'; end if;
  perform public.review_finance_payment(second_payment_id,'validated',null);
  if not exists(select 1 from public.finance_credit_allocations a where a.credit_id=(select id from public.finance_student_credits where source_payment_id=second_payment_id) and a.charge_id=future_charge and a.amount=200) then raise exception 'student credit was not applied to the future fee'; end if;
  if not exists(select 1 from public.finance_student_credits cr where cr.source_payment_id=second_payment_id and cr.amount-coalesce((select sum(a.amount) from public.finance_credit_allocations a where a.credit_id=cr.id),0)=75) then raise exception 'remaining student credit was not retained'; end if;
  select id into payment_id from public.finance_payments where reference='CI-PARTIAL-1';
  perform public.review_finance_payment(payment_id,'validated',null);
  if not exists(select 1 from public.notifications n where n.school_id='fa000000-0000-0000-0000-000000000001' and n.recipient_id='fa300000-0000-0000-0000-000000000005' and n.event_key='finance-payment-validated:'||payment_id::text and n.description like '%50.00 HTG%' and n.description like '%Rentrée 2026%' and n.description like '%Validé%' and n.description like '%Solde restant :%' and n.description like '%CI-PARTIAL-1%') then raise exception 'validated payment notice omitted required receipt details or missed linked parent'; end if;

  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000001',true);
  adjustment_id:=public.request_finance_adjustment(charge_id,'half_scholarship',25,'School approved half scholarship');
  perform public.review_finance_adjustment(adjustment_id,'approved',null);
  perform public.save_finance_settings('HTG',false,false,true,false,false);
  if not private.finance_restriction_active('fa400000-0000-0000-0000-000000000001','kiosk') then raise exception 'overdue positive balance did not trigger selected KIOS restriction'; end if;
  if private.finance_restriction_active('fa400000-0000-0000-0000-000000000001','exams') or private.finance_restriction_active('fa400000-0000-0000-0000-000000000001','bulletins') then raise exception 'unselected finance restrictions activated'; end if;
  perform public.save_finance_settings('HTG',false,false,true,true,true);
  if not private.finance_restriction_active('fa400000-0000-0000-0000-000000000001','exams') or not private.finance_restriction_active('fa400000-0000-0000-0000-000000000001','bulletins') then raise exception 'selected restrictions did not activate for overdue balance'; end if;
  if private.finance_restriction_active('fa400000-0000-0000-0000-000000000002','kiosk') then raise exception 'future installment triggered an overdue restriction'; end if;
  workspace:=private.filter_finance_restricted_bulletins('fa400000-0000-0000-0000-000000000001',jsonb_build_object('cards',jsonb_build_array(jsonb_build_object('class_id','fa200000-0000-0000-0000-000000000001'),jsonb_build_object('class_id','fa200000-0000-0000-0000-000000000002')),'document_history',jsonb_build_array(jsonb_build_object('class_id','fa200000-0000-0000-0000-000000000001'),jsonb_build_object('class_id','fa200000-0000-0000-0000-000000000002')),'preschool_cards',jsonb_build_array(jsonb_build_object('academic_year_id','fa100000-0000-0000-0000-000000000001'),jsonb_build_object('academic_year_id','fa100000-0000-0000-0000-000000000002'))));
  if jsonb_array_length(workspace->'cards')<>1 or workspace->'cards'->0->>'class_id'<>'fa200000-0000-0000-0000-000000000002' then raise exception 'current-year bulletins were not filtered or historic cards were removed'; end if;
  if jsonb_array_length(workspace->'document_history')<>1 or jsonb_array_length(workspace->'preschool_cards')<>1 then raise exception 'published historic bulletins were not retained'; end if;
  update public.students set school_status='departed' where id='fa400000-0000-0000-0000-000000000001';
  if private.finance_restriction_active('fa400000-0000-0000-0000-000000000001','bulletins') then raise exception 'departed student financial restriction should not hide history'; end if;
  workspace:=private.filter_finance_restricted_bulletins('fa400000-0000-0000-0000-000000000001',jsonb_build_object('cards',jsonb_build_array(jsonb_build_object('class_id','fa200000-0000-0000-0000-000000000001'))));
  if jsonb_array_length(workspace->'cards')<>1 then raise exception 'departed linked parent bulletin history was hidden'; end if;
  update public.students set school_status='active' where id='fa400000-0000-0000-0000-000000000001';
  if not (select pg_get_functiondef('public.student_kiosk_badge(text)'::regprocedure) like '%finance_restriction_active%') then raise exception 'KIOS financial restriction is not enforced at scan boundary'; end if;
  if not (select pg_get_functiondef('public.school_calendar(uuid,text)'::regprocedure) like '%finance_restriction_active%') then raise exception 'exam financial restriction is not enforced at calendar boundary'; end if;
  payment_id:=public.record_finance_payment(charge_id,25,'Cash','CI-SETTLEMENT',null,'2026-09-01 12:00:00-04');
  if not private.finance_restriction_active('fa400000-0000-0000-0000-000000000001','kiosk') then raise exception 'pending payment incorrectly cleared an overdue restriction'; end if;
  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000004',true);
  perform public.review_finance_payment(payment_id,'validated',null);
  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000001',true);
  if private.finance_restriction_active('fa400000-0000-0000-0000-000000000001','kiosk') then raise exception 'fully paid overdue charge kept the restriction active'; end if;
  perform public.save_finance_settings('HTG',false,false,false,false,false);
  adjustment_id:=public.request_finance_adjustment(charge_id,'temporary_clearance',0,'Temporary exam clearance','2026-10-01 00:00:00-04','2026-10-15 23:59:00-04');
  perform public.review_finance_adjustment(adjustment_id,'approved',null);
  workspace:=public.finance_workspace('fa100000-0000-0000-0000-000000000001','fa200000-0000-0000-0000-000000000001');
  raise notice 'Finance fixture summary %, charges %, credits %',workspace->'summary',workspace->'charges',workspace->'credits';
  raise notice 'Finance fixture payments %, credit records %, allocations %',(select coalesce(jsonb_agg(jsonb_build_object('charge_id',p.charge_id,'amount',p.amount,'applied',p.applied_amount,'status',p.status)), '[]'::jsonb) from public.finance_payments p where p.school_id='fa000000-0000-0000-0000-000000000001'),(select coalesce(jsonb_agg(jsonb_build_object('payment',cr.source_payment_id,'amount',cr.amount)), '[]'::jsonb) from public.finance_student_credits cr where cr.school_id='fa000000-0000-0000-0000-000000000001'),(select coalesce(jsonb_agg(jsonb_build_object('charge',a.charge_id,'amount',a.amount)), '[]'::jsonb) from public.finance_credit_allocations a where a.school_id='fa000000-0000-0000-0000-000000000001');
  if (workspace->'summary'->>'expected')::numeric<>535 or (workspace->'summary'->>'paid')::numeric<>420 or (workspace->'summary'->>'balance')::numeric<>115 then raise exception 'finance totals mismatch; got expected %, paid %, balance %', workspace->'summary'->>'expected', workspace->'summary'->>'paid', workspace->'summary'->>'balance'; end if;
  if (workspace->>'can_manage')::boolean is distinct from true or (workspace->>'can_validate')::boolean is distinct from false then raise exception 'director validation must remain disabled unless the school enables it'; end if;
  if workspace::text ilike '%atechos_id%' or workspace::text ilike '%nis%' then raise exception 'finance workspace exposed unnecessary student identity fields'; end if;
  if not exists(select 1 from public.finance_audit_events where school_id='fa000000-0000-0000-0000-000000000001' and actor_id='fa300000-0000-0000-0000-000000000003' and actor_role='secretary' and entity='finance_payments' and action='created') then raise exception 'payment creation audit did not retain secretary identity and role'; end if;
  if not exists(select 1 from public.finance_audit_events where school_id='fa000000-0000-0000-0000-000000000001' and actor_id='fa300000-0000-0000-0000-000000000004' and actor_role='accountant' and entity='finance_payments' and action='updated') then raise exception 'payment validation audit did not retain accountant identity and role'; end if;

  perform public.save_finance_settings('HTG',true,false,false,false,false);
  workspace:=public.finance_workspace('fa100000-0000-0000-0000-000000000001','fa200000-0000-0000-0000-000000000001');
  if (workspace->>'can_validate')::boolean is distinct from true then raise exception 'director validation setting did not grant the configured capability'; end if;

  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000005',true);
  denied:=false;
  begin perform public.finance_workspace(); exception when others then denied:=sqlerrm='not_authorized'; end;
  if not denied then raise exception 'parent accessed internal finance workspace'; end if;
end $$;

rollback;
