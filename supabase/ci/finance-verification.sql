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
declare plan_id uuid; charge_id uuid; future_charge uuid; payment_id uuid; credit_payment_id uuid; second_payment_id uuid; pending_payment_id uuid; refund_id uuid; adjustment_id uuid; generated integer; workspace jsonb; summary jsonb; payment_events jsonb; setup jsonb; ledger jsonb; receipt jsonb; denied boolean; allocated_before numeric; expected_paid numeric; reported_paid numeric; future_installment uuid; class_plan_id uuid; class_charge_id uuid; class_overpayment_id uuid; entry_plan_id uuid; entry_charge_id uuid; entry_installment uuid; second_entry_charge_id uuid; fx_plan_id uuid; fx_charge_id uuid; cross_plan_id uuid; cross_charge_id uuid; cross_payment_id uuid;
begin
  if has_table_privilege('authenticated','public.finance_staff_receipt_signatures','SELECT') then raise exception 'authenticated can read private receipt signature settings directly'; end if;
  if has_table_privilege('authenticated','public.finance_payments','INSERT') or has_table_privilege('authenticated','public.finance_payments','UPDATE') or has_table_privilege('authenticated','public.finance_payments','DELETE') then raise exception 'authenticated can directly mutate finance payments'; end if;
  if has_table_privilege('authenticated','public.finance_payment_refunds','INSERT') or has_table_privilege('authenticated','public.finance_payment_refunds','UPDATE') or has_table_privilege('authenticated','public.finance_payment_refunds','DELETE') then raise exception 'authenticated can directly mutate finance refunds'; end if;
  if has_table_privilege('authenticated','public.finance_audit_events','UPDATE') or has_table_privilege('authenticated','public.finance_audit_events','DELETE') then raise exception 'finance audit events are mutable through the Data API'; end if;
  if has_function_privilege('authenticated','private.finance_method_enabled(uuid,text)','EXECUTE') or has_function_privilege('authenticated','private.finance_payment_htg_limit(uuid,text)','EXECUTE') then raise exception 'authenticated users can probe another school payment configuration'; end if;
  if not (select relrowsecurity from pg_class where oid='public.finance_payments'::regclass) or not (select relrowsecurity from pg_class where oid='public.finance_audit_events'::regclass) then raise exception 'finance RLS is disabled'; end if;

  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000001',true);
  perform public.save_finance_settings('HTG',false,false);
  perform public.save_finance_payment_instructions('Finance MonCash','Finance NatCash','CI bank account','Pay at the school office');
  setup:=public.finance_payment_setup();
  if (setup->>'can_manage')::boolean is distinct from true or exists(select 1 from jsonb_each(setup->'payment_methods') where value->>'enabled'='true') then raise exception 'payment methods must default off and managers must see their setup'; end if;
  perform public.save_finance_payment_methods(jsonb_build_object(
    'moncash',jsonb_build_object('enabled',true,'account_name','Finance CI','phone','50937000001','max_htg',2500),
    'natcash',jsonb_build_object('enabled',true,'account_name','Finance CI','phone','50937000002','max_htg',1800),
    'paypal',jsonb_build_object('enabled',false),'zelle',jsonb_build_object('enabled',false),
    'bank_transfer_htg',jsonb_build_object('enabled',false),'bank_transfer_usd',jsonb_build_object('enabled',false)));
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

  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000001',true);
  perform public.save_finance_payment_methods('{"moncash":{"enabled":true,"account_name":"Finance CI","phone":"50900000000","max_htg":100000},"natcash":{"enabled":true,"account_name":"Finance CI","phone":"50900000001","max_htg":100000}}'::jsonb);
  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000003',true);
  denied:=false;
  begin perform public.save_finance_payment_methods('{}'::jsonb); exception when others then denied:=sqlerrm='not_authorized'; end;
  if not denied then raise exception 'secretary changed digital payment destinations'; end if;
  denied:=false;
  begin perform public.record_finance_payment(charge_id,5,'MonCash',null,null,'2026-09-01 12:00:00-04'); exception when others then denied:=sqlerrm='payment_reference_required'; end;
  if not denied then raise exception 'staff digital payment without a transaction reference was accepted'; end if;
  denied:=false;
  begin perform public.record_finance_payment(charge_id,5,'NatCash','CI-MISSING-PROOF',null,'2026-09-01 12:00:00-04'); exception when others then denied:=sqlerrm='payment_proof_required'; end;
  if not denied then raise exception 'staff digital payment without proof was accepted'; end if;
  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000001',true);
  perform public.save_finance_payment_methods('{}'::jsonb);
  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000003',true);
  payment_id:=public.record_finance_payment(charge_id,50,'Cash','CI-PARTIAL-1',null,'2026-09-01 12:00:00-04');
  denied:=false;
  begin perform public.review_finance_payment(payment_id,'validated',null); exception when others then denied:=sqlerrm='not_authorized'; end;
  if not denied then raise exception 'secretary validated a payment'; end if;
  denied:=false;
  begin perform public.refund_finance_payment(payment_id,1,'Secretary must not refund directly'); exception when others then denied:=sqlerrm='not_authorized'; end;
  if not denied then raise exception 'secretary refunded a payment'; end if;
  class_overpayment_id:=public.record_finance_payment(class_charge_id,11,'Cash','CI-CLASS-OVERPAY',null,'2026-09-01 12:00:00-04');
  if not exists(select 1 from public.finance_payments where id=class_overpayment_id and applied_amount=10 and amount=11) then raise exception 'ordinary class-fee overpayment was not split into applied amount and student credit'; end if;
  credit_payment_id:=public.record_finance_payment(entry_charge_id,45,'Cash','CI-ENTRY-OVERPAY',null,now()-interval '1 day');
  if (select applied_amount from public.finance_payments where id=credit_payment_id)<>25 then raise exception 'entry overpayment was not split into charge payment and student credit'; end if;
  second_payment_id:=public.record_finance_payment(second_entry_charge_id,300,'Cash','CI-UNAPPLIED-CREDIT',null,'2026-09-01 12:00:00-04');
  select id into payment_id from public.finance_payments where reference='CI-PARTIAL-1';

  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000001',true);
  denied:=false;
  begin perform public.review_finance_payment(payment_id,'validated',null); exception when others then denied:=sqlerrm='not_authorized'; end;
  if not denied then raise exception 'director validated a payment without school setting'; end if;

  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000004',true);
  denied:=false;
  begin perform public.review_finance_payment(credit_payment_id,'validated',null); exception when others then denied:=sqlerrm='finance_reviewer_signature_required'; end;
  if not denied then raise exception 'payment validation without an approved receipt signature was accepted'; end if;
  perform public.save_finance_receipt_signature(2::smallint);
  perform public.review_finance_payment(credit_payment_id,'validated',null);
  perform public.review_finance_payment(class_overpayment_id,'validated',null);
  receipt:=public.finance_payment_receipt(class_overpayment_id);
  if receipt->'reviewer'->>'name'<>'Finance Accountant' or receipt->'reviewer'->>'role'<>'accountant' or (receipt->'reviewer'->>'signature_style')::integer<>2 then raise exception 'receipt did not preserve the approving accountant and approved signature'; end if;
  if receipt->'payment'->>'payment_method'<>'Cash' or receipt->'payment'->>'currency_code'<>'HTG' or receipt->'current_installment'->>'remaining' is null then raise exception 'receipt omitted payment details or current installment balance'; end if;
  if not exists(select 1 from public.finance_student_credits cr where cr.source_payment_id=class_overpayment_id and cr.student_id='fa400000-0000-0000-0000-000000000001' and cr.amount=1) then raise exception 'ordinary fee overpayment did not create student-scoped credit'; end if;
  if not exists(select 1 from public.finance_credit_allocations a join public.finance_charges c on c.id=a.charge_id where a.credit_id=(select id from public.finance_student_credits where source_payment_id=class_overpayment_id) and c.student_id='fa400000-0000-0000-0000-000000000001') then raise exception 'ordinary fee credit was not confined to its student'; end if;
  if not exists(select 1 from public.finance_credit_allocations a join public.finance_charges c on c.id=a.charge_id where a.credit_id=(select id from public.finance_student_credits where source_payment_id=credit_payment_id) and c.id=(select fc.id from public.finance_charges fc where fc.fee_plan_id=plan_id order by fc.due_date limit 1) and a.amount=20) then raise exception 'overpayment credit was not automatically applied to the next due charge'; end if;
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
  if (workspace->'summary'->>'expected')::numeric<>535 or (workspace->'summary'->>'paid')::numeric<>431 or (workspace->'summary'->>'balance')::numeric<>104 then raise exception 'finance totals mismatch; got expected %, paid %, balance %', workspace->'summary'->>'expected', workspace->'summary'->>'paid', workspace->'summary'->>'balance'; end if;
  if (workspace->>'can_manage')::boolean is distinct from true or (workspace->>'can_validate')::boolean is distinct from false then raise exception 'director validation must remain disabled unless the school enables it'; end if;
  if workspace::text ilike '%atechos_id%' or workspace::text ilike '%nis%' then raise exception 'finance workspace exposed unnecessary student identity fields'; end if;
  if not exists(select 1 from public.finance_audit_events where school_id='fa000000-0000-0000-0000-000000000001' and actor_id='fa300000-0000-0000-0000-000000000003' and actor_role='secretary' and entity='finance_payments' and action='created') then raise exception 'payment creation audit did not retain secretary identity and role'; end if;
  if not exists(select 1 from public.finance_audit_events where school_id='fa000000-0000-0000-0000-000000000001' and actor_id='fa300000-0000-0000-0000-000000000004' and actor_role='accountant' and entity='finance_payments' and action='updated') then raise exception 'payment validation audit did not retain accountant identity and role'; end if;

  perform public.save_finance_settings('HTG',true,false,false,false,false);
  workspace:=public.finance_workspace('fa100000-0000-0000-0000-000000000001','fa200000-0000-0000-0000-000000000001');
  if (workspace->>'can_validate')::boolean is distinct from true then raise exception 'director validation setting did not grant the configured capability'; end if;

  pending_payment_id:=public.record_finance_payment(entry_charge_id,1,'Cash','CI-PENDING-REFUND',null,'2026-09-01 12:00:00-04');
  denied:=false;
  begin perform public.refund_finance_payment(pending_payment_id,1,'Pending payments cannot be refunded'); exception when others then denied:=sqlerrm='payment_not_refundable'; end;
  if not denied then raise exception 'pending payment was refundable'; end if;
  select coalesce(sum(a.amount),0) into allocated_before from public.finance_credit_allocations a where a.credit_id=(select id from public.finance_student_credits where source_payment_id=credit_payment_id);
  denied:=false;
  begin perform public.refund_finance_payment(payment_id,1,'Payment older than 15 days'); exception when others then denied:=sqlerrm='refund_window_expired'; end;
  if not denied then raise exception 'active student payment outside the 15-day window was refundable'; end if;
  refund_id:=public.refund_finance_payment(credit_payment_id,15,'Partial refund from spent student credit');
  if not exists(select 1 from public.finance_payment_refunds r where r.id=refund_id and r.amount=15 and r.credit_amount=15 and r.applied_amount=0) then raise exception 'partial refund did not ledger the credit portion'; end if;
  ledger:=public.finance_payment_ledger(null,null,null,'CI-ENTRY-OVERPAY',0,50);
  if not exists(select 1 from jsonb_array_elements(ledger->'items') item where item->>'id'=credit_payment_id::text and (item->>'refunded_amount')::numeric=15 and item->>'status'='validated') then raise exception 'partial refund was missing from payment history'; end if;
  if not exists(select 1 from public.finance_student_credits cr where cr.source_payment_id=credit_payment_id and cr.amount=5) then raise exception 'partial refund did not reduce the source credit'; end if;
  if (select coalesce(sum(a.amount),0) from public.finance_credit_allocations a where a.credit_id=(select id from public.finance_student_credits where source_payment_id=credit_payment_id))<>allocated_before-15 then raise exception 'refund did not restore the debt covered by spent credit'; end if;
  refund_id:=public.refund_finance_payment(credit_payment_id,30,'Complete the remaining payment refund');
  if not exists(select 1 from public.finance_payment_refunds r where r.id=refund_id and r.amount=30 and r.credit_amount=5 and r.applied_amount=25) then raise exception 'full refund did not reverse the remaining applied and credit portions'; end if;
  ledger:=public.finance_payment_ledger(null,null,null,'CI-ENTRY-OVERPAY',0,50);
  if not exists(select 1 from jsonb_array_elements(ledger->'items') item where item->>'id'=credit_payment_id::text and (item->>'refunded_amount')::numeric=45 and item->>'status'='validated') then raise exception 'full refund was missing from payment history'; end if;
  if not exists(select 1 from public.finance_payments p where p.id=credit_payment_id and p.amount=45 and p.applied_amount=0) then raise exception 'full refund erased the source receipt or left applied value'; end if;
  if exists(select 1 from public.finance_student_credits cr where cr.source_payment_id=credit_payment_id) or exists(select 1 from public.finance_credit_allocations a where a.credit_id=(select id from public.finance_student_credits where source_payment_id=credit_payment_id)) then raise exception 'fully refunded credit still has a balance or allocation'; end if;
  denied:=false;
  begin perform public.refund_finance_payment(credit_payment_id,0.01,'Refund beyond the original receipt'); exception when others then denied:=sqlerrm='refund_exceeds_remaining'; end;
  if not denied then raise exception 'refund exceeded the original receipt value'; end if;
  if not exists(select 1 from public.finance_audit_events where school_id='fa000000-0000-0000-0000-000000000001' and entity='finance_payment_refunds' and action='created') then raise exception 'refund did not create an audit event'; end if;
  if not exists(select 1 from public.finance_audit_events where school_id='fa000000-0000-0000-0000-000000000001' and actor_id='fa300000-0000-0000-0000-000000000001' and actor_role='director' and entity='finance_payment_refunds' and action='created') then raise exception 'refund audit did not retain the approving actor role'; end if;

  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000001',true);
  perform public.save_finance_settings('USD',false,false,false,false,false);
  fx_plan_id:=public.create_finance_fee_plan('fa100000-0000-0000-0000-000000000001','fa200000-0000-0000-0000-000000000001','class_fee','USD CI fee','[{"amount":100,"due_date":"2026-09-01"}]'::jsonb);
  if public.issue_finance_fee_plan(fx_plan_id)<>1 then raise exception 'USD test charge was not generated'; end if;
  select id into fx_charge_id from public.finance_charges where fee_plan_id=fx_plan_id;
  denied:=false;
  begin perform public.record_finance_payment(fx_charge_id,20,'Cash','CI-USD-NO-RATE',null,now()); exception when others then denied:=sqlerrm='brh_rate_unavailable'; end;
  if not denied then raise exception 'USD payment was recorded without a current BRH reference rate'; end if;
  perform set_config('request.jwt.claim.role','service_role',true);
  perform public.record_brh_reference_rate((now() at time zone 'America/Port-au-Prince')::date,130.5583,'https://www.brh.ht/taux-du-jour/');
  perform set_config('request.jwt.claim.role','authenticated',true);
  payment_id:=public.record_finance_payment(fx_charge_id,20,'Cash','CI-USD-BRH-SNAPSHOT',null,now());
  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000004',true);
  perform public.review_finance_payment(payment_id,'validated',null);
  if not exists(select 1 from public.finance_payments where id=payment_id and exchange_rate_snapshot=130.5583 and exchange_rate_effective_date=(now() at time zone 'America/Port-au-Prince')::date and exchange_rate_source_url='https://www.brh.ht/taux-du-jour/') then raise exception 'USD validation did not save its BRH rate, date and official source'; end if;
  ledger:=public.finance_payment_ledger(null,null,null,'CI-USD-BRH-SNAPSHOT',0,50);
  if not exists(select 1 from jsonb_array_elements(ledger->'items') item where item->>'id'=payment_id::text and item->>'exchange_rate_snapshot'='130.558300' and item->>'exchange_rate_effective_date'=(now() at time zone 'America/Port-au-Prince')::date::text) then raise exception 'staff payment history omitted its immutable BRH snapshot'; end if;
  denied:=false;
  begin update public.finance_payments set exchange_rate_snapshot=130.5584 where id=payment_id; exception when others then denied:=sqlerrm='finance_payment_fx_snapshot_is_immutable'; end;
  if not denied then raise exception 'validated payment BRH snapshot was mutable'; end if;
  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000001',true);
  perform public.save_finance_settings('HTG',false,false,false,false,false);

  if has_table_privilege('authenticated','public.finance_payments','INSERT') or has_table_privilege('authenticated','public.finance_payments','UPDATE') then raise exception 'parent can directly mutate finance payments'; end if;
  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000005',true);
  denied:=false;
  begin perform public.finance_workspace(); exception when others then denied:=sqlerrm='not_authorized'; end;
  if not denied then raise exception 'parent accessed internal finance workspace'; end if;
  workspace:=public.family_finance_workspace('fa400000-0000-0000-0000-000000000001');
  if workspace->'student'->>'id'<>'fa400000-0000-0000-0000-000000000001' or workspace->'settings'->>'moncash_payment_instructions'<>'Finance MonCash' or workspace->'settings'->'payment_methods'->'moncash'->>'phone'<>'50937000001' then raise exception 'linked parent finance details or enabled payment destinations were not returned'; end if;
  if not exists(select 1 from jsonb_array_elements(workspace->'payments') item where item->>'id'=class_overpayment_id::text and item->>'reviewer_name'='Finance Accountant') then raise exception 'parent workspace omitted a validated receipt or its approver'; end if;
  receipt:=public.finance_payment_receipt(class_overpayment_id);
  if receipt->'student'->>'first_name'<>'Finance' then raise exception 'linked parent could not read the linked student receipt'; end if;
  denied:=false;
  begin perform public.finance_payment_receipt(second_payment_id); exception when others then denied:=sqlerrm='not_authorized'; end;
  if not denied then raise exception 'parent read a receipt for an unrelated student'; end if;
  if not has_function_privilege('authenticated','public.finance_payment_receipt(uuid)','EXECUTE') or has_function_privilege('anon','public.finance_payment_receipt(uuid)','EXECUTE') then raise exception 'receipt RPC grants are unsafe'; end if;
  payment_events:=public.family_validated_payment_events('fa400000-0000-0000-0000-000000000001','2026-09-01','2026-09-30');
  if not exists(select 1 from jsonb_array_elements(payment_events->'payments') item where item->>'id'=class_overpayment_id::text) then
    raise exception 'linked parent timeline omitted a validated staff-recorded payment';
  end if;
  if exists(select 1 from jsonb_array_elements(payment_events->'payments') item where item->>'id' in (credit_payment_id::text,pending_payment_id::text)) then
    raise exception 'linked parent timeline showed a fully refunded or pending payment as paid';
  end if;
  if not has_function_privilege('authenticated','public.family_validated_payment_events(uuid,date,date)','EXECUTE')
    or has_function_privilege('anon','public.family_validated_payment_events(uuid,date,date)','EXECUTE') then
    raise exception 'family payment timeline grants are unsafe';
  end if;
  denied:=false;
  begin perform public.family_validated_payment_events('fa400000-0000-0000-0000-000000000002','2026-09-01','2026-09-30');
  exception when others then denied:=sqlerrm='not_authorized'; end;
  if not denied then raise exception 'linked parent timeline exposed an unrelated child'; end if;
  denied:=false;
  begin perform public.family_validated_payment_events('fa400000-0000-0000-0000-000000000001','2026-01-01','2027-12-31');
  exception when others then denied:=sqlerrm='invalid_payment_date_range'; end;
  if not denied then raise exception 'family payment timeline accepted an unbounded date range'; end if;
  summary:=public.family_finance_summary('fa400000-0000-0000-0000-000000000001');
  if not exists(select 1 from jsonb_array_elements(summary->'charges') item where item->>'description'='Rentrée 2026 — 2' and item->>'due_date'='2027-01-15' and item->>'status'='upcoming') then raise exception 'family summary omitted an upcoming installment'; end if;
  select coalesce(sum(p.applied_amount),0)+coalesce((select sum(a.amount) from public.finance_credit_allocations a join public.finance_charges c on c.id=a.charge_id where c.student_id='fa400000-0000-0000-0000-000000000001'),0) into expected_paid
   from public.finance_payments p join public.finance_charges c on c.id=p.charge_id where c.student_id='fa400000-0000-0000-0000-000000000001' and c.currency_code='HTG' and p.status='validated';
  select coalesce(sum((item->>'paid_amount')::numeric),0) into reported_paid from jsonb_array_elements(summary->'totals') item where item->>'currency_code'='HTG';
  if reported_paid<>expected_paid then raise exception 'family paid totals omitted staff-entered or applied-credit settlements'; end if;
  if not has_function_privilege('authenticated','public.family_finance_summary(uuid)','EXECUTE') or has_function_privilege('anon','public.family_finance_summary(uuid)','EXECUTE') then raise exception 'family finance summary grants are unsafe'; end if;
  denied:=false;
  begin perform public.family_finance_workspace('fa400000-0000-0000-0000-000000000002'); exception when others then denied:=sqlerrm='not_authorized'; end;
  if not denied then raise exception 'parent accessed an unrelated student finance workspace'; end if;
  denied:=false; begin perform public.family_finance_summary('fa400000-0000-0000-0000-000000000002'); exception when others then denied:=sqlerrm='not_authorized'; end;
  if not denied then raise exception 'parent accessed an unrelated student finance summary'; end if;
  denied:=false;
  begin perform public.submit_family_finance_payment(entry_charge_id,5,'Cash','CI-PARENT-CASH',''); exception when others then denied:=sqlerrm='invalid_payment_method'; end;
  if not denied then raise exception 'parent submitted a non-digital payment method'; end if;
  denied:=false;
  begin perform public.submit_family_finance_payment(entry_charge_id,5,'PayPal','CI-PARENT-DISABLED',''); exception when others then denied:=sqlerrm='payment_method_disabled'; end;
  if not denied then raise exception 'parent submitted a disabled payment method'; end if;
  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000001',true);
  perform public.save_finance_payment_methods(jsonb_build_object(
    'moncash',jsonb_build_object('enabled',true,'account_name','Finance CI','phone','50937000001','max_htg',2500),
    'natcash',jsonb_build_object('enabled',true,'account_name','Finance CI','phone','50937000002','max_htg',1800),
    'paypal',jsonb_build_object('enabled',true,'account_name','Finance CI','email','finance-ci@example.test'),
    'zelle',jsonb_build_object('enabled',true,'account_name','Finance CI','email','finance-ci@example.test'),
    'bank_transfer_htg',jsonb_build_object('enabled',true,'bank_name','CI HTG Bank','account_name','Finance CI','account_number','HTG-001'),
    'bank_transfer_usd',jsonb_build_object('enabled',true,'bank_name','CI USD Bank','account_name','Finance CI','account_number','USD-001')));
  cross_plan_id:=public.create_finance_fee_plan('fa100000-0000-0000-0000-000000000001','fa200000-0000-0000-0000-000000000001','class_fee','HTG fee paid in USD','[{"amount":2000,"due_date":"2026-09-01"}]'::jsonb);
  if public.issue_finance_fee_plan(cross_plan_id)<>1 then raise exception 'USD-to-HTG test charge was not generated'; end if;
  select id into cross_charge_id from public.finance_charges where fee_plan_id=cross_plan_id;
  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000005',true);
  insert into storage.objects(bucket_id,name,owner_id,metadata)
  values('finance-proofs','fa000000-0000-0000-0000-000000000001/fa300000-0000-0000-0000-000000000005/fa400000-0000-0000-0000-000000000001/parent-proof.pdf','fa300000-0000-0000-0000-000000000005','{}'::jsonb);
  payment_id:=public.submit_family_finance_payment(entry_charge_id,10,'MonCash','CI-PARENT-MONCASH','fa000000-0000-0000-0000-000000000001/fa300000-0000-0000-0000-000000000005/fa400000-0000-0000-0000-000000000001/parent-proof.pdf');
  if not exists(select 1 from public.finance_payments p where p.id=payment_id and p.status='pending' and p.recorded_by='fa300000-0000-0000-0000-000000000005' and p.reference='CI-PARENT-MONCASH' and p.proof_storage_path is not null) then raise exception 'parent digital payment was not submitted for school approval with proof'; end if;
  workspace:=public.family_finance_workspace('fa400000-0000-0000-0000-000000000001');
  if not exists(select 1 from jsonb_array_elements(workspace->'payments') p where p->>'id'=payment_id::text and p->>'status'='pending') then raise exception 'parent did not see their own pending payment request'; end if;
  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000004',true);
  perform public.review_finance_payment(payment_id,'validated',null);
  if not exists(select 1 from public.finance_payments p where p.id=payment_id and p.status='validated') then raise exception 'authorized staff did not validate the parent proof submission'; end if;
  if not exists(select 1 from public.finance_audit_events where school_id='fa000000-0000-0000-0000-000000000001' and actor_id='fa300000-0000-0000-0000-000000000004' and actor_role='accountant' and entity='finance_payments' and action='updated') then raise exception 'parent proof approval did not record the authorized staff audit actor'; end if;
  if not exists(select 1 from public.notifications n where n.school_id='fa000000-0000-0000-0000-000000000001' and n.recipient_id='fa300000-0000-0000-0000-000000000005' and n.event_key='finance-payment-validated:'||payment_id::text) then raise exception 'parent was not notified after proof validation'; end if;
  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000005',true);
  workspace:=public.family_finance_workspace('fa400000-0000-0000-0000-000000000001');
  if not exists(select 1 from jsonb_array_elements(workspace->'payments') p where p->>'id'=payment_id::text and p->>'status'='validated') then raise exception 'parent portal did not show its validated proof payment'; end if;
  cross_payment_id:=public.submit_family_finance_payment(cross_charge_id,10,'PayPal','CI-PARENT-USD-TO-HTG','fa000000-0000-0000-0000-000000000001/fa300000-0000-0000-0000-000000000005/fa400000-0000-0000-0000-000000000001/parent-proof.pdf');
  if not exists(select 1 from public.finance_payments p where p.id=cross_payment_id and p.status='pending' and p.amount=10 and p.currency_code='USD' and p.applied_currency_code='HTG' and p.applied_amount=1305.58) then raise exception 'parent USD tender was not reserved against its HTG fee using the BRH rate'; end if;
  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000004',true);
  perform public.review_finance_payment(cross_payment_id,'validated',null);
  if not exists(select 1 from public.finance_payments p where p.id=cross_payment_id and p.status='validated' and p.applied_amount=1305.58 and p.exchange_rate_snapshot=130.5583 and p.applied_currency_code='HTG') then raise exception 'USD parent payment did not settle the HTG charge using its validation snapshot'; end if;
  refund_id:=public.refund_finance_payment(cross_payment_id,2,'Partial USD refund for HTG fee');
  if not exists(select 1 from public.finance_payment_refunds r where r.id=refund_id and r.amount=2 and r.applied_amount=261.12 and r.credit_amount=0) then raise exception 'USD refund was not converted into the HTG fee currency'; end if;
  if not exists(select 1 from public.finance_payments p where p.id=cross_payment_id and p.applied_amount=1044.46) then raise exception 'USD refund did not restore the converted HTG balance'; end if;
end $$;


-- An old payment remains blocked for an active student, then becomes eligible
-- only after Direction records the student's official school departure.
do $$
declare departure_charge_id uuid; departure_payment_id uuid; departure_view jsonb; denied boolean;
begin
  insert into public.students(id,school_id,first_name,last_name,atechos_id,active,school_status)
  values('fa400000-0000-0000-0000-000000000003','fa000000-0000-0000-0000-000000000001','Departure','Student','AOS-FINANCE-DEPARTURE-CI',true,'active');
  insert into public.finance_charges(school_id,student_id,academic_year_id,class_id,fee_plan_id,fee_installment_id,description,amount,currency_code,due_date,created_by)
  select school_id,'fa400000-0000-0000-0000-000000000003',academic_year_id,class_id,fee_plan_id,fee_installment_id,'Departure CI fee',amount,currency_code,due_date,created_by
  from public.finance_charges where id=(select id from public.finance_charges where student_id='fa400000-0000-0000-0000-000000000001' order by created_at limit 1)
  returning id into departure_charge_id;
  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000001',true);
  departure_payment_id:=public.record_finance_payment(departure_charge_id,20,'Cash','CI-DEPARTURE-OLD-PAYMENT',null,now()-interval '20 days');
  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000004',true);
  perform public.review_finance_payment(departure_payment_id,'validated',null);
  denied:=false;
  begin perform public.refund_finance_payment(departure_payment_id,5,'Expired refund period'); exception when others then denied:=sqlerrm='refund_window_expired'; end;
  if not denied then raise exception 'old active-student refund was not blocked'; end if;
  departure_view:=public.finance_departure_refund_workspace(null,'fa400000-0000-0000-0000-000000000003');
  if departure_view->'student'->>'school_status'<>'active'
    or (departure_view->'totals'->0->>'paid_amount')::numeric<>20
    or (departure_view->'payments'->0->>'refunded_amount')::numeric<>0
    or (departure_view->'payments'->0->>'refund_allowed')::boolean then
    raise exception 'departure finance summary omitted active status or paid/refunded totals';
  end if;
  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000005',true);
  denied:=false;
  begin perform public.finance_departure_refund_workspace(null,'fa400000-0000-0000-0000-000000000003'); exception when others then denied:=sqlerrm='not_authorized'; end;
  if not denied then raise exception 'parent accessed finance departure/refund workspace'; end if;
  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000001',true);
  update public.students set school_status='departed',departure_year_id='fa100000-0000-0000-0000-000000000001'
  where id='fa400000-0000-0000-0000-000000000003';
  departure_view:=public.finance_departure_refund_workspace(null,'fa400000-0000-0000-0000-000000000003');
  if departure_view->'student'->>'school_status'<>'departed'
    or not (departure_view->'payments'->0->>'refund_allowed')::boolean then
    raise exception 'official school departure did not unlock the refund exception';
  end if;
  perform set_config('request.jwt.claim.sub','fa300000-0000-0000-0000-000000000004',true);
  if public.refund_finance_payment(departure_payment_id,5,'Approved school departure refund') is null then raise exception 'school-departure refund was not recorded'; end if;
  departure_view:=public.finance_departure_refund_workspace(null,'fa400000-0000-0000-0000-000000000003');
  if (departure_view->'totals'->0->>'refunded_amount')::numeric<>5
    or (departure_view->'totals'->0->>'remaining_amount')::numeric<>15 then
    raise exception 'departure summary did not refresh paid/refunded totals';
  end if;
end $$;

rollback;


