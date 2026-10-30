-- Add only missing indexes that cover the leading columns of app-schema foreign keys.
do $$
declare fk record;
declare index_name text;
declare column_list text;
begin
  for fk in
    select con.oid as constraint_oid, con.conrelid as table_oid, n.nspname as schema_name,
           c.relname as table_name, con.conname as constraint_name,
           array_agg(a.attname order by k.ord) as column_names,
           array_agg(k.attnum::smallint order by k.ord) as column_numbers
    from pg_constraint con
    join pg_class c on c.oid=con.conrelid
    join pg_namespace n on n.oid=c.relnamespace
    cross join lateral unnest(con.conkey) with ordinality as k(attnum,ord)
    join pg_attribute a on a.attrelid=con.conrelid and a.attnum=k.attnum
    where con.contype='f' and n.nspname in ('research','crm','integrations','automation','audit')
    group by con.oid,con.conrelid,n.nspname,c.relname,con.conname
  loop
    if not exists (
      select 1
      from pg_index i
      where i.indrelid=fk.table_oid and i.indisvalid
        and (
          select array_agg(x.attnum::smallint order by x.ord)
          from unnest(i.indkey::smallint[]) with ordinality as x(attnum,ord)
          where x.ord <= cardinality(fk.column_numbers) and x.ord <= i.indnkeyatts
        ) = fk.column_numbers
    ) then
      index_name:=left('idx_'||fk.table_name||'_'||array_to_string(fk.column_names,'_')||'_fk',63);
      select string_agg(format('%I',col),',') into column_list from unnest(fk.column_names) as t(col);
      execute format('create index if not exists %I on %I.%I (%s)',index_name,fk.schema_name,fk.table_name,column_list);
    end if;
  end loop;
end $$;
