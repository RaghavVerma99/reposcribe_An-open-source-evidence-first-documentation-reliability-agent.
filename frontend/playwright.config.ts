import path from "node:path";

import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:8000";
const port = new URL(baseURL).port || "8000";

// System Chrome is available on developer machines and on GitHub's Ubuntu
// runners, so the default run does not download a browser. Set
// PLAYWRIGHT_CHANNEL=chromium to use a locally installed Playwright Chromium.
const requestedChannel = process.env.PLAYWRIGHT_CHANNEL ?? "chrome";
const channel = requestedChannel === "chromium" ? undefined : requestedChannel;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [
        ["list"],
        ["html", { open: "never" }],
      ]
    : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    storageState: path.resolve("e2e/.generated/storage-state.json"),
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(channel ? { channel } : {}),
  },
  projects: [{ name: channel ?? "chromium" }],
  webServer: {
    command: "node e2e/start-backend.mjs",
    url: `${baseURL}/api/v1/health`,
    // Always start the server described here. Reusing a developer's backend
    // could silently change the provider mode or workspace root and make the
    // suite pass or fail for reasons the config does not describe.
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      E2E_PORT: port,
      WORKSPACE_ROOT:
        process.env.WORKSPACE_ROOT ?? path.resolve("e2e/.generated/workspaces"),
      FRONTEND_ORIGIN: baseURL,
      MODEL_PROVIDER: "local_demo",
      REPOSCRIBE_LOG_LEVEL: "WARNING",
    },
  },
});
