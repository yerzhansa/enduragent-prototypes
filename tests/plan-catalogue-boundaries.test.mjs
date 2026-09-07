import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test } from "vitest";
import { checkPlanCatalogue, inspectSourceBoundaries } from "../tools/check-plan-catalogue.mjs";

const source = new URL("../src/plan-catalogue/", import.meta.url);
const temporary = [];
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "plan-catalogue-boundaries-"));
  temporary.push(directory);
  cpSync(source, directory, { recursive: true });
  return directory;
}
function change(directory, name, transform) {
  const path = join(directory, name);
  writeFileSync(path, transform(readFileSync(path, "utf8")));
}
function append(directory, name, text) {
  change(directory, name, (source) => `${source}\n${text}\n`);
}
afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

test("accepts the actual React catalogue without comparing it to the HTML oracle", () => {
  const directory = fixture();
  expect(() => checkPlanCatalogue(directory)).not.toThrow();
  append(directory, "scenarios.ts", 'export const catalogueLabel = "Updated fictional journey";');
  expect(() => checkPlanCatalogue(directory)).not.toThrow();
});

test("accepts a shared component import alias when the JSX uses that import", () => {
  const directory = fixture();
  change(directory, "view.tsx", (text) =>
    text
      .replace("  PlanAction,", "  PlanAction as CatalogueButton,")
      .replaceAll("<PlanAction", "<CatalogueButton")
      .replaceAll("</PlanAction", "</CatalogueButton"),
  );
  expect(() => checkPlanCatalogue(directory)).not.toThrow();
});

test("rejects legacy runtime files, missing typed modules, and symlinks", () => {
  const directory = fixture();
  const extra = join(directory, "prototype.js");
  writeFileSync(extra, "");
  expect(() => checkPlanCatalogue(directory)).toThrow(/Only typed React modules/);
  rmSync(extra);
  const model = join(directory, "model.ts");
  rmSync(model);
  expect(() => checkPlanCatalogue(directory)).toThrow(/Missing React catalogue module/);
  symlinkSync(new URL("model.ts", source), model);
  expect(() => checkPlanCatalogue(directory)).toThrow(/regular files/);
});

test.each([
  ["const store = localStorage;", /forbidden browser or native API localStorage/],
  ["const read = localStorage.getItem;", /forbidden browser or native API localStorage/],
  ['localStorage["getItem"](storageKey);', /forbidden browser or native API localStorage/],
  ["window.localStorage.getItem(storageKey);", /forbidden browser or native API localStorage/],
  ['window["localStorage"].getItem(storageKey);', /forbidden API access localStorage/],
  ["localStorage.clear();", /Only direct getItem/],
  ["localStorage.removeItem(storageKey);", /Only direct getItem/],
  ['localStorage.getItem("enduragent-fictional-plan-catalogue-v1");', /Only direct getItem/],
  ['localStorage.setItem(storageKey + "-other", "data");', /Only direct getItem/],
  ['localStorage.getItem(storageKey, "extra");', /Only direct getItem/],
  ["localStorage.setItem(storageKey);", /Only direct getItem/],
  ["localStorage?.getItem(storageKey);", /forbidden browser or native API localStorage/],
  [
    "localStorage.getItem.call(localStorage, storageKey);",
    /forbidden browser or native API localStorage/,
  ],
  ["const alias = storageKey;", /storageKey cannot be aliased/],
  ['storageKey = "other";', /storageKey cannot be aliased/],
  [
    "function read(storageKey: string) { return localStorage.getItem(storageKey); }",
    /storageKey cannot be aliased/,
  ],
  [
    "function read(localStorage: Storage) { return localStorage.getItem(storageKey); }",
    /forbidden browser or native API localStorage/,
  ],
])("rejects broadened or indirect catalogue storage: %s", (text, message) => {
  const directory = fixture();
  append(directory, "controller.ts", text);
  expect(() => checkPlanCatalogue(directory)).toThrow(message);
});

test.each([
  ['"enduragent-fictional-plan-catalogue-v1"', '"enduragent-fictional-plan-catalogue-v2"'],
  ["const storageKey =", "let storageKey ="],
  ['"enduragent-fictional-plan-catalogue-v1"', "`enduragent-fictional-plan-catalogue-${version}`"],
])("rejects changing the storage namespace declaration: %s", (before, after) => {
  const directory = fixture();
  change(directory, "controller.ts", (text) => text.replace(before, after));
  expect(() => checkPlanCatalogue(directory)).toThrow(
    /one top-level const with the fictional namespace/,
  );
});

test("keeps storage forbidden in every module except the catalogue controller", () => {
  const directory = fixture();
  append(
    directory,
    "model.ts",
    'const storageKey = "enduragent-fictional-plan-catalogue-v1"; localStorage.getItem(storageKey);',
  );
  expect(() => checkPlanCatalogue(directory)).toThrow(
    /forbidden browser or native API localStorage/,
  );
  const fileName = resolve("src/other-controller.ts");
  expect(
    inspectSourceBoundaries('localStorage.getItem("enduragent-fictional-plan-catalogue-v1");', {
      fileName,
      sourceRoot: resolve("src"),
    }),
  ).toEqual([expect.stringMatching(/forbidden browser or native API localStorage/)]);
});

test.each([
  "fetch('/unexpected');",
  "new XMLHttpRequest();",
  "new WebSocket('wss://unexpected');",
  "new EventSource('/unexpected');",
  "sessionStorage.getItem('other');",
  "indexedDB.open('other');",
  "document.cookie;",
  "navigator.sendBeacon('/unexpected');",
  "navigator.serviceWorker.register('/unexpected');",
  "window.enduragentAuth;",
  "window.electron;",
  'window["fetch"]("/unexpected");',
])("preserves general browser/native boundaries: %s", (text) => {
  const directory = fixture();
  append(directory, "controller.ts", text);
  expect(() => checkPlanCatalogue(directory)).toThrow(/forbidden/);
});

test.each([
  "node.innerHTML = value;",
  'node["inner" + "HTML"] = value;',
  "node.outerHTML = value;",
  'node.insertAdjacentHTML("beforeend", value);',
  "const parsed = new DOMParser();",
  "const output = <div dangerouslySetInnerHTML={{ __html: value }} />;",
  "const output = <iframe srcDoc={value} />;",
  'const output = <script src="/prototype.js" />;',
  'document.createElement("iframe");',
  "document.write(value);",
  'const markup = "<section><h3>Plan</h3></section>";',
  "const markup = `<section>${value}</section>`;",
  "eval(code);",
  "new Function(code);",
])("rejects HTML renderers and embedded runtimes: %s", (text) => {
  const directory = fixture();
  append(directory, "view.tsx", text);
  expect(() => checkPlanCatalogue(directory)).toThrow(/forbidden|HTML/);
});

test.each([
  'import "./model.mjs";',
  'export * from "./legacy/runtime";',
  'import "../../experiments/plan-in-chat/prototype.js";',
  'import "./index.html";',
  'import "./prototype.js?raw";',
  'import "./index.html?raw";',
  'import("./model");',
  'require("./model");',
  'import "unapproved-package";',
])("rejects legacy adapters and unsupported module loading: %s", (text) => {
  const directory = fixture();
  append(directory, "model.ts", text);
  expect(() => checkPlanCatalogue(directory)).toThrow(
    /legacy runtime|import leaves src|dynamic module loading|unsupported dependency/,
  );
});

test("requires JSX rather than an import-only React wrapper", () => {
  const directory = fixture();
  writeFileSync(
    join(directory, "view.tsx"),
    'import { Fragment } from "react"; export const createCatalogueView = () => "Plan";',
  );
  expect(() => checkPlanCatalogue(directory)).toThrow(/render actual JSX/);
});

test("requires the imported shared components to render in JSX", () => {
  const directory = fixture();
  change(directory, "view.tsx", (text) =>
    text.replaceAll("<PlanAction", "<button").replaceAll("</PlanAction", "</button"),
  );
  expect(() => checkPlanCatalogue(directory)).toThrow(/PlanAction must be imported.*and used/);
});

test("requires the actual controller and view functions to be called", () => {
  const directory = fixture();
  change(directory, "PlanCatalogue.tsx", (text) =>
    text.replace("useCatalogueController()", "unrelatedController()"),
  );
  expect(() => checkPlanCatalogue(directory)).toThrow(
    /useCatalogueController must be imported.*and used/,
  );
});

test("requires a connected Tailwind stylesheet and rejects remote CSS", () => {
  const directory = fixture();
  const original = readFileSync(join(directory, "styles.css"), "utf8");
  writeFileSync(
    join(directory, "styles.css"),
    '/* @reference "../styles.css"; @apply block; */ section { display: block; }',
  );
  expect(() => checkPlanCatalogue(directory)).toThrow(/reference the shared Tailwind entry/);
  writeFileSync(
    join(directory, "styles.css"),
    '@reference "../styles.css"; section { display: block; }',
  );
  expect(() => checkPlanCatalogue(directory)).toThrow(/use Tailwind utilities/);
  writeFileSync(
    join(directory, "styles.css"),
    `${original}\n@import "https://unexpected/styles.css";`,
  );
  expect(() => checkPlanCatalogue(directory)).toThrow(
    /cannot load another runtime or remote resources/,
  );
  writeFileSync(join(directory, "styles.css"), original);
  change(directory, "PlanCatalogue.tsx", (text) => text.replace('import "./styles.css";', ""));
  expect(() => checkPlanCatalogue(directory)).toThrow(/must import its Tailwind stylesheet/);
});
