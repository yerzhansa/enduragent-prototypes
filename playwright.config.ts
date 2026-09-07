import { defineConfig } from "@playwright/test";

const port = 5192;
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: "chromium",
    locale: "en-US",
    timezoneId: "UTC",
    deviceScaleFactor: 1,
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
  },
  projects: [
    { name: "wide-light", use: { viewport: { width: 1180, height: 820 }, colorScheme: "light" } },
    { name: "wide-dark", use: { viewport: { width: 1180, height: 820 }, colorScheme: "dark" } },
    { name: "compact-light", use: { viewport: { width: 760, height: 760 }, colorScheme: "light" } },
    { name: "compact-dark", use: { viewport: { width: 760, height: 760 }, colorScheme: "dark" } },
  ],
  webServer: {
    command: `pnpm exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
