import { readdirSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { checkPlanCatalogue, inspectSourceBoundaries } from "./check-plan-catalogue.mjs";

const root = resolve("src");
const failures = [];
function visitDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) visitDirectory(path);
    else if (/\.[cm]?[jt]sx?$/.test(path)) {
      failures.push(
        ...inspectSourceBoundaries(readFileSync(path, "utf8"), {
          fileName: path,
          sourceRoot: root,
          allowCatalogueStorage: relative(root, path) === "plan-catalogue/controller.ts",
        }),
      );
    }
  }
}
visitDirectory(root);
checkPlanCatalogue(resolve(root, "plan-catalogue"));
if (failures.length) throw new Error(failures.join("\n"));
process.stdout.write("Prototype source boundaries verified\n");
