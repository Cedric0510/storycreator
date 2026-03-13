import { defineConfig } from "@playwright/test";

const port = Number(process.env.LOAD_TEST_PORT ?? 3101);
const baseURL = process.env.LOAD_TEST_BASE_URL ?? `http://127.0.0.1:${port}`;
const useExternalServer = Boolean(process.env.LOAD_TEST_BASE_URL);
const loadTestTimeoutMs = Number(process.env.LOAD_TEST_TIMEOUT_MS ?? 15 * 60 * 1000);

export default defineConfig({
  testDir: "./tests/load",
  testMatch: "**/*.pw.ts",
  outputDir: "test-results/load/artifacts",
  fullyParallel: false,
  workers: 1,
  timeout: Number.isFinite(loadTestTimeoutMs) ? loadTestTimeoutMs : 15 * 60 * 1000,
  expect: {
    timeout: 20_000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "test-results/load/html", open: "never" }],
  ],
  use: {
    baseURL,
    headless: process.env.LOAD_TEST_HEADED ? false : true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      args: [
        "--enable-precise-memory-info",
        "--js-flags=--expose-gc",
      ],
    },
  },
  webServer: useExternalServer
    ? undefined
    : {
        command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
        url: baseURL,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
