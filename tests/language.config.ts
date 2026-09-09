import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import config from "../playwright.config";

export default defineConfig({
  ...config,
  testDir: ".",
  testMatch: "language.spec.ts",
  outputDir: "../test-results/language",
  webServer: {
    ...config.webServer,
    command: "pnpm exec vite preview --host 127.0.0.1 --port 5192 --strictPort",
    cwd: fileURLToPath(new URL("..", import.meta.url)),
  },
});
