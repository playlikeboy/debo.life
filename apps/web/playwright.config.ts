import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against a running app.
// Locally: `pnpm --filter @debo/web test:e2e` starts `next dev` on port 3000.
// Against the live site: BASE_URL=https://debo.life pnpm --filter @debo/web test:e2e
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

// Test helpers read the database URL from the repo-root .env (see e2e/helpers.ts).
try {
  process.loadEnvFile("../../.env");
} catch {
  // In CI the values come from the environment instead.
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  // `next dev` compiles each page and action on first use, which can be slow.
  expect: { timeout: 20_000 },
  retries: 0,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: "npx next dev -p 3000", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
