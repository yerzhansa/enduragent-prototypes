import { readdirSync, readFileSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import ts from "typescript";

const root = resolve("src");
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
]);
const failures = [];
function visitDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) visitDirectory(path);
    else if (/\.[cm]?[jt]sx?$/.test(path)) {
      const source = ts.createSourceFile(
        path,
        readFileSync(path, "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      function inspect(node) {
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          const name = node.moduleSpecifier.text;
          if (name.startsWith(".")) {
            const target = relative(root, resolve(dirname(path), name));
            if (target.startsWith("..")) failures.push(`${path}: import leaves src: ${name}`);
          } else if (!allowedPackages.has(name))
            failures.push(`${path}: unsupported dependency ${name}`);
        }
        if (
          ts.isCallExpression(node) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(node.expression) && node.expression.text === "require"))
        )
          failures.push(`${path}: dynamic module loading`);
        if (ts.isIdentifier(node) && prohibited.has(node.text))
          failures.push(`${path}: forbidden browser or native API ${node.text}`);
        if (
          ts.isElementAccessExpression(node) &&
          ts.isStringLiteral(node.argumentExpression) &&
          prohibited.has(node.argumentExpression.text)
        )
          failures.push(`${path}: forbidden API access ${node.argumentExpression.text}`);
        ts.forEachChild(node, inspect);
      }
      inspect(source);
    }
  }
}
visitDirectory(root);
if (failures.length) throw new Error(failures.join("\n"));
process.stdout.write("Prototype source boundaries verified\n");
