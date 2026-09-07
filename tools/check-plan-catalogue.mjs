import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function checkPlanCatalogue(directory, identity) {
  const names = ["index.html", "model.mjs", "prototype.css", "prototype.js", "scenarios.mjs"];
  const entries = readdirSync(directory, { withFileTypes: true });
  assert.deepEqual(entries.map((entry) => entry.name).sort(), names);
  assert.deepEqual(Object.keys(identity).sort(), names);
  for (const entry of entries) {
    assert.ok(entry.isFile(), `The frozen catalogue must contain regular files: ${entry.name}`);
    let bytes = readFileSync(join(directory, entry.name));
    if (entry.name === "index.html") {
      const html = bytes.toString("utf8");
      const moduleScript = '<script type="module" src=';
      assert.equal(html.split(moduleScript).length, 2, "The catalogue needs one module entry");
      bytes = Buffer.from(html.replace(moduleScript, "<script src="));
    }
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      identity[entry.name],
      `Frozen catalogue source changed: ${entry.name}`,
    );
  }
}
