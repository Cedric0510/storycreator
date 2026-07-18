import { defineConfig } from "@playwright/test";

const port = Number(process.env.LOAD_TEST_PORT ?? 3101);
const baseURL = process.env.LOAD_TEST_BASE_URL ?? `http://127.0.0.1:${port}`;
const useExternalServer = Boolean(process.env.LOAD_TEST_BASE_URL);
// 30 min: chaque cycle repart d'un projet vierge et reimporte tous les assets
// (l'import est une fusion depuis la refonte), ce qui rallonge le run complet.
const loadTestTimeoutMs = Number(process.env.LOAD_TEST_TIMEOUT_MS ?? 30 * 60 * 1000);

export default defineConfig({
  testDir: "./tests/load",
  testMatch: "**/*.pw.ts",
  outputDir: "test-results/load/artifacts",
  fullyParallel: false,
  workers: 1,
  timeout: Number.isFinite(loadTestTimeoutMs) ? loadTestTimeoutMs : 30 * 60 * 1000,
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
        env: {
          // Backend fake en memoire: pas de Supabase ni de credentials requis.
          NEXT_PUBLIC_BACKEND_MODE: "fake",
          // Build isole pour cohabiter avec un `next dev` local.
          NEXT_DIST_DIR: ".next-load",
        },
      },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
