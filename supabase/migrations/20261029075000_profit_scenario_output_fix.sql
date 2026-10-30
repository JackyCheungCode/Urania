create or replace function research.normalize_profit_scenario_output()
returns trigger
language plpgsql
set search_path = pg_catalog, research
as $$
begin
  if new.scenario_type='b2c' then
    new.output_values:=jsonb_set(new.output_values,'{break_even_units}','null'::jsonb,true);
  end if;
  return new;
end;
$$;
drop trigger if exists normalize_profit_scenario_output on research.profit_scenarios;
create trigger normalize_profit_scenario_output before insert or update on research.profit_scenarios
for each row execute function research.normalize_profit_scenario_output();
revoke all on function research.normalize_profit_scenario_output() from public,anon,authenticated;
