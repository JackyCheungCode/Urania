-- Wrap JWT helper calls in scalar subqueries so PostgreSQL can evaluate them once per statement.
do $$
declare p record;
declare qual_text text;
declare check_text text;
declare create_sql text;
begin
  for p in
    select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
    from pg_policies
    where schemaname in ('research','crm','integrations','automation','audit')
      and (coalesce(qual,'') like '%urania_role_from_jwt()%' or coalesce(with_check,'') like '%urania_role_from_jwt()%' or coalesce(qual,'') like '%auth.uid()%' or coalesce(with_check,'') like '%auth.uid()%')
  loop
    qual_text:=p.qual;
    check_text:=p.with_check;
    if qual_text is not null then
      qual_text:=replace(qual_text,'public.urania_role_from_jwt()','__URANIA_ROLE_FN__()');
      qual_text:=replace(qual_text,'urania_role_from_jwt()','(select public.urania_role_from_jwt())');
      qual_text:=replace(qual_text,'__URANIA_ROLE_FN__()','(select public.urania_role_from_jwt())');
      qual_text:=replace(qual_text,'auth.uid()','(select auth.uid())');
    end if;
    if check_text is not null then
      check_text:=replace(check_text,'public.urania_role_from_jwt()','__URANIA_ROLE_FN__()');
      check_text:=replace(check_text,'urania_role_from_jwt()','(select public.urania_role_from_jwt())');
      check_text:=replace(check_text,'__URANIA_ROLE_FN__()','(select public.urania_role_from_jwt())');
      check_text:=replace(check_text,'auth.uid()','(select auth.uid())');
    end if;
    execute format('drop policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);
    create_sql:=format('create policy %I on %I.%I as %s for %s to %s',
      p.policyname,p.schemaname,p.tablename,p.permissive,p.cmd,array_to_string(p.roles,', '));
    if qual_text is not null then create_sql:=create_sql||format(' using (%s)',qual_text); end if;
    if check_text is not null then create_sql:=create_sql||format(' with check (%s)',check_text); end if;
    execute create_sql;
  end loop;
end $$;
