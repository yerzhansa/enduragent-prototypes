import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const repository = fileURLToPath(new URL("..", import.meta.url));
const vite = join(repository, "node_modules/vite/bin/vite.js");

function builtIdentity(directory: string) {
  execFileSync(process.execPath, [vite, "build"], { cwd: directory, stdio: "pipe" });
  const output = join(directory, "dist");
  const identity = JSON.parse(readFileSync(join(output, "review-source.json"), "utf8"));
  const files = readdirSync(output, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== "review-source.json")
    .map((entry) => join(entry.parentPath, entry.name));
  const digests = Object.fromEntries(
    files.map((path) => [
      path.slice(output.length + 1).replaceAll("\\", "/"),
      createHash("sha256").update(readFileSync(path)).digest("hex"),
    ]),
  );
  expect(Object.keys(digests)).toContain("index.html");
  expect(Object.keys(digests)).toContain("experiments/plan-in-chat/index.html");
  expect(identity.outputs).toEqual(digests);
  return identity;
}

it("identifies every finalized file and distinguishes HTML-only edits at the same dirty revision", () => {
  const directory = mkdtempSync(join(tmpdir(), "prototype-build-identity-"));
  try {
    for (const path of [
      ".gitignore",
      "src",
      "experiments",
      "tools",
      "vite.config.ts",
      "index.html",
      "package.json",
      "pnpm-lock.yaml",
    ]) {
      cpSync(join(repository, path), join(directory, path), { recursive: true });
    }
    symlinkSync(join(repository, "node_modules"), join(directory, "node_modules"), "dir");
    execFileSync("git", ["init", "--quiet"], { cwd: directory });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Prototype Test",
        "-c",
        "user.email=prototype@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--quiet",
        "--allow-empty",
        "-m",
        "test: initialize fixture",
      ],
      { cwd: directory },
    );
    const first = builtIdentity(directory);
    const html = join(directory, "index.html");
    writeFileSync(
      html,
      readFileSync(html, "utf8").replace("Enduragent Prototypes", "Changed prototype title"),
    );
    const second = builtIdentity(directory);
    expect(first.dirty).toBe(true);
    expect(second.dirty).toBe(true);
    expect(second.revision).toBe(first.revision);
    expect(second.outputs["index.html"]).not.toBe(first.outputs["index.html"]);
    expect({
      ...second,
      outputs: { ...second.outputs, "index.html": first.outputs["index.html"] },
    }).toEqual(first);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 60_000);
