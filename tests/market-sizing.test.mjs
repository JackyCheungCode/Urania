import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source=await readFile(new URL("../src/lib/market-sizing.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const model=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
const input={currency:"USD",topDownTotalMarket:100000000,topDownAddressableShare:.2,bottomUpTotalCustomers:10000,bottomUpAnnualSpendPerCustomer:8000,bottomUpAddressableCustomers:2000,salesReps:5,qualifiedLeadsPerRepPerMonth:40,leadToCustomerConversionRate:.08,annualRevenuePerCustomer:8000,annualDeliveryCapacityCustomers:150};
test("TAM and SAM reconcile two independent market-sizing paths",()=>{
 const result=model.calculateMarketSizing(input);
 assert.equal(result.topDownTAM,100000000);
 assert.equal(result.topDownSAM,20000000);
 assert.equal(result.bottomUpTAM,80000000);
 assert.equal(result.bottomUpSAM,16000000);
 assert.equal(result.reconciledTAM,90000000);
 assert.equal(result.reconciledSAM,18000000);
});
test("SOM is constrained by actual sales, delivery and addressable capacity",()=>{
 const result=model.calculateMarketSizing(input);
 assert.equal(result.annualSalesCapacityCustomers,192);
 assert.equal(result.annualSalesCapacityRevenue,1536000);
 assert.equal(result.deliveryCapacityRevenue,1200000);
 assert.equal(result.som,1200000);
 assert.equal(result.somConstraint,"delivery_capacity");
});
test("rejects inconsistent market-sizing inputs",()=>{
 assert.ok(model.validateMarketSizingInputs({...input,bottomUpAddressableCustomers:20000}).length>0);
 assert.ok(model.validateMarketSizingInputs({...input,leadToCustomerConversionRate:1.5}).length>0);
});
