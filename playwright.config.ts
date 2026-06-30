import { defineConfig, devices } from "@playwright/test";
import path from "path";
import fs from "fs";

// Load .env.local so SUPABASE_SERVICE_ROLE_KEY etc are available to global-setup
const envFile = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: "http://localhost:3003",
    storageState: "tests/.auth.json",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  globalSetup: "./tests/global-setup.ts",

  webServer: {
    command: "PORT=3003 npm run dev",
    url: "http://localhost:3003",
    reuseExistingServer: true,
    timeout: 90_000,
  },
});
