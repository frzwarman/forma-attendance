import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["dev-server.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 1100 },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
      args: ["--use-fake-device-for-media-stream"],
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve-web.cjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 20000,
  },
  reporter: "list",
});
