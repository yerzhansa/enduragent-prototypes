import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { platform, release, arch } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import pngjs from "pngjs";

const { PNG } = pngjs;
const directory = dirname(fileURLToPath(import.meta.url));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const sourceNames = ["index.html", "prototype.js", "prototype.css", "model.mjs", "scenarios.mjs"];
const projects = [
  { name: "wide-light", theme: "light", width: "wide", viewport: { width: 1440, height: 1100 } },
  { name: "wide-dark", theme: "dark", width: "wide", viewport: { width: 1440, height: 1100 } },
  {
    name: "compact-light",
    theme: "light",
    width: "compact",
    viewport: { width: 900, height: 1100 },
  },
  { name: "compact-dark", theme: "dark", width: "compact", viewport: { width: 900, height: 1100 } },
];

function pixelDifference(expected, actual) {
  assert.equal(actual.width, expected.width, "Screenshot width changed");
  assert.equal(actual.height, expected.height, "Screenshot height changed");
  const diff = new PNG({ width: expected.width, height: expected.height });
  let count = 0;
  for (let offset = 0; offset < expected.data.length; offset += 4) {
    const different = [0, 1, 2, 3].some(
      (channel) => expected.data[offset + channel] !== actual.data[offset + channel],
    );
    if (different) count += 1;
    diff.data[offset] = different ? 255 : actual.data[offset];
    diff.data[offset + 1] = different ? 0 : actual.data[offset + 1];
    diff.data[offset + 2] = different ? 70 : actual.data[offset + 2];
    diff.data[offset + 3] = 255;
  }
  return { count, diff };
}

function proveComparator() {
  const original = new PNG({ width: 2, height: 2 });
  original.data.fill(255);
  const changed = PNG.sync.read(PNG.sync.write(original));
  changed.data[0] = 254;
  assert.equal(pixelDifference(original, original).count, 0);
  assert.equal(pixelDifference(original, changed).count, 1);
}

async function sourceSnapshot(root) {
  return Object.fromEntries(
    await Promise.all(sourceNames.map(async (name) => [name, await readFile(join(root, name))])),
  );
}

function sourceHashes(files) {
  return Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, hash(bytes)]));
}

async function serve(files) {
  const types = {
    html: "text/html",
    js: "text/javascript",
    mjs: "text/javascript",
    css: "text/css",
  };
  const server = createServer((request, response) => {
    const path = new URL(request.url, "http://127.0.0.1").pathname;
    const name = path === "/" ? "index.html" : path.slice(1);
    if (name === "favicon.ico") {
      response.writeHead(204).end();
    } else if (Object.hasOwn(files, name)) {
      response
        .writeHead(200, {
          "Content-Type": types[name.split(".").at(-1)],
          "Cache-Control": "no-store",
        })
        .end(files[name]);
    } else response.writeHead(404).end();
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

async function applyStep(page, step) {
  if (step.kind === "click") await page.locator(step.selector).click();
  else if (step.kind === "fill") await page.locator(step.selector).fill(step.value);
  else if (step.kind === "select") await page.locator(step.selector).selectOption(step.value);
  else if (step.kind === "press") await page.locator(step.selector).press(step.key);
  else if (step.kind === "reload") await page.reload();
  else throw new Error(`Unknown interaction: ${step.kind}`);
}

async function settlePage(page) {
  await page.locator(".app-frame").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
}

async function stableScreenshot(page) {
  await page.waitForTimeout(500);
  let previous = null;
  let consecutive = 0;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const png = await page.screenshot({ fullPage: true, animations: "disabled", caret: "hide" });
    const digest = hash(png);
    consecutive = digest === previous ? consecutive + 1 : 0;
    if (consecutive === 2) return png;
    previous = digest;
    await page.waitForTimeout(200);
  }
  throw new Error("The rendered page did not produce three identical consecutive screenshots");
}

async function capturePage(browser, base, project, entry) {
  const context = await browser.newContext({
    viewport: project.viewport,
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: project.theme,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const url = new URL(base);
  assert.equal(url.hostname, "127.0.0.1", "Use a loopback preview");
  await context.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin === url.origin) await route.continue();
    else {
      errors.push(`Unexpected request: ${route.request().url()}`);
      await route.abort();
    }
  });
  url.searchParams.set("scenario", entry.scenario);
  url.searchParams.set("theme", project.theme);
  url.searchParams.set("width", project.width);
  if (entry.variation) url.searchParams.set("variation", entry.variation);
  else url.searchParams.delete("variation");
  try {
    await page.goto(url.href);
    await settlePage(page);
    assert.equal(await page.locator("#scenario-select option").count(), 55);
    assert.equal(await page.locator(".coverage-button").count(), 55);
    for (const step of entry.steps ?? []) {
      await applyStep(page, step);
      await settlePage(page);
    }
    const png = await stableScreenshot(page);
    const evidence = await page.evaluate(() => ({
      title: document.title,
      text: document.body.innerText,
      scenario: document.querySelector("#scenario-select").value,
      variation: document.querySelector("#variation-select")?.value ?? "",
      theme: document.documentElement.dataset.theme,
      width: document.querySelector(".app-frame").dataset.width,
      fields: [...document.querySelectorAll("input, select, textarea")].map((element) => ({
        id: element.id,
        name: element.getAttribute("name"),
        value: element.value,
        checked: element instanceof HTMLInputElement ? element.checked : null,
        disabled: element.disabled,
      })),
      focus: {
        id: document.activeElement?.id,
        label: document.activeElement?.getAttribute("aria-label"),
        text: document.activeElement?.textContent,
      },
    }));
    assert.deepEqual(errors, [], "The page must render without runtime errors");
    return { png, evidence };
  } finally {
    await context.close();
  }
}

const [mode, ...raw] = process.argv.slice(2);
const options = Object.fromEntries(
  Array.from({ length: raw.length / 2 }, (_, index) => [
    raw[index * 2].replace(/^--/, ""),
    raw[index * 2 + 1],
  ]),
);
assert.ok(mode === "capture" || mode === "compare", "Choose capture or compare");
assert.ok(options.baseline, "Provide --baseline");
const baseline = resolve(options.baseline);
const casesBytes = await readFile(
  options.cases ? resolve(options.cases) : join(directory, "cases.json"),
);
const cases = JSON.parse(casesBytes);
const identityBytes = await readFile(join(directory, "source-identity.json"));
const identity = JSON.parse(identityBytes);
const harness = {
  script: hash(await readFile(fileURLToPath(import.meta.url))),
  cases: hash(casesBytes),
  identity: hash(identityBytes),
  pngjs: "7.0.0",
};
proveComparator();
let reference;
let manifest;
let files;
let output;
if (mode === "capture") {
  assert.ok(options.reference, "Provide --reference for the original source");
  files = await sourceSnapshot(resolve(options.reference));
  assert.deepEqual(sourceHashes(files), identity, "Capture only the frozen original source");
  await mkdir(baseline);
  await mkdir(join(baseline, "source"));
  for (const [name, bytes] of Object.entries(files))
    await writeFile(join(baseline, "source", name), bytes, { flag: "wx" });
  reference = await serve(files);
  output = baseline;
} else {
  assert.ok(options.target && options.output, "Provide --target and a fresh --output directory");
  manifest = JSON.parse(await readFile(join(baseline, "manifest.json"), "utf8"));
  assert.deepEqual(harness, manifest.harness, "The sealed comparison harness changed");
  assert.deepEqual(
    sourceHashes(await sourceSnapshot(join(baseline, "source"))),
    manifest.source,
    "The frozen reference source changed",
  );
  output = resolve(options.output);
  await mkdir(output);
}
const browser = await chromium.launch({ args: ["--disable-gpu", "--disable-partial-raster", "--disable-skia-runtime-opts", "--disable-threaded-animation", "--disable-threaded-scrolling", "--run-all-compositor-stages-before-draw"] });
const environment = {
  browser: browser.version(),
  platform: platform(),
  release: release(),
  architecture: arch(),
  locale: "en-US",
  timezone: "UTC",
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
};
const results = [];
try {
  if (mode === "compare")
    assert.deepEqual(
      environment,
      manifest.environment,
      "Capture and comparison environments must match",
    );
  await Promise.all(
    projects.map(async (project) => {
      await mkdir(join(output, project.name));
      for (const [index, entry] of cases.entries()) {
        const key = `${project.name}/${entry.id}`;
        const { png, evidence } = await capturePage(
          browser,
          reference?.url ?? options.target,
          project,
          entry,
        );
        await writeFile(join(output, `${key}.png`), png, { flag: "wx" });
        await writeFile(join(output, `${key}.json`), JSON.stringify(evidence, null, 2), {
          flag: "wx",
        });
        if (mode === "capture")
          results.push({ key, png: hash(png), evidence: hash(JSON.stringify(evidence)) });
        else {
          const expectedBytes = await readFile(join(baseline, `${key}.png`));
          const expectedEvidence = JSON.parse(
            await readFile(join(baseline, `${key}.json`), "utf8"),
          );
          const sealed = manifest.results.find((result) => result.key === key);
          assert.equal(hash(expectedBytes), sealed.png, `Reference pixels changed: ${key}`);
          assert.equal(
            hash(JSON.stringify(expectedEvidence)),
            sealed.evidence,
            `Reference evidence changed: ${key}`,
          );
          let mismatch = null;
          let pixels = null;
          try {
            const difference = pixelDifference(PNG.sync.read(expectedBytes), PNG.sync.read(png));
            pixels = difference.count;
            if (pixels > 0)
              await writeFile(join(output, `${key}-diff.png`), PNG.sync.write(difference.diff), {
                flag: "wx",
              });
            assert.deepEqual(evidence, expectedEvidence);
          } catch (error) {
            mismatch = error.message;
          }
          results.push({ key, pixels, mismatch, passed: pixels === 0 && mismatch === null });
        }
        if ((index + 1) % 10 === 0 || index + 1 === cases.length)
          process.stdout.write(`${mode} ${project.name}: ${index + 1}/${cases.length}\n`);
      }
    }),
  );
  if (mode === "capture") {
    assert.deepEqual(
      sourceHashes(await sourceSnapshot(resolve(options.reference))),
      sourceHashes(files),
      "Original source changed during capture",
    );
    await writeFile(
      join(baseline, "manifest.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          harness,
          source: sourceHashes(files),
          environment,
          projects,
          caseCount: cases.length,
          results: results.sort((a, b) => a.key.localeCompare(b.key)),
        },
        null,
        2,
      ),
      { flag: "wx" },
    );
    process.stdout.write(`Sealed ${results.length} original screenshots\n`);
  } else {
    await writeFile(
      join(output, "result.json"),
      JSON.stringify(
        { environment, results, passed: results.every((result) => result.passed) },
        null,
        2,
      ),
      { flag: "wx" },
    );
    assert.ok(
      results.every((result) => result.passed),
      `${results.filter((result) => !result.passed).length} comparisons failed; inspect result.json`,
    );
    process.stdout.write(`Verified ${results.length} screenshots with zero changed pixels\n`);
  }
} finally {
  await browser.close();
  if (reference) await new Promise((done) => reference.server.close(done));
}
