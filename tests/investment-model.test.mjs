import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/investment-model.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const engine = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const sample = {
  currency: "USD", horizonMonths: 36, initialInvestment: 100000, workingCapital: 20000,
  yearOneRevenue: 200000, annualGrowthRate: 0.15, grossMarginRate: 0.45,
  operatingExpenseRate: 0.16, fixedMonthlyCost: 4000, taxRate: 0.2, discountRate: 0.12
};

test("validates investment model input boundaries", () => {
  assert.deepEqual(engine.validateInvestmentInputs(sample), []);
  assert.ok(engine.validateInvestmentInputs({ ...sample, discountRate: 1.2 }).length > 0);
  assert.ok(engine.validateInvestmentInputs({ ...sample, horizonMonths: 0 }).length > 0);
  assert.ok(engine.validateInvestmentInputs({ ...sample, currency: "US" }).length > 0);
});

test("computes deterministic downside, base, and upside cases", () => {
  const downside = engine.calculateInvestmentCase(sample, "downside");
  const base = engine.calculateInvestmentCase(sample, "base");
  const upside = engine.calculateInvestmentCase(sample, "upside");
  assert.ok(downside.revenue < base.revenue);
  assert.ok(upside.revenue > base.revenue);
  assert.ok(downside.cashFlows.length === 4);
  assert.ok(Number.isFinite(base.npv));
  assert.ok(Number.isFinite(base.roi));
  assert.ok(base.paybackMonths === null || base.paybackMonths > 0);
});

test("does not fabricate IRR where no sign change can produce a root", () => {
  const lossCase = { ...sample, yearOneRevenue: 0, fixedMonthlyCost: 10000 };
  assert.equal(engine.calculateInvestmentCase(lossCase, "base").irr, null);
});
