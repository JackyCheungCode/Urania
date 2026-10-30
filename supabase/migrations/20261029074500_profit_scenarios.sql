create table if not exists research.profit_scenarios (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references research.products(id) on delete set null,
  scenario_type text not null check (scenario_type in ('b2c','b2b')),
  currency char(3) not null,
  input_values jsonb not null,
  output_values jsonb not null,
  assumptions text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists profit_scenarios_product_time_idx on research.profit_scenarios(product_id,created_at desc);
alter table research.profit_scenarios enable row level security;
grant select,insert,update,delete on research.profit_scenarios to authenticated;
drop policy if exists profit_scenarios_read on research.profit_scenarios;
create policy profit_scenarios_read on research.profit_scenarios for select to authenticated using (public.urania_role_from_jwt() in ('admin','researcher','sales'));
drop policy if exists profit_scenarios_insert on research.profit_scenarios;
create policy profit_scenarios_insert on research.profit_scenarios for insert to authenticated with check (public.urania_role_from_jwt() in ('admin','researcher','sales') and created_by=auth.uid());
drop policy if exists profit_scenarios_update on research.profit_scenarios;
create policy profit_scenarios_update on research.profit_scenarios for update to authenticated using (public.urania_role_from_jwt()='admin' or created_by=auth.uid()) with check (public.urania_role_from_jwt()='admin' or created_by=auth.uid());
drop policy if exists profit_scenarios_delete on research.profit_scenarios;
create policy profit_scenarios_delete on research.profit_scenarios for delete to authenticated using (public.urania_role_from_jwt()='admin');

create or replace function public.urania_create_profit_scenario(
  p_scenario_type text,
  p_currency text,
  p_inputs jsonb,
  p_product_id uuid default null,
  p_assumptions text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, auth, research, audit
as $$
declare actor uuid;
declare unit_price numeric;
declare quantity numeric;
declare sourcing numeric;
declare freight numeric;
declare duties numeric;
declare fulfillment numeric;
declare packaging numeric;
declare inspection numeric;
declare setup_cost numeric;
declare other_costs numeric;
declare platform_pct numeric;
declare ad_pct numeric;
declare returns_pct numeric;
declare fx_pct numeric;
declare revenue numeric;
declare total_costs numeric;
declare profit numeric;
declare margin_pct numeric;
declare break_even numeric;
declare outputs jsonb;
declare created research.profit_scenarios%rowtype;
begin
  actor := public.urania_require_role(array['admin','researcher','sales']);
  if p_scenario_type not in ('b2c','b2b') then raise exception 'scenario_type must be b2c or b2b' using errcode='22023'; end if;
  if p_currency is null or p_currency !~ '^[A-Za-z]{3}$' then raise exception 'currency must be ISO alpha-3' using errcode='22023'; end if;
  if p_inputs is null or jsonb_typeof(p_inputs)<>'object' then raise exception 'inputs must be a JSON object' using errcode='22023'; end if;
  if p_assumptions is not null and length(p_assumptions)>4000 then raise exception 'assumptions too long' using errcode='22023'; end if;
  if p_product_id is not null and not exists(select 1 from research.products where id=p_product_id and deleted_at is null) then raise exception 'product not found' using errcode='22023'; end if;

  unit_price:=coalesce(nullif(p_inputs->>'unit_price','')::numeric,0);
  sourcing:=coalesce(nullif(p_inputs->>'sourcing_cost','')::numeric,0);
  other_costs:=coalesce(nullif(p_inputs->>'other_costs','')::numeric,0);

  if p_scenario_type='b2c' then
    freight:=coalesce(nullif(p_inputs->>'freight','')::numeric,0);
    duties:=coalesce(nullif(p_inputs->>'duties','')::numeric,0);
    fulfillment:=coalesce(nullif(p_inputs->>'fulfillment','')::numeric,0);
    platform_pct:=coalesce(nullif(p_inputs->>'platform_fee_pct','')::numeric,0);
    ad_pct:=coalesce(nullif(p_inputs->>'ad_cost_pct','')::numeric,0);
    returns_pct:=coalesce(nullif(p_inputs->>'expected_returns_pct','')::numeric,0);
    if unit_price<=0 or sourcing<0 or other_costs<0 or freight<0 or duties<0 or fulfillment<0 or platform_pct<0 or platform_pct>100 or ad_pct<0 or ad_pct>100 or returns_pct<0 or returns_pct>100 then
      raise exception 'invalid B2C scenario inputs' using errcode='22023';
    end if;
    revenue:=unit_price;
    total_costs:=sourcing+freight+duties+fulfillment+other_costs+(unit_price*platform_pct/100)+(unit_price*ad_pct/100)+(unit_price*returns_pct/100);
    profit:=revenue-total_costs;
    margin_pct:=case when revenue>0 then round(profit/revenue*100,4) else null end;
    outputs:=jsonb_build_object('revenue_per_unit',round(revenue,4),'total_costs_per_unit',round(total_costs,4),'contribution_profit_per_unit',round(profit,4),'contribution_margin_pct',margin_pct,'platform_fee',round(unit_price*platform_pct/100,4),'ad_cost',round(unit_price*ad_pct/100,4),'expected_returns_loss',round(unit_price*returns_pct/100,4),'break_even_units',case when profit>0 then 0 else null end);
  else
    quantity:=coalesce(nullif(p_inputs->>'quantity','')::numeric,0);
    freight:=coalesce(nullif(p_inputs->>'freight_per_unit','')::numeric,0);
    duties:=coalesce(nullif(p_inputs->>'duties_per_unit','')::numeric,0);
    packaging:=coalesce(nullif(p_inputs->>'packaging_per_unit','')::numeric,0);
    inspection:=coalesce(nullif(p_inputs->>'inspection_total','')::numeric,0);
    setup_cost:=coalesce(nullif(p_inputs->>'setup_cost','')::numeric,0);
    fx_pct:=coalesce(nullif(p_inputs->>'fx_reserve_pct','')::numeric,0);
    if unit_price<=0 or quantity<1 or quantity>10000000 or sourcing<0 or other_costs<0 or freight<0 or duties<0 or packaging<0 or inspection<0 or setup_cost<0 or fx_pct<0 or fx_pct>100 then
      raise exception 'invalid B2B scenario inputs' using errcode='22023';
    end if;
    revenue:=unit_price*quantity;
    total_costs:=(sourcing+freight+duties+packaging+other_costs)*quantity+inspection+setup_cost+(revenue*fx_pct/100);
    profit:=revenue-total_costs;
    margin_pct:=case when revenue>0 then round(profit/revenue*100,4) else null end;
    break_even:=case when unit_price-sourcing-freight-duties-packaging-other_costs-(unit_price*fx_pct/100)>0 then ceil((inspection+setup_cost)/(unit_price-sourcing-freight-duties-packaging-other_costs-(unit_price*fx_pct/100))) else null end;
    outputs:=jsonb_build_object('revenue',round(revenue,2),'total_costs',round(total_costs,2),'contribution_profit',round(profit,2),'contribution_margin_pct',margin_pct,'break_even_units',break_even,'fx_reserve',round(revenue*fx_pct/100,2));
  end if;

  insert into research.profit_scenarios(product_id,scenario_type,currency,input_values,output_values,assumptions,created_by)
  values(p_product_id,p_scenario_type,upper(p_currency),p_inputs,outputs,nullif(btrim(p_assumptions),''),actor)
  returning * into created;
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values(actor,'create','research.profit_scenario',created.id::text,jsonb_build_object('scenario_type',p_scenario_type,'currency',upper(p_currency),'contribution_profit',outputs->'contribution_profit'));
  return jsonb_build_object('data',jsonb_build_object('id',created.id,'scenario_type',created.scenario_type,'currency',created.currency,'input_values',created.input_values,'output_values',created.output_values,'created_at',created.created_at));
end;
$$;
revoke all on function public.urania_create_profit_scenario(text,text,jsonb,uuid,text) from public,anon;
grant execute on function public.urania_create_profit_scenario(text,text,jsonb,uuid,text) to authenticated;
