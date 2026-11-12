-- Keep the new enum label in its own migration so later migrations can use it after commit.
alter type public.school_role add value if not exists 'preschool_coordinator';
