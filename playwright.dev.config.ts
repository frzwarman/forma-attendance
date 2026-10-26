import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Runs the public page against the Expo development server (Metro in dev mode),
// which bundles differently from `expo export`.
export default defineConfig({
  ...base,
  testMatch: ["dev-server.spec.ts"],
  testIgnore: [],
  timeout: 180000,
  use: { ...base.use, baseURL: "http://localhost:8090" },
  webServer: {
    command: "npm run web -- --port 8090",
    url: "http://localhost:8090",
    reuseExistingServer: true,
    timeout: 180000,
    env: { CI: "1" },
  },
});
