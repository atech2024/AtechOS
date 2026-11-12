begin;

insert into public.schools(id) values
  ('15000000-0000-0000-0000-000000000001'),
  ('15000000-0000-0000-0000-000000000002');
insert into public.users(id, full_name) values
  ('25000000-0000-0000-0000-000000000001', 'Profile Teacher'),
  ('25000000-0000-0000-0000-000000000002', 'Other Teacher'),
  ('25000000-0000-0000-0000-000000000003', 'Unrelated Parent'),
  ('25000000-0000-0000-0000-000000000004', 'Cross-school Staff');
insert into public.school_members(school_id, user_id, role) values
  ('15000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000001', 'teacher'),
  ('15000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000002', 'director'),
  ('15000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000003', 'parent'),
  ('15000000-0000-0000-0000-000000000002', '25000000-0000-0000-0000-000000000004', 'teacher');
insert into public.staff_private_profiles(
  school_id, user_id, address, phone, identity_document_type, identity_document_number
) values (
  '15000000-0000-0000-0000-000000000001',
  '25000000-0000-0000-0000-000000000002',
  'Private address',
  '555-0199',
  'nif',
  'TEST-NIF'
), (
  '15000000-0000-0000-0000-000000000002',
  '25000000-0000-0000-0000-000000000004',
  'Other school address',
  '555-0198',
  'nif',
  'OTHER-TEST-NIF'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '25000000-0000-0000-0000-000000000001', true);

do $test$
declare v_count integer; v_denied boolean := false; v_rows integer;
begin
  insert into public.staff_private_profiles(
    school_id, user_id, address, phone, date_of_birth, sex, identity_document_type, identity_document_number
  ) values (
    '15000000-0000-0000-0000-000000000001',
    auth.uid(),
    'Teacher private address',
    '555-0101',
    '1990-04-12',
    'female',
    'national_id',
    'TEST-ID-01'
  );

  select count(*) into v_count from public.staff_private_profiles;
  if v_count <> 1 then raise exception 'staff profile select leaked another staff row'; end if;

  update public.staff_private_profiles set address = 'Updated own address'
  where user_id = auth.uid();
  if not found then raise exception 'staff member could not update own profile'; end if;

  v_denied := false;
  begin
    update public.staff_private_profiles
    set date_of_birth = ((now() at time zone 'America/Port-au-Prince')::date + 1)
    where user_id = auth.uid();
  exception when sqlstate '22023' then v_denied := true;
  end;
  if not v_denied then raise exception 'future staff birth date was accepted'; end if;

  update public.staff_private_profiles set address = 'unauthorized'
  where user_id = '25000000-0000-0000-0000-000000000002';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'staff member updated another staff profile'; end if;

  begin
    insert into public.staff_private_profiles(school_id, user_id, phone)
    values ('15000000-0000-0000-0000-000000000001','25000000-0000-0000-0000-000000000002','555-0000');
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'staff member inserted another staff profile'; end if;

  select count(*) into v_count from public.staff_private_profiles
  where school_id = '15000000-0000-0000-0000-000000000002';
  if v_count <> 0 then raise exception 'cross-school staff profile leaked'; end if;
end
$test$;

select set_config('request.jwt.claim.sub', '25000000-0000-0000-0000-000000000003', true);
do $test$
declare v_denied boolean := false;
begin
  begin
    insert into public.staff_private_profiles(school_id, user_id, address)
    values ('15000000-0000-0000-0000-000000000001', auth.uid(), 'Parent must be denied');
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'parent could create a staff profile'; end if;
end
$test$;

reset role;
do $test$
declare v_bucket_public boolean; v_policy_count integer;
begin
  select public into v_bucket_public from storage.buckets where id = 'staff-profile-photos';
  if v_bucket_public is distinct from false then raise exception 'staff photos must use a private bucket'; end if;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname in (
      'staff_profile_photos_read_self',
      'staff_profile_photos_insert_self',
      'staff_profile_photos_update_self',
      'staff_profile_photos_delete_self'
    );
  if v_policy_count <> 4 then raise exception 'staff photo ownership policies are incomplete'; end if;
end
$test$;

rollback;
