import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.mjs", // merge.test.mjs runs under node:test, not Playwright
  timeout: 30000,
  retries: 0,
  reporter: [["list"]],
  use: {
    browserName: "chromium",
    viewport: { width: 1200, height: 1000 },
    acceptDownloads: true,
    // Optional: point at an existing Chromium instead of the one `npx playwright install` downloads.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
});
