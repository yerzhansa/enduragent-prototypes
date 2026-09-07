import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export function uiIdentity(consumerDirectory) {
  const consumer = resolve(consumerDirectory);
  const manifest = JSON.parse(readFileSync(join(consumer, "package.json"), "utf8"));
  const specification = manifest.dependencies?.["@enduragent/ui"];
  let directory = realpathSync(join(consumer, "node_modules/@enduragent/ui"));
  for (;;) {
    const candidate = join(directory, "package.json");
    if (existsSync(candidate)) {
      const installed = JSON.parse(readFileSync(candidate, "utf8"));
      if (installed.name === "@enduragent/ui") {
        if (typeof installed.version !== "string") throw new Error("Installed UI has no version");
        const hash = createHash("sha256");
        function add(relative) {
          const absolute = join(directory, relative);
          hash.update(relative).update("\0").update(readFileSync(absolute)).update("\0");
        }
        function visit(relative) {
          for (const entry of readdirSync(join(directory, relative), { withFileTypes: true }).sort(
            (a, b) => a.name.localeCompare(b.name, "en"),
          )) {
            const path = `${relative}/${entry.name}`;
            if (entry.isDirectory()) visit(path);
            else if (entry.isFile()) add(path);
            else throw new Error(`Unexpected UI artifact entry: ${path}`);
          }
        }
        add("package.json");
        visit("dist");
        return { version: installed.version, specification, contentSha256: hash.digest("hex") };
      }
    }
    const parent = dirname(directory);
    if (parent === directory) throw new Error("Cannot locate installed UI manifest");
    directory = parent;
  }
}

export function uiReleaseUrl(version) {
  if (
    typeof version !== "string" ||
    version.trim() !== version ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) ||
    version === "0.0.0" ||
    !version.split(".").every((component) => Number.isSafeInteger(Number(component)))
  )
    throw new Error("UI release version must be stable SemVer other than 0.0.0");
  return `https://github.com/yerzhansa/enduragent-ui/releases/download/v${version}/enduragent-ui-${version}.tgz`;
}

function hasPeerSuffix(value, url) {
  if (!value.startsWith(`${url}(`)) return false;
  let depth = 0;
  for (const character of value.slice(url.length)) {
    if (character === "(") depth += 1;
    else if (character === ")") {
      if (depth === 0) return false;
      depth -= 1;
    } else if (depth === 0 || !/[A-Za-z0-9@/._+:-]/.test(character)) return false;
  }
  return depth === 0 && !value.includes("()");
}

export function validateUiRelease(identity, lock, importer) {
  const url = uiReleaseUrl(identity.version);
  if (identity.specification !== url)
    throw new Error(
      "UI dependency must pin the exact GitHub release asset for its installed version",
    );
  const entry = lock?.importers?.[importer]?.dependencies?.["@enduragent/ui"];
  if (
    entry?.specifier !== url ||
    typeof entry?.version !== "string" ||
    (entry.version !== url && !hasPeerSuffix(entry.version, url))
  )
    throw new Error("UI lockfile importer must pin the exact GitHub release asset");
  const artifact = lock?.packages?.[`@enduragent/ui@${url}`];
  if (artifact?.resolution?.tarball !== url || artifact?.version !== identity.version)
    throw new Error("UI lockfile resolution must use the exact GitHub release asset");
  const integrity = artifact.resolution.integrity;
  if (
    typeof integrity !== "string" ||
    !/^sha512-[A-Za-z0-9+/]{86}==$/.test(integrity) ||
    Buffer.from(integrity.slice(7), "base64").toString("base64") !== integrity.slice(7)
  )
    throw new Error("UI lockfile resolution must include canonical SHA512 integrity");
  if (!Object.hasOwn(lock?.snapshots ?? {}, `@enduragent/ui@${entry.version}`))
    throw new Error("UI lockfile must include the imported release snapshot");
  return { url, integrity };
}
