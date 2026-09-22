create index if not exists schools_owner_user_idx on public.schools(owner_user_id);
create index if not exists users_active_school_idx on public.users(active_school_id);
create index if not exists school_invitations_student_idx on public.school_invitations(student_id);
create index if not exists school_invitations_parent_idx on public.school_invitations(parent_id);
create index if not exists school_invitations_invited_by_idx on public.school_invitations(invited_by);
create index if not exists school_invitations_accepted_by_idx on public.school_invitations(accepted_by);

