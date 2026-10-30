export type FinancialCase = "downside" | "base" | "upside";

export type InvestmentInputs = {
  currency: string;
  horizonMonths: number;
  initialInvestment: number;
  workingCapital: number;
  yearOneRevenue: number;
  annualGrowthRate: number;
  grossMarginRate: number;
  operatingExpenseRate: number;
  fixedMonthlyCost: number;
  taxRate: number;
  discountRate: number;
};

export type FinancialResult = {
  revenue: number;
  grossProfit: number;
  operatingProfit: number;
  tax: number;
  netOperatingCash: number;
  endingCashFlow: number;
  roi: number;
  npv: number;
  irr: number | null;
  paybackMonths: number | null;
  cashFlows: number[];
};

const finiteNonNegative = (v: number) => Number.isFinite(v) && v >= 0;
const clampRate = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;

export function validateInvestmentInputs(input: InvestmentInputs): string[] {
  const errors: string[] = [];
  if (!/^[A-Z]{3}$/.test(input.currency)) errors.push("币种必须是三位 ISO 代码。");
  if (!Number.isInteger(input.horizonMonths) || input.horizonMonths < 12 || input.horizonMonths > 120) errors.push("测算周期必须为 12–120 个月。");
  for (const key of ["initialInvestment", "workingCapital", "yearOneRevenue", "fixedMonthlyCost"] as const) {
    if (!finiteNonNegative(input[key])) errors.push(`${key} 必须是非负有限数值。`);
  }
  for (const key of ["annualGrowthRate", "grossMarginRate", "operatingExpenseRate", "taxRate", "discountRate"] as const) {
    if (!clampRate(input[key])) errors.push(`${key} 必须介于 0% 和 100%。`);
  }
  return errors;
}

function npv(rate: number, flows: number[]): number {
  return flows.reduce((sum, flow, period) => sum + flow / Math.pow(1 + rate, period), 0);
}

function irr(flows: number[]): number | null {
  let low = -0.9999, high = 10;
  let lowValue = npv(low, flows), highValue = npv(high, flows);
  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue) || lowValue * highValue > 0) return null;
  for (let i = 0; i < 160; i++) {
    const mid = (low + high) / 2;
    const value = npv(mid, flows);
    if (Math.abs(value) < 1e-8) return mid;
    if (value * lowValue > 0) { low = mid; lowValue = value; }
    else { high = mid; highValue = value; }
  }
  return (low + high) / 2;
}

export function calculateInvestmentCase(input: InvestmentInputs, scenario: FinancialCase) {
  const multipliers = { downside: { revenue: 0.72, margin: -0.06, growth: -0.08, costs: 1.12 }, base: { revenue: 1, margin: 0, growth: 0, costs: 1 }, upside: { revenue: 1.22, margin: 0.04, growth: 0.08, costs: 0.96 } }[scenario];
  const years = Math.ceil(input.horizonMonths / 12);
  const initialOutflow = input.initialInvestment + input.workingCapital;
  const cashFlows = [-initialOutflow];
  let revenueTotal = 0, grossProfitTotal = 0, operatingProfitTotal = 0, taxTotal = 0;
  let cumulative = -initialOutflow, paybackMonths: number | null = null;
  for (let year = 1; year <= years; year++) {
    const months = Math.min(12, input.horizonMonths - (year - 1) * 12);
    const revenue = input.yearOneRevenue * multipliers.revenue * Math.pow(Math.max(0, 1 + input.annualGrowthRate + multipliers.growth), year - 1) * months / 12;
    const grossMargin = Math.max(0, Math.min(1, input.grossMarginRate + multipliers.margin));
    const grossProfit = revenue * grossMargin;
    const operatingCosts = revenue * input.operatingExpenseRate * multipliers.costs + input.fixedMonthlyCost * months * multipliers.costs;
    const operatingProfit = grossProfit - operatingCosts;
    const tax = Math.max(0, operatingProfit) * input.taxRate;
    const cash = operatingProfit - tax;
    revenueTotal += revenue; grossProfitTotal += grossProfit; operatingProfitTotal += operatingProfit; taxTotal += tax;
    cashFlows.push(cash);
    const prior = cumulative;
    cumulative += cash;
    if (paybackMonths === null && prior < 0 && cumulative >= 0 && cash > 0) {
      paybackMonths = (year - 1) * 12 + (-prior / cash) * months;
    }
  }
  const endingCashFlow = cashFlows.reduce((a, b) => a + b, 0) + input.workingCapital;
  const netOperatingCash = cashFlows.slice(1).reduce((a, b) => a + b, 0);
  return {
    revenue: revenueTotal, grossProfit: grossProfitTotal, operatingProfit: operatingProfitTotal, tax: taxTotal,
    netOperatingCash, endingCashFlow, roi: initialOutflow > 0 ? endingCashFlow / initialOutflow * 100 : 0,
    npv: npv(Math.pow(1 + input.discountRate, 1) - 1, cashFlows),
    irr: irr(cashFlows), paybackMonths, cashFlows
  };
}
