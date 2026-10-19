-- Remove default PUBLIC/anonymous execution from the linked-parent Preschool bulletin RPC.
-- The function retains its internal parent membership and linked-child checks.
revoke all on function public.family_preschool_bulletins() from public, anon;
grant execute on function public.family_preschool_bulletins() to authenticated;
