-- Helper routines are implementation details; callers must use the role-gated business RPCs.
revoke all on function public.urania_require_role(text[]) from public, anon, authenticated;
revoke all on function public.urania_role_from_jwt() from public, anon, authenticated;
