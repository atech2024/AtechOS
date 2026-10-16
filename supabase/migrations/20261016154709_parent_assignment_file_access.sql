-- Allow a parent to prepare a signed URL only for current assignments
-- belonging to a class in which one of their active children is enrolled.
-- The existing class-read policy remains responsible for staff access.
create or replace function private.parent_can_read_assignment_file(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.assignments a
    join public.classes c
      on c.id = a.class_id
     and c.school_id = a.school_id
    join public.academic_years y
      on y.id = c.academic_year_id
     and y.school_id = a.school_id
     and y.is_current
    join public.enrollments e
      on e.class_id = a.class_id
     and e.school_id = a.school_id
     and e.status = 'active'
    join public.students s
      on s.id = e.student_id
     and s.school_id = a.school_id
     and s.active
     and s.school_status = 'active'
    join public.student_parents sp
      on sp.student_id = s.id
    join public.parents p
      on p.id = sp.parent_id
     and p.school_id = s.school_id
     and p.user_id = auth.uid()
    join public.school_members m
      on m.school_id = p.school_id
     and m.user_id = p.user_id
     and m.enabled
     and m.role = 'parent'
    where a.attachment_url = p_object_name
  );
$$;

revoke all on function private.parent_can_read_assignment_file(text) from public, anon;
grant execute on function private.parent_can_read_assignment_file(text) to authenticated;

drop policy if exists assignment_files_parent_linked_read on storage.objects;
create policy assignment_files_parent_linked_read
on storage.objects for select to authenticated
using (
  bucket_id = 'assignment-files'
  and private.parent_can_read_assignment_file(name)
);

