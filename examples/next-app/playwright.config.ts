import { defineConfig } from "@playwright/test";

// Optional. Install browsers first: `pnpm dlx playwright install chromium`.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:3100" },
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
