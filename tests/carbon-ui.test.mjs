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
  for (const component of ["Grid", "Column", "Tile", "SideNav", "SideNavItems", "SideNavLink", "Modal"]) {
    assert.match(app, new RegExp("<" + component + "\\b"), `App.tsx must compose ${component}`);
  }
  assert.doesNotMatch(app, /provider-modal-backdrop|role="dialog" aria-modal="true"/, "credential dialog must use Carbon Modal");
});
