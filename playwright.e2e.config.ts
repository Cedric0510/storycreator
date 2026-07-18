import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3202);
const baseURL = `http://127.0.0.1:${port}`;

/**
 * Smoke e2e du parcours coeur du studio (connexion, export, import, preview).
 * Le serveur tourne avec NEXT_PUBLIC_BACKEND_MODE=fake: aucun Supabase requis,
 * le backend est le fake en memoire de src/lib/backend/fakeBackend.ts.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.pw.ts",
  outputDir: "test-results/e2e/artifacts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "test-results/e2e/html", open: "never" }],
  ],
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_BACKEND_MODE: "fake",
      // Build isole pour pouvoir tourner en parallele d'un `next dev` local.
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
