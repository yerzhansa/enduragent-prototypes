import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parse } from "yaml";
import { uiIdentity, validateUiRelease } from "./ui-identity.mjs";

const arguments_ = process.argv.slice(2);
const allowLocal = arguments_.includes("--allow-local");
const directories = arguments_.filter((argument) => argument !== "--allow-local");
if (directories.length !== 1)
  throw new Error("Usage: pnpm check:ui-parity <other-consumer-directory> [--allow-local]");
const consumers = [process.cwd(), resolve(directories[0])];
const identities = consumers.map(uiIdentity);
if (!allowLocal) {
  for (const consumer of consumers) {
    let directory = consumer;
    while (!existsSync(join(directory, "pnpm-lock.yaml"))) {
      const parent = dirname(directory);
      if (parent === directory) throw new Error("Consumer has no pnpm lockfile");
      directory = parent;
    }
    const lock = parse(readFileSync(join(directory, "pnpm-lock.yaml"), "utf8"));
    const importer = relative(directory, consumer).replaceAll("\\", "/") || ".";
    validateUiRelease(uiIdentity(consumer), lock, importer);
  }
}
if (
  identities[0].version !== identities[1].version ||
  identities[0].contentSha256 !== identities[1].contentSha256
)
  throw new Error("Consumers have different UI package versions or contents");
process.stdout.write(
  `${JSON.stringify({ parity: "verified", localValidation: allowLocal, ui: { version: identities[0].version, contentSha256: identities[0].contentSha256 } }, null, 2)}\n`,
);
