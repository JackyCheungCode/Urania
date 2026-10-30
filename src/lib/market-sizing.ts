export type MarketSizingInputs = {
  topDownTotalMarket: number;
  topDownAddressableShare: number;
  bottomUpTotalCustomers: number;
  bottomUpAnnualSpendPerCustomer: number;
  bottomUpAddressableCustomers: number;
  salesReps: number;
  qualifiedLeadsPerRepPerMonth: number;
  leadToCustomerConversionRate: number;
  annualRevenuePerCustomer: number;
  annualDeliveryCapacityCustomers: number;
  currency: string;
};
export type MarketSizingResult = {
  currency:string;
  topDownTAM:number;
  topDownSAM:number;
  bottomUpTAM:number;
  bottomUpSAM:number;
  reconciledTAM:number;
  reconciledSAM:number;
  annualSalesCapacityCustomers:number;
  annualSalesCapacityRevenue:number;
  deliveryCapacityRevenue:number;
  som:number;
  somConstraint:"sales_capacity"|"delivery_capacity"|"addressable_market";
  topDownBottomUpGapRate:number|null;
  limitations:string[];
};
export function validateMarketSizingInputs(input:MarketSizingInputs):string[]{
  const errors:string[]=[];
  if(!/^[A-Z]{3}$/.test(input.currency))errors.push("币种必须是三位 ISO 代码。");
  const nonNegative=["topDownTotalMarket","bottomUpTotalCustomers","bottomUpAnnualSpendPerCustomer","bottomUpAddressableCustomers","salesReps","qualifiedLeadsPerRepPerMonth","annualRevenuePerCustomer","annualDeliveryCapacityCustomers"] as const;
  for(const key of nonNegative)if(!Number.isFinite(input[key])||input[key]<0)errors.push(`${key} 必须是非负有限数值。`);
  if(!Number.isFinite(input.topDownAddressableShare)||input.topDownAddressableShare<0||input.topDownAddressableShare>1)errors.push("自上而下可服务市场占比必须介于 0 和 1。");
  if(!Number.isFinite(input.leadToCustomerConversionRate)||input.leadToCustomerConversionRate<0||input.leadToCustomerConversionRate>1)errors.push("线索转化率必须介于 0 和 1。");
  for(const key of ["bottomUpTotalCustomers","bottomUpAddressableCustomers","salesReps","qualifiedLeadsPerRepPerMonth","annualDeliveryCapacityCustomers"] as const)if(!Number.isInteger(input[key]))errors.push(key+" 必须是整数。");
  if(input.bottomUpAddressableCustomers>input.bottomUpTotalCustomers)errors.push("可服务客户数不能超过总客户数。");
  if(input.topDownTotalMarket===0)errors.push("自上而下 TAM 必须大于 0。");
  if(input.bottomUpTotalCustomers===0||input.bottomUpAnnualSpendPerCustomer===0)errors.push("自下而上客户数与年支出必须大于 0。");
  return errors;
}
export function calculateMarketSizing(input:MarketSizingInputs):MarketSizingResult{
  const errors=validateMarketSizingInputs(input);
  if(errors.length)throw new Error(errors.join(" "));
  const topDownTAM=input.topDownTotalMarket;
  const topDownSAM=topDownTAM*input.topDownAddressableShare;
  const bottomUpTAM=input.bottomUpTotalCustomers*input.bottomUpAnnualSpendPerCustomer;
  const bottomUpSAM=input.bottomUpAddressableCustomers*input.bottomUpAnnualSpendPerCustomer;
  const reconciledTAM=(topDownTAM+bottomUpTAM)/2;
  const reconciledSAM=(topDownSAM+bottomUpSAM)/2;
  const annualSalesCapacityCustomers=input.salesReps*input.qualifiedLeadsPerRepPerMonth*12*input.leadToCustomerConversionRate;
  const annualSalesCapacityRevenue=annualSalesCapacityCustomers*input.annualRevenuePerCustomer;
  const deliveryCapacityRevenue=input.annualDeliveryCapacityCustomers*input.annualRevenuePerCustomer;
  const limits=[{key:"sales_capacity" as const,value:annualSalesCapacityRevenue},{key:"delivery_capacity" as const,value:deliveryCapacityRevenue},{key:"addressable_market" as const,value:reconciledSAM}].sort((a,b)=>a.value-b.value);
  const som=limits[0].value;
  const gapBase=Math.max(topDownTAM,bottomUpTAM);
  return {
    currency:input.currency,topDownTAM,topDownSAM,bottomUpTAM,bottomUpSAM,
    reconciledTAM,reconciledSAM,annualSalesCapacityCustomers,annualSalesCapacityRevenue,
    deliveryCapacityRevenue,som,somConstraint:limits[0].key,
    topDownBottomUpGapRate:gapBase===0?null:Math.abs(topDownTAM-bottomUpTAM)/gapBase,
    limitations:[
      "双路径测算结果仅在口径、地域、年份和价格基准一致时才可比较。",
      "当前调和值为两条路径的简单平均；重大差异必须由研究人员解释，不代表统计置信区间。",
      "SOM 由销售获客能力、交付能力与可服务市场三者中的最小值约束，不按 SAM 固定比例推算。",
      "客户数量、年支出、线索量、转化率和交付能力必须附带来源、时间戳与证据等级。"
    ]
  };
}
