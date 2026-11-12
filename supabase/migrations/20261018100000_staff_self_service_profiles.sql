create table public.staff_private_profiles (
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  address text,
  phone text,
  date_of_birth date,
  sex text check (sex is null or sex in ('female', 'male', 'unspecified')),
  identity_document_type text check (identity_document_type is null or identity_document_type in ('national_id', 'nif')),
  identity_document_number text,
  profile_photo_path text,
  updated_at timestamptz not null default now(),
  primary key (school_id, user_id),
  check (address is null or length(btrim(address)) between 1 and 500),
  check (phone is null or length(btrim(phone)) between 3 and 40),
  check (identity_document_number is null or length(btrim(identity_document_number)) between 1 and 100),
  check ((identity_document_type is null) = (identity_document_number is null)),
  check (
    profile_photo_path is null
    or profile_photo_path like school_id::text || '/' || user_id::text || '/profile/%'
  )
);

alter table public.staff_private_profiles enable row level security;
revoke all on public.staff_private_profiles from public, anon, authenticated;
grant select, insert, update on public.staff_private_profiles to authenticated;

create policy staff_private_profiles_read_self
on public.staff_private_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  and school_id = (select public.get_my_school_id())
  and exists (
    select 1 from public.school_members m
    where m.school_id = staff_private_profiles.school_id
      and m.user_id = (select auth.uid())
      and m.enabled
      and m.role::text = any(array['school_admin','director','secretary','censeur','teacher','accountant','surveillant'])
  )
);

create policy staff_private_profiles_insert_self
on public.staff_private_profiles for insert to authenticated
with check (
  user_id = (select auth.uid())
  and school_id = (select public.get_my_school_id())
  and exists (
    select 1 from public.school_members m
    where m.school_id = staff_private_profiles.school_id
      and m.user_id = (select auth.uid())
      and m.enabled
      and m.role::text = any(array['school_admin','director','secretary','censeur','teacher','accountant','surveillant'])
  )
);

create policy staff_private_profiles_update_self
on public.staff_private_profiles for update to authenticated
using (
  user_id = (select auth.uid())
  and school_id = (select public.get_my_school_id())
  and exists (
    select 1 from public.school_members m
    where m.school_id = staff_private_profiles.school_id
      and m.user_id = (select auth.uid())
      and m.enabled
      and m.role::text = any(array['school_admin','director','secretary','censeur','teacher','accountant','surveillant'])
  )
)
with check (
  user_id = (select auth.uid())
  and school_id = (select public.get_my_school_id())
  and exists (
    select 1 from public.school_members m
    where m.school_id = staff_private_profiles.school_id
      and m.user_id = (select auth.uid())
      and m.enabled
      and m.role::text = any(array['school_admin','director','secretary','censeur','teacher','accountant','surveillant'])
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff-profile-photos',
  'staff-profile-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy staff_profile_photos_read_self
on storage.objects for select to authenticated
using (
  bucket_id = 'staff-profile-photos'
  and (storage.foldername(name))[1] = (select public.get_my_school_id())::text
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (storage.foldername(name))[3] = 'profile'
  and exists (
    select 1 from public.school_members m
    where m.school_id = (select public.get_my_school_id())
      and m.user_id = (select auth.uid())
      and m.enabled
      and m.role::text = any(array['school_admin','director','secretary','censeur','teacher','accountant','surveillant'])
  )
);

create policy staff_profile_photos_insert_self
on storage.objects for insert to authenticated
with check (
  bucket_id = 'staff-profile-photos'
  and (storage.foldername(name))[1] = (select public.get_my_school_id())::text
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (storage.foldername(name))[3] = 'profile'
  and exists (
    select 1 from public.school_members m
    where m.school_id = (select public.get_my_school_id())
      and m.user_id = (select auth.uid())
      and m.enabled
      and m.role::text = any(array['school_admin','director','secretary','censeur','teacher','accountant','surveillant'])
  )
);

create policy staff_profile_photos_update_self
on storage.objects for update to authenticated
using (
  bucket_id = 'staff-profile-photos'
  and (storage.foldername(name))[1] = (select public.get_my_school_id())::text
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (storage.foldername(name))[3] = 'profile'
  and exists (
    select 1 from public.school_members m
    where m.school_id = (select public.get_my_school_id())
      and m.user_id = (select auth.uid())
      and m.enabled
      and m.role::text = any(array['school_admin','director','secretary','censeur','teacher','accountant','surveillant'])
  )
)
with check (
  bucket_id = 'staff-profile-photos'
  and (storage.foldername(name))[1] = (select public.get_my_school_id())::text
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (storage.foldername(name))[3] = 'profile'
  and exists (
    select 1 from public.school_members m
    where m.school_id = (select public.get_my_school_id())
      and m.user_id = (select auth.uid())
      and m.enabled
      and m.role::text = any(array['school_admin','director','secretary','censeur','teacher','accountant','surveillant'])
  )
);

create policy staff_profile_photos_delete_self
on storage.objects for delete to authenticated
using (
  bucket_id = 'staff-profile-photos'
  and (storage.foldername(name))[1] = (select public.get_my_school_id())::text
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (storage.foldername(name))[3] = 'profile'
  and exists (
    select 1 from public.school_members m
    where m.school_id = (select public.get_my_school_id())
      and m.user_id = (select auth.uid())
      and m.enabled
      and m.role::text = any(array['school_admin','director','secretary','censeur','teacher','accountant','surveillant'])
  )
);

create or replace function public.validate_staff_private_profile()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.date_of_birth is not null
     and new.date_of_birth > (now() at time zone 'America/Port-au-Prince')::date then
    raise exception 'staff_birth_date_in_future' using errcode = '22023';
  end if;
  return new;
end;
$function$;

revoke all on function public.validate_staff_private_profile() from public, anon, authenticated;

create trigger staff_private_profiles_validate
before insert or update on public.staff_private_profiles
for each row execute function public.validate_staff_private_profile();
