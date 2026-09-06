import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { uiIdentity } from "./tools/ui-identity.mjs";
import { createHash } from "node:crypto";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

const ui = uiIdentity(fileURLToPath(new URL(".", import.meta.url)));
const uiVersion = ui.version;
const lockfileSha256 = createHash("sha256")
  .update(readFileSync(new URL("./pnpm-lock.yaml", import.meta.url)))
  .digest("hex");
const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const dirty =
  execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], {
    encoding: "utf8",
  }).trim().length > 0;

export default defineConfig({
  plugins: [
    react(),
    tailwind(),
    {
      name: "prototype-build-identity",
      generateBundle(_options, bundle) {
        const outputs = Object.fromEntries(
          Object.entries(bundle).map(([name, output]) => [
            name,
            createHash("sha256")
              .update(output.type === "chunk" ? output.code : output.source)
              .digest("hex"),
          ]),
        );
        this.emitFile({
          type: "asset",
          fileName: "review-source.json",
          source: JSON.stringify(
            {
              schemaVersion: 1,
              repository: "yerzhansa/enduragent-prototypes",
              revision,
              dirty,
              uiVersion,
              uiContentSha256: ui.contentSha256,
              lockfileSha256,
              outputs,
            },
            null,
            2,
          ),
        });
      },
    },
  ],
  define: {
    __UI_VERSION__: JSON.stringify(uiVersion),
    __SOURCE_REVISION__: JSON.stringify(`${revision}${dirty ? " (uncommitted changes)" : ""}`),
  },
  server: { host: "127.0.0.1", strictPort: true },
});
