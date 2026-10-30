import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const uiFiles = [
  "src/App.tsx",
  "src/auth/AuthGate.tsx",
  "src/components/CRMExtras.tsx",
  "src/components/ProductScoringPanel.tsx",
  "src/components/ProfitCalculator.tsx",
];

test("all interactive controls and data tables use Carbon components", async () => {
  for (const file of uiFiles) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /<\/?(?:button|input|select|textarea|table|thead|tbody|tr|th|td)(?=[\s/>])/, `${file} contains a native control or table`);
    assert.doesNotMatch(source, /from ["']lucide-react["']/, `${file} imports a non-Carbon icon library`);
    assert.match(source, /@carbon\/(?:react|react\/icons)/, `${file} must use Carbon`);
  }
});

test("the application bootstraps Carbon styles and a supported Carbon theme", async () => {
  const main = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles.scss", import.meta.url), "utf8");
  assert.match(main, /<Theme theme="white">/);
  assert.match(styles, /^@use ['"]@carbon\/react['"];/);
});


test("global shell uses Carbon layout, navigation, tiles and modal primitives", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  for (const component of ["Grid", "Column", "Tile", "SideNav", "SideNavItems", "SideNavLink", "Modal", "CarbonHeader"]) {
    assert.match(app, new RegExp("<" + component + "\\b"), `App.tsx must compose ${component}`);
  }
  assert.doesNotMatch(app, /provider-modal-backdrop|role="dialog" aria-modal="true"/, "credential dialog must use Carbon Modal");
});



test("business workspaces compose Carbon Tile surfaces and Grid/Column layouts", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  for (const page of ["Overview", "Research", "CRM", "Intelligence", "Automation", "Integrations", "Settings"]) {
    assert.match(app, new RegExp("function " + page + "\\b"), page + " workspace must remain present");
  }
  assert.match(app, /function CarbonLayoutGrid[\s\S]*<GridSettings mode="css-grid" subgrid={false}>[\s\S]*<Grid fullWidth[\s\S]*<Column/, "business layouts must use independent Carbon Grid and Column composition");
  assert.ok((app.match(/<Tile\b/g) || []).length >= 10, "business panels must use Carbon Tile");
  for (const layout of ["metric-grid", "crm-metrics", "dashboard-grid", "lower-grid", "research-cards", "intelligence-grid", "integration-summary", "settings-grid", "evidence-grid"]) {
    assert.match(app, new RegExp('<CarbonLayoutGrid className="[^"]*\\b' + layout + '\\b'), layout + " must use the shared Carbon grid");
  }
  assert.match(app, /<OverflowMenu\b[\s\S]*<OverflowMenuItem/, "workspace actions must use Carbon menu primitives");
  assert.match(app, /InlineNotification className="toast-notification"/, "transient feedback must use Carbon notifications");
  assert.doesNotMatch(app, /className="inline-error"|className="inline-success"|className="auth-error"/, "custom alert patterns must be removed");
  for (const file of ["src/App.tsx", "src/components/CRMExtras.tsx", "src/components/ProfitCalculator.tsx", "src/components/ProductScoringPanel.tsx"]) {
    const source = await readFile(new URL("../" + file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /<section className="[^"]*\bpanel\b/, file + " still contains a legacy section panel");
    assert.match(source, /<Tile\b/, file + " must use Carbon Tile");
  }
});

test("responsive acceptance breakpoints cover desktop, tablet and narrow mobile widths", async () => {
  const styles = await readFile(new URL("../src/styles.scss", import.meta.url), "utf8");
  assert.match(styles, /@media\(min-width:1280px\)/, "1440px desktop rules must be explicit");
  assert.match(styles, /@media\(min-width:672px\) and \(max-width:1055px\)/, "1024px tablet rules must be explicit");
  for (const breakpoint of ["1055px", "671px", "390px", "360px"]) {
    assert.match(styles, new RegExp("@media\\s*\\(max-width:\\s*" + breakpoint.replace("px", "\\s*px") + "\\)"), "missing responsive rule at " + breakpoint);
  }
  assert.match(styles, /grid-template-columns:repeat\(16,minmax\(0,1fr\)\)/);
  assert.match(styles, /grid-template-columns:repeat\(8,minmax\(0,1fr\)\)/);
  assert.match(styles, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(styles, /\.evidence-grid\.cds--css-grid,\.evidence-grid\.cds--css-grid/, "duplicate responsive selectors should not accumulate");
});


test("authentication bypass is compiled only for explicit visual-test mode", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const gate = await readFile(new URL("../src/auth/AuthGate.tsx", import.meta.url), "utf8");
  const env = await readFile(new URL("../src/vite-env.d.ts", import.meta.url), "utf8");
  assert.match(app, /import\.meta\.env\.MODE === "test" && import\.meta\.env\.VITE_E2E_BYPASS_AUTH === "true"/);
  assert.match(gate, /if \(e2ePreview\) return <>{children}<\/>;/);
  assert.match(env, /VITE_E2E_BYPASS_AUTH\?: string/);
});
