import { test as base, expect } from "@playwright/test";

import { readFixtures, type E2EFixtures } from "./support";

interface Telemetry {
  consoleEvents: string[];
  externalRequests: Set<string>;
  fontRequests: Set<string>;
}

type WorkerFixtures = {
  telemetry: Telemetry;
};

type TestFixtures = {
  fixtures: E2EFixtures;
};

const IGNORED_CONSOLE = [
  /React Router Future Flag Warning/,
  /Download the React DevTools/,
];

export const test = base.extend<TestFixtures, WorkerFixtures>({
  telemetry: [
    async ({}, use) => {
      await use({
        consoleEvents: [],
        externalRequests: new Set<string>(),
        fontRequests: new Set<string>(),
      });
    },
    { scope: "worker" },
  ],

  fixtures: async ({}, use) => {
    await use(readFixtures());
  },

  page: async ({ page, telemetry }, use) => {
    page.on("console", (message) => {
      if (message.type() !== "error" && message.type() !== "warning") return;
      const text = `console.${message.type()}: ${message.text()}`;
      if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) return;
      const location = message.location();
      telemetry.consoleEvents.push(
        `${text} (${location.url || "unknown"}:${location.lineNumber ?? 0})`,
      );
    });

    page.on("pageerror", (error) => {
      telemetry.consoleEvents.push(`pageerror: ${error.message}`);
    });

    page.on("requestfailed", (request) => {
      if (request.resourceType() === "font") {
        telemetry.consoleEvents.push(
          `font failed: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`,
        );
      }
    });

    page.on("request", (request) => {
      let url: URL;
      try {
        url = new URL(request.url());
      } catch {
        return;
      }
      if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
        telemetry.externalRequests.add(url.origin + url.pathname);
      }
      if (url.pathname.endsWith(".woff2")) {
        telemetry.fontRequests.add(url.pathname);
      }
    });

    await use(page);
  },
});

export { expect };
