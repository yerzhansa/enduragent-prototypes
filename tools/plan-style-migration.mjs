import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values: options } = parseArgs({
  options: {
    reference: { type: "string" },
    write: { type: "boolean", default: false },
  },
});
if (!options.reference) {
  console.error(
    "Usage: node tools/plan-style-migration.mjs --reference <original-css-path> [--write]",
  );
  process.exit(1);
}

const require = createRequire(import.meta.url);
const postcss = createRequire(require.resolve("vite"))("postcss");
const { compile } = await import(
  createRequire(require.resolve("@tailwindcss/vite")).resolve("@tailwindcss/node")
);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = resolve(root, "src/plan-catalogue");
const sourceIdentity = JSON.parse(
  await readFile(resolve(root, "tools/plan-parity/source-identity.json"), "utf8"),
);
const referenceSource = await readFile(resolve(options.reference));
assert.equal(
  createHash("sha256").update(referenceSource).digest("hex"),
  sourceIdentity["prototype.css"],
  "Reference CSS does not match the sealed original source identity",
);
const baseline = postcss.parse(referenceSource.toString("utf8"));
const reference = '@reference "../styles.css";\n';
const normalize = (value) =>
  value
    .replace(/\s+/g, " ")
    .replace(/(^|[^\w-])0\.(\d)/g, "$1.$2")
    .replace(/\s*([,()])\s*/g, "$1")
    .trim();
const declaration = (node) => [node.prop, normalize(node.value), Boolean(node.important)];
const declarations = (node) => node.nodes.filter((child) => child.type === "decl").map(declaration);
const words = {
  display: {
    flex: "flex",
    "inline-flex": "inline-flex",
    grid: "grid",
    block: "block",
    "inline-block": "inline-block",
    none: "hidden",
    contents: "contents",
  },
  position: {
    relative: "relative",
    absolute: "absolute",
    fixed: "fixed",
    sticky: "sticky",
    static: "static",
  },
  "align-items": {
    center: "items-center",
    "flex-start": "items-start",
    "flex-end": "items-end",
    stretch: "items-stretch",
    baseline: "items-baseline",
  },
  "justify-content": {
    center: "justify-center",
    "space-between": "justify-between",
    "flex-start": "justify-start",
    "flex-end": "justify-end",
  },
  "flex-direction": { column: "flex-col", row: "flex-row" },
  "flex-wrap": { wrap: "flex-wrap", nowrap: "flex-nowrap" },
  "text-transform": { uppercase: "uppercase", lowercase: "lowercase", none: "normal-case" },
  "box-sizing": { "border-box": "box-border" },
  "white-space": {
    nowrap: "whitespace-nowrap",
    "pre-wrap": "whitespace-pre-wrap",
    normal: "whitespace-normal",
  },
  "pointer-events": { none: "pointer-events-none", auto: "pointer-events-auto" },
  "text-align": { center: "text-center", left: "text-left", right: "text-right" },
  resize: { none: "resize-none", vertical: "resize-y" },
  "text-overflow": { ellipsis: "text-ellipsis" },
  "font-variant-numeric": { "tabular-nums": "tabular-nums" },
};
const prefixes = {
  width: "w",
  height: "h",
  "min-width": "min-w",
  "max-width": "max-w",
  "min-height": "min-h",
  "max-height": "max-h",
  gap: "gap",
  "row-gap": "gap-y",
  "column-gap": "gap-x",
  padding: "p",
  "padding-top": "pt",
  "padding-right": "pr",
  "padding-bottom": "pb",
  "padding-left": "pl",
  margin: "m",
  "margin-top": "mt",
  "margin-right": "mr",
  "margin-bottom": "mb",
  "margin-left": "ml",
  top: "top",
  right: "right",
  bottom: "bottom",
  left: "left",
  inset: "inset",
  "z-index": "z",
  opacity: "opacity",
  "border-radius": "rounded",
  "font-size": "text",
  "line-height": "leading",
  "font-weight": "font",
  "letter-spacing": "tracking",
  "grid-template-columns": "grid-cols",
  "grid-template-rows": "grid-rows",
  "flex-shrink": "shrink",
  "flex-grow": "grow",
  "flex-basis": "basis",
  order: "order",
  "outline-offset": "outline-offset",
  "max-inline-size": "max-is",
};
const keywordPrefixes = {
  overflow: "overflow",
  "overflow-x": "overflow-x",
  "overflow-y": "overflow-y",
  cursor: "cursor",
  "align-self": "self",
  "place-items": "place-items",
  "object-fit": "object",
  "user-select": "select",
};
const escapeValue = (value) => value.replaceAll("_", "\\_").replace(/\s+/g, "_");
const tokens = {
  "var(--r-ctl)": "ctl",
  "var(--r-card)": "card",
  "var(--r-chip)": "chip",
  "var(--r-pill)": "full",
  "var(--ctl-h)": "ctl",
  "var(--ctl-h-sm)": "ctl-sm",
  "var(--ctl-h-lg)": "ctl-lg",
  "var(--inset)": "inset",
  "var(--row-inset)": "row",
};
function candidate(node) {
  const { prop, value } = node;
  if (words[prop]?.[value]) return words[prop][value];
  if (keywordPrefixes[prop] && /^[a-z-]+$/.test(value))
    return `${keywordPrefixes[prop]}-${value.replace("flex-", "")}`;
  if (prop === "color")
    return value.startsWith("var(--")
      ? `text-${value.slice(6, -1)}`
      : `text-[${escapeValue(value)}]`;
  if (prop === "font-family" && value === "var(--f-ui)") return "font-sans";
  if (prop === "font-family" && value === "var(--f-mono)") return "font-mono";
  if (prop === "background" && /^var\(--[\w-]+\)$/.test(value)) return `bg-${value.slice(6, -1)}`;
  const prefix = prefixes[prop];
  if (prefix) {
    if (tokens[value]) return `${prefix}-${tokens[value]}`;
    if (
      value === "0" &&
      !["font", "tracking", "leading", "grid-cols", "grid-rows"].includes(prefix)
    )
      return `${prefix}-0`;
    if (value === "100%" && ["w", "h", "min-w", "max-w", "min-h", "max-h"].includes(prefix))
      return `${prefix}-full`;
    if (
      value === "auto" &&
      ["w", "h", "m", "mt", "mr", "mb", "ml", "top", "right", "bottom", "left"].includes(prefix)
    )
      return `${prefix}-auto`;
    return `${prefix}-[${prop === "font-size" ? "length:" : ""}${escapeValue(value)}]`;
  }
  return `[${prop}:${escapeValue(value)}]`;
}
const compiled = async (css) =>
  postcss.parse(
    (await compile(reference + css, { base: directory, polyfills: 0, onDependency() {} })).build(
      [],
    ),
  );
const cache = new Map();
let named = 0;
let arbitrary = 0;
let preserved = 0;
async function utility(node) {
  if (
    node.parent?.parent?.name === "keyframes" ||
    node.prop.startsWith("--") ||
    node.value.includes("gradient(") ||
    node.value.includes("color-mix(")
  ) {
    preserved++;
    return null;
  }
  const key = JSON.stringify(declaration(node));
  if (!cache.has(key)) {
    const proposal = candidate(node);
    let selected;
    for (const option of new Set([proposal, `[${node.prop}:${escapeValue(node.value)}]`])) {
      try {
        const result = await compiled(`.probe { @apply ${option}${node.important ? "!" : ""}; }`);
        const rule = result.nodes.find(
          (entry) => entry.type === "rule" && entry.selector === ".probe",
        );
        if (rule && JSON.stringify(declarations(rule)) === JSON.stringify([declaration(node)])) {
          selected = option;
          break;
        }
      } catch {}
    }
    assert.ok(selected, `No equivalent utility for ${node.toString()}`);
    cache.set(key, selected);
  }
  const result = cache.get(key);
  if (result.startsWith("[")) arbitrary++;
  else named++;
  return result;
}
const migrated = baseline.clone();
migrated.walkComments((node) => node.remove());
const pending = [];
migrated.walkDecls((node) => pending.push(node));
for (const node of pending) {
  const result = await utility(node);
  if (result)
    node.replaceWith(
      postcss.atRule({
        name: "apply",
        params: result + (node.important ? "!" : ""),
        raws: { before: node.raws.before },
      }),
    );
}
const rules = [];
migrated.walkRules((rule) => rules.push(rule));
for (const rule of rules) {
  let start = 0;
  while (start < rule.nodes.length) {
    if (
      rule.nodes[start].type !== "atrule" ||
      rule.nodes[start].name !== "apply" ||
      rule.nodes[start].params.endsWith("!")
    ) {
      start++;
      continue;
    }
    let end = start + 1;
    while (
      end < rule.nodes.length &&
      rule.nodes[end].type === "atrule" &&
      rule.nodes[end].name === "apply" &&
      !rule.nodes[end].params.endsWith("!")
    )
      end++;
    const segment = rule.nodes.slice(start, end);
    if (segment.length > 1) {
      const combined = segment.map((node) => node.params).join(" ");
      const original = await compiled(
        `.probe { ${segment.map((node) => node.toString() + ";").join("\n")} }`,
      );
      const merged = await compiled(`.probe { @apply ${combined}; }`);
      const find = (tree) =>
        declarations(tree.nodes.find((node) => node.type === "rule" && node.selector === ".probe"));
      const canonical = (values) => [...values].sort((a, b) => a[0].localeCompare(b[0]));
      const props = find(original).map(([prop]) => prop);
      const overlaps = props.some((prop, index) =>
        props.some(
          (other, otherIndex) =>
            index !== otherIndex &&
            (prop === other || prop.startsWith(other + "-") || other.startsWith(prop + "-")),
        ),
      );
      if (
        !overlaps &&
        JSON.stringify(canonical(find(original))) === JSON.stringify(canonical(find(merged)))
      ) {
        segment[0].params = combined;
        segment.slice(1).forEach((node) => node.remove());
        start++;
        continue;
      }
    }
    start = end;
  }
}
migrated.walkRules((rule) => {
  if (rule.selector === "html") rule.selector = "html:where(:scope)";
  else
    rule.selector = rule.selector
      .replaceAll(":root", ":scope")
      .replace(/^\*(?=,|$)/, ":where(:scope), *");
});
const scoped = postcss.atRule({ name: "scope", params: "(:root[data-plan-catalogue])" });
scoped.append(migrated.nodes);
const fallbackFonts =
  '@scope (:root[data-plan-catalogue]) {\n  :scope {\n    --f-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;\n    --f-mono: "SF Mono", "SFMono-Regular", Consolas, Menlo, monospace;\n  }\n}\n';
const output =
  reference +
  "\n@layer base {\n  :root[data-plan-catalogue], :root[data-plan-catalogue] *, :root[data-plan-catalogue] #root, :root[data-plan-catalogue] *::before, :root[data-plan-catalogue] *::after, :root[data-plan-catalogue] *::selection, :root[data-plan-catalogue] *::-webkit-scrollbar, :root[data-plan-catalogue] *::-webkit-scrollbar-track, :root[data-plan-catalogue] *::-webkit-scrollbar-thumb, :root[data-plan-catalogue] *::-webkit-scrollbar-thumb:hover, :root[data-plan-catalogue] *::-webkit-scrollbar-corner {\n    all: revert-layer;\n  }\n}\n\n" +
  "@layer base {\n  @media (prefers-reduced-motion: reduce) {\n    :root[data-plan-catalogue], :root[data-plan-catalogue] *, :root[data-plan-catalogue] *::before, :root[data-plan-catalogue] *::after {\n      transition-duration: revert-layer !important;\n    }\n  }\n}\n\n" +
  scoped.toString() +
  "\n\n" +
  fallbackFonts;
if (options.write) await writeFile(resolve(directory, "styles.css"), output);
const actual = await compiled(await readFile(resolve(directory, "styles.css"), "utf8"));
const scope = actual.nodes.find((node) => node.type === "atrule" && node.name === "scope");
assert.ok(scope, "Catalogue styles must remain scoped");
function snapshot(container) {
  return container.nodes
    .filter((node) => node.type !== "comment")
    .map((node) => {
      if (node.type === "decl") return declaration(node);
      const children = snapshot(node);
      if (node.type === "rule") {
        const props = children.map((child) => child[0]);
        const overlaps = props.some((prop, index) =>
          props.some(
            (other, otherIndex) =>
              index !== otherIndex &&
              (prop === other || prop.startsWith(other + "-") || other.startsWith(prop + "-")),
          ),
        );
        const order = overlaps
          ? [...new Set(props)]
              .sort()
              .map((prop) => [
                prop,
                children.filter(
                  ([other]) =>
                    prop === other || prop.startsWith(other + "-") || other.startsWith(prop + "-"),
                ),
              ])
          : [];
        return [
          "rule",
          normalize(
            node.selector
              .replace(/^:where\(:scope\),\s*/, "")
              .replaceAll("html:where(:scope)", "html")
              .replaceAll(":scope", ":root"),
          ),
          [...children].sort((a, b) => a[0].localeCompare(b[0])),
          order,
        ];
      }
      return [node.name, normalize(node.params), children];
    });
}
assert.deepEqual(
  snapshot(scope),
  snapshot(baseline),
  "Compiled catalogue CSS must preserve every baseline declaration, selector, and condition",
);
console.log(
  JSON.stringify({
    rules: rules.length,
    namedUtilities: named,
    arbitraryProperties: arbitrary,
    customDeclarations: preserved,
    verified: true,
  }),
);
