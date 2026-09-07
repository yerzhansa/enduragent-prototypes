import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import ts from "typescript";

const storageNamespace = "enduragent-fictional-plan-catalogue-v1";
const allowedPackages = new Set(["react", "react-dom/client", "@enduragent/ui"]);
const prohibited = new Set([
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "cookie",
  "enduragentAuth",
  "electron",
  "sendBeacon",
  "serviceWorker",
  "innerHTML",
  "outerHTML",
  "insertAdjacentHTML",
  "dangerouslySetInnerHTML",
  "DOMParser",
  "parseHTMLUnsafe",
  "setHTMLUnsafe",
  "srcdoc",
  "srcDoc",
  "iframe",
  "eval",
  "Function",
]);

function walk(node, inspect) {
  inspect(node);
  ts.forEachChild(node, (child) => walk(child, inspect));
}

function literalText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = literalText(node.left);
    const right = literalText(node.right);
    if (left !== undefined && right !== undefined) return left + right;
  }
  return undefined;
}

function storageAllowance(source, failures) {
  const declarations = [];
  walk(source, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "storageKey"
    )
      declarations.push(node);
  });
  const declaration = declarations[0];
  const validDeclaration =
    declarations.length === 1 &&
    declaration.initializer &&
    ts.isStringLiteral(declaration.initializer) &&
    declaration.initializer.text === storageNamespace &&
    ts.isVariableDeclarationList(declaration.parent) &&
    (declaration.parent.flags & ts.NodeFlags.Const) !== 0 &&
    ts.isVariableStatement(declaration.parent.parent) &&
    declaration.parent.parent.parent === source;
  if (!validDeclaration)
    failures.push("storageKey must be one top-level const with the fictional namespace");
  const approved = new Set();
  const keys = new Set(validDeclaration ? [declaration.name] : []);
  walk(source, (node) => {
    if (!ts.isCallExpression(node) || node.questionDotToken) return;
    const method = node.expression;
    if (
      !ts.isPropertyAccessExpression(method) ||
      method.questionDotToken ||
      !ts.isIdentifier(method.expression) ||
      method.expression.text !== "localStorage"
    )
      return;
    const key = node.arguments[0];
    const count = method.name.text === "getItem" ? 1 : method.name.text === "setItem" ? 2 : 0;
    if (
      validDeclaration &&
      count &&
      node.arguments.length === count &&
      key &&
      ts.isIdentifier(key) &&
      key.text === "storageKey" &&
      !node.arguments.some(ts.isSpreadElement)
    ) {
      approved.add(method.expression);
      keys.add(key);
    } else
      failures.push(
        "Only direct getItem(storageKey) and setItem(storageKey, value) calls are allowed",
      );
  });
  walk(source, (node) => {
    if (ts.isIdentifier(node) && node.text === "storageKey" && !keys.has(node))
      failures.push(
        "storageKey cannot be aliased, shadowed, reassigned, or used outside the storage calls",
      );
  });
  return approved;
}

export function inspectSourceBoundaries(
  text,
  { fileName, sourceRoot, allowCatalogueStorage = false },
) {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const failures = [];
  const approvedStorage = allowCatalogueStorage ? storageAllowance(source, failures) : new Set();
  walk(source, (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const name = node.moduleSpecifier.text;
      if (name.startsWith(".")) {
        const target = relative(sourceRoot, resolve(dirname(fileName), name));
        if (target.startsWith("..")) failures.push(`import leaves src: ${name}`);
        if (
          /\.(?:[cm]?js|html?)(?:[?#]|$)/i.test(name) ||
          /(?:^|\/)(?:experiments|legacy)(?:\/|$)/i.test(name)
        )
          failures.push(`legacy runtime import: ${name}`);
      } else if (!allowedPackages.has(name)) failures.push(`unsupported dependency ${name}`);
    }
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    )
      failures.push("dynamic module loading");
    if (ts.isIdentifier(node) && prohibited.has(node.text) && !approvedStorage.has(node))
      failures.push(`forbidden browser or native API ${node.text}`);
    if (ts.isElementAccessExpression(node)) {
      const name = literalText(node.argumentExpression);
      if (name && prohibited.has(name)) failures.push(`forbidden API access ${name}`);
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "document" &&
      ["write", "writeln"].includes(node.name.text)
    )
      failures.push("HTML document writer");
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ["script", "iframe"].includes(node.tagName.getText(source))
    )
      failures.push("embedded HTML runtime");
    if (
      ts.isStringLiteralLike(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      if (/<\/?[a-z][^>]*>/i.test(node.text))
        failures.push("HTML markup string; render JSX instead");
      if (node.text === "iframe" || node.text === "script") failures.push("embedded HTML runtime");
    }
  });
  return failures.map((message) => `${fileName}: ${message}`);
}

function sourceFacts(fileName, text) {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const imports = new Map();
  const jsx = new Set();
  const calls = new Set();
  walk(source, (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !node.importClause?.isTypeOnly
    ) {
      const names = node.importClause?.namedBindings;
      if (names && ts.isNamedImports(names))
        for (const name of names.elements) {
          if (!name.isTypeOnly)
            imports.set(name.name.text, {
              module: node.moduleSpecifier.text,
              exported: name.propertyName?.text || name.name.text,
            });
        }
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      jsx.add(node.tagName.getText(source));
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression))
      calls.add(node.expression.text);
  });
  return { source, imports, jsx, calls };
}

function requireUse(facts, exported, module, uses) {
  assert.ok(
    [...facts.imports].some(
      ([local, imported]) =>
        imported.module === module && imported.exported === exported && uses.has(local),
    ),
    `${exported} must be imported from ${module} and used in the React catalogue`,
  );
}

export function checkPlanCatalogue(directory) {
  const required = [
    "PlanCatalogue.tsx",
    "view.tsx",
    "controller.ts",
    "model.ts",
    "scenarios.ts",
    "types.ts",
    "ui-types.ts",
    "styles.css",
  ];
  const files = new Map();
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    assert.ok(entry.isFile(), `The React catalogue must contain regular files: ${entry.name}`);
    assert.match(
      entry.name,
      /\.(?:tsx?|css)$/,
      `Only typed React modules and styles belong in the catalogue: ${entry.name}`,
    );
    files.set(entry.name, readFileSync(resolve(directory, entry.name), "utf8"));
  }
  for (const name of required)
    assert.ok(files.has(name), `Missing React catalogue module: ${name}`);
  const failures = [];
  for (const [name, text] of files)
    if (/\.tsx?$/.test(name)) {
      failures.push(
        ...inspectSourceBoundaries(text, {
          fileName: resolve(directory, name),
          sourceRoot: dirname(resolve(directory)),
          allowCatalogueStorage: name === "controller.ts",
        }),
      );
    }
  assert.equal(failures.length, 0, failures.join("\n"));
  const view = sourceFacts(resolve(directory, "view.tsx"), files.get("view.tsx"));
  const shell = sourceFacts(
    resolve(directory, "PlanCatalogue.tsx"),
    files.get("PlanCatalogue.tsx"),
  );
  const controller = sourceFacts(resolve(directory, "controller.ts"), files.get("controller.ts"));
  assert.ok(
    shell.jsx.size && view.jsx.size,
    "The catalogue shell and views must render actual JSX",
  );
  for (const name of [
    "PlanAction",
    "PlanChoiceOption",
    "PlanEvidenceRow",
    "PlanEvidenceTable",
    "PlanProjectionCard",
    "PlanResultNotice",
  ])
    requireUse(view, name, "@enduragent/ui", view.jsx);
  requireUse(shell, "useCatalogueController", "./controller", shell.calls);
  requireUse(shell, "createCatalogueView", "./view", shell.calls);
  requireUse(controller, "useState", "react", controller.calls);
  const stylesheet = shell.source.statements.some(
    (node) =>
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === "./styles.css",
  );
  assert.ok(stylesheet, "The React catalogue must import its Tailwind stylesheet");
  const styles = files.get("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(
    styles,
    /@reference\s+["']\.\.\/styles\.css["']\s*;/,
    "Catalogue styles must reference the shared Tailwind entry",
  );
  assert.match(styles, /@apply\s+[^;]+;/, "Catalogue styles must use Tailwind utilities");
  assert.doesNotMatch(
    styles,
    /@import\s|url\(\s*["']?(?:https?:|data:)/i,
    "Catalogue styles cannot load another runtime or remote resources",
  );
}
