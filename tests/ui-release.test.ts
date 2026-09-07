import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { uiIdentity, uiReleaseUrl, validateUiRelease } from "../tools/ui-identity.mjs";

const version = "0.1.0";
const url = uiReleaseUrl(version);
const integrity = `sha512-${Buffer.alloc(64, 4).toString("base64")}`;
function fixture() {
  return {
    identity: { version, specification: url },
    lock: {
      importers: { ".": { dependencies: { "@enduragent/ui": { specifier: url, version: url } } } },
      packages: { [`@enduragent/ui@${url}`]: { version, resolution: { tarball: url, integrity } } },
      snapshots: { [`@enduragent/ui@${url}`]: {} },
    },
  };
}

describe("GitHub UI release pin", () => {
  it.each(["0.1.0", "0.1.1", "0.2.0", "1.0.0", "1.10.0", "9007199254740991.0.0"])(
    "accepts stable SemVer %s",
    (release) => {
      expect(uiReleaseUrl(release)).toBe(
        `https://github.com/yerzhansa/enduragent-ui/releases/download/v${release}/enduragent-ui-${release}.tgz`,
      );
    },
  );
  it.each([
    "0.0.0",
    "00.1.0",
    "0.01.0",
    "0.1.00",
    "0.1",
    "0.1.0.0",
    "-1.0.0",
    "0.-1.0",
    "0.1.-1",
    "0.1.0-1",
    "0.1.0-beta",
    "0.1.0+build",
    "^0.1.0",
    "~0.1.0",
    "1.x",
    "latest",
    "unreleased",
    "v0.1.0",
    "9007199254740992.0.0",
    "0.9007199254740992.0",
    "0.1.9007199254740992",
    "0.1.0\n",
    "0.1.0 ",
    " 0.1.0",
  ])("rejects version %s", (release) => {
    expect(() => uiReleaseUrl(release)).toThrow();
  });
  it("accepts the matching URL, package version, snapshot, and SHA512 pin", () => {
    const { identity, lock } = fixture();
    expect(validateUiRelease(identity, lock, ".")).toEqual({ url, integrity });
  });
  it("accepts a peer-qualified importer snapshot", () => {
    const { identity, lock } = fixture();
    const resolved = `${url}(react-dom@19.2.8(react@19.2.8))(react@19.2.8)`;
    lock.importers["."].dependencies["@enduragent/ui"].version = resolved;
    lock.snapshots = { [`@enduragent/ui@${resolved}`]: {} };
    expect(validateUiRelease(identity, lock, ".")).toEqual({ url, integrity });
  });
  it.each([
    "0.1.0",
    "^0.1.0",
    "latest",
    "file:ui.tgz",
    "link:../ui",
    "git+https://github.com/yerzhansa/enduragent-ui.git#main",
    url.replace("github.com", "example.com"),
    url.replace("/v0.1.0/", "/latest/"),
    url.replace("ui-0.1.0.tgz", "ui-0.2.0.tgz"),
    `${url}?download=1`,
    `${url}\n`,
    `${url} `,
    `${url}#hash`,
    url.replace("https:", "http:"),
  ])("rejects dependency %s", (specification) => {
    const { identity, lock } = fixture();
    expect(() => validateUiRelease({ ...identity, specification }, lock, ".")).toThrow();
  });
  it("rejects a different installed version", () => {
    const { identity, lock } = fixture();
    expect(() => validateUiRelease({ ...identity, version: "0.2.0" }, lock, ".")).toThrow();
  });
  it("selects the exact consumer importer", () => {
    const { identity, lock } = fixture();
    expect(() => validateUiRelease(identity, lock, "apps/desktop-renderer")).toThrow();
  });
  it.each([
    `${url}(react@19`,
    `${url}()`,
    `${url}(react@19)garbage`,
    `${url}(https://example.com?a)`,
  ])("rejects malformed peer resolution %s", (resolved) => {
    const { identity, lock } = fixture();
    lock.importers["."].dependencies["@enduragent/ui"].version = resolved;
    lock.snapshots = { [`@enduragent/ui@${resolved}`]: {} };
    expect(() => validateUiRelease(identity, lock, ".")).toThrow();
  });
  it.each(["specifier", "version"])("rejects changed importer %s", (field) => {
    const { identity, lock } = fixture();
    lock.importers["."].dependencies["@enduragent/ui"] = {
      specifier: url,
      version: url,
      [field]: "latest",
    };
    expect(() => validateUiRelease(identity, lock, ".")).toThrow();
  });
  it.each(["", "sha256-YWJj", `sha512-${"A".repeat(88)}`, `sha512-${"A".repeat(85)}B==`])(
    "rejects integrity %s",
    (invalid) => {
      const { identity, lock } = fixture();
      lock.packages = {
        [`@enduragent/ui@${url}`]: { version, resolution: { tarball: url, integrity: invalid } },
      };
      expect(() => validateUiRelease(identity, lock, ".")).toThrow();
    },
  );
  it("rejects a mismatched resolution URL or package version", () => {
    const { identity, lock } = fixture();
    lock.packages = {
      [`@enduragent/ui@${url}`]: { version: "0.2.0", resolution: { tarball: url, integrity } },
    };
    expect(() => validateUiRelease(identity, lock, ".")).toThrow();
    lock.packages = {
      [`@enduragent/ui@${url}`]: {
        version,
        resolution: { tarball: "https://example.com/ui.tgz", integrity },
      },
    };
    expect(() => validateUiRelease(identity, lock, ".")).toThrow();
  });
  it("rejects a missing release snapshot", () => {
    const { identity, lock } = fixture();
    lock.snapshots = {};
    expect(() => validateUiRelease(identity, lock, ".")).toThrow();
  });
  it.each([null, {}, { importers: [] }])("rejects an incomplete lockfile", (lock) => {
    expect(() => validateUiRelease(fixture().identity, lock, ".")).toThrow();
  });
});

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
it("retains installed content identity and detects changed bytes", () => {
  const consumer = mkdtempSync(join(tmpdir(), "ui-release-identity-"));
  directories.push(consumer);
  const installed = join(consumer, "node_modules/@enduragent/ui");
  mkdirSync(join(installed, "dist"), { recursive: true });
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ dependencies: { "@enduragent/ui": url } }),
  );
  writeFileSync(
    join(installed, "package.json"),
    JSON.stringify({ name: "@enduragent/ui", version }),
  );
  writeFileSync(join(installed, "dist/index.js"), "export const value = 1;");
  const before = uiIdentity(consumer);
  expect(before.version).toBe(version);
  expect(before.specification).toBe(url);
  expect(before.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  writeFileSync(join(installed, "dist/index.js"), "export const value = 2;");
  expect(uiIdentity(consumer).contentSha256).not.toBe(before.contentSha256);
});

function consumerFixture(specification: string) {
  const consumer = mkdtempSync(join(tmpdir(), "ui-release-consumer-"));
  directories.push(consumer);
  const installed = join(consumer, "node_modules/@enduragent/ui");
  mkdirSync(join(installed, "dist"), { recursive: true });
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ dependencies: { "@enduragent/ui": specification } }),
  );
  writeFileSync(
    join(installed, "package.json"),
    JSON.stringify({ name: "@enduragent/ui", version }),
  );
  writeFileSync(join(installed, "dist/index.js"), "export const value = 1;");
  writeFileSync(join(consumer, "pnpm-lock.yaml"), stringify(fixture().lock));
  return consumer;
}
const parityCommand = fileURLToPath(new URL("../tools/check-ui-parity.mjs", import.meta.url));
it("checks both actual consumers through the CLI", () => {
  const first = consumerFixture(url);
  const second = consumerFixture(url);
  const result = execFileSync(process.execPath, [parityCommand, second], {
    cwd: first,
    encoding: "utf8",
  });
  expect(JSON.parse(result)).toMatchObject({
    parity: "verified",
    localValidation: false,
    ui: { version },
  });
  writeFileSync(
    join(second, "node_modules/@enduragent/ui/dist/index.js"),
    "export const value = 2;",
  );
  expect(() =>
    execFileSync(process.execPath, [parityCommand, second], { cwd: first, stdio: "pipe" }),
  ).toThrow();
});
it("requires the explicit local flag to bypass release validation", () => {
  const first = consumerFixture("file:ui.tgz");
  const second = consumerFixture("file:ui.tgz");
  expect(() =>
    execFileSync(process.execPath, [parityCommand, second], { cwd: first, stdio: "pipe" }),
  ).toThrow();
  const result = execFileSync(process.execPath, [parityCommand, second, "--allow-local"], {
    cwd: first,
    encoding: "utf8",
  });
  expect(JSON.parse(result)).toMatchObject({ parity: "verified", localValidation: true });
});

it("rejects comparison with the same consumer, including symlink aliases", () => {
  const consumer = consumerFixture(url);
  const alias = join(consumer, "alias");
  symlinkSync(consumer, alias, "dir");
  for (const target of [".", consumer, alias]) {
    expect(() =>
      execFileSync(process.execPath, [parityCommand, target], { cwd: consumer, stdio: "pipe" }),
    ).toThrow("UI parity requires two distinct consumers");
  }
});
