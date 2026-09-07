import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { checkPlanCatalogue } from "../tools/check-plan-catalogue.mjs";

const source = new URL("../experiments/plan-in-chat/", import.meta.url);
const identity = JSON.parse(
  readFileSync(new URL("../tools/plan-parity/source-identity.json", import.meta.url), "utf8"),
);
const temporary = [];
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "plan-catalogue-boundaries-"));
  temporary.push(directory);
  cpSync(source, directory, { recursive: true });
  return directory;
}
afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

test("accepts only the original catalogue with the required module script attribute", () => {
  expect(() => checkPlanCatalogue(fixture(), identity)).not.toThrow();
});

test.each(Object.keys(identity))("rejects a changed frozen file: %s", (name) => {
  const directory = fixture();
  const path = join(directory, name);
  writeFileSync(path, `${readFileSync(path, "utf8")}\nfetch('/unexpected');`);
  expect(() => checkPlanCatalogue(directory, identity)).toThrow(/Frozen catalogue source changed/);
});

test("rejects additional files and missing files", () => {
  const directory = fixture();
  const extra = join(directory, "additional.js");
  writeFileSync(extra, "");
  expect(() => checkPlanCatalogue(directory, identity)).toThrow();
  rmSync(extra);
  rmSync(join(directory, "model.mjs"));
  expect(() => checkPlanCatalogue(directory, identity)).toThrow();
});

test("rejects symlinks even when they contain the original bytes", () => {
  const directory = fixture();
  const path = join(directory, "model.mjs");
  rmSync(path);
  symlinkSync(new URL("model.mjs", source), path);
  expect(() => checkPlanCatalogue(directory, identity)).toThrow(/regular files/);
});

test("rejects a classic script entry and additional module substitutions", () => {
  const directory = fixture();
  const path = join(directory, "index.html");
  const html = readFileSync(path, "utf8");
  writeFileSync(path, html.replace('<script type="module" src=', "<script src="));
  expect(() => checkPlanCatalogue(directory, identity)).toThrow(/one module entry/);
  writeFileSync(path, `${html}<script type="module" src="other.js"></script>`);
  expect(() => checkPlanCatalogue(directory, identity)).toThrow(/one module entry/);
});
