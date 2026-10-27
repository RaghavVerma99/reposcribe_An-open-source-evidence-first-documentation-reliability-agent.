import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

/**
 * The original 39-check headless smoke pass, now repo-contained, plus a landing
 * layout guard at 1440 px, 360 px, and under reduced motion. Each numbered
 * comment maps to one check from the original pass:
 *
 *  1-3   landing title, self-hosted fonts, heading font
 *  40-42 landing narrative: desktop, mobile, and reduced-motion layout
 *  4-21  six workspace routes: title, no horizontal overflow, headings present
 *  22-24 overview labels (indexed files, limitations, no stale wording)
 *  25    findings URL state (?status= and ?q=)
 *  26-28 Ask example, grounded answer, mode-aware provider copy
 *  29-30 finding dismiss and reopen
 *  31-33 mobile drawer open/focus trap/close-and-restore
 *  34-36 360 px route layout at overview, findings, and ask
 *  37    no external network requests
 *  38    self-hosted font files requested
 *  39    no console errors or warnings
 *
 * Checks 37-39 read worker-scoped telemetry collected by every page opened in
 * this file, so run the whole file (the config uses one worker) rather than a
 * single test in isolation.
 */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect.soft(metrics.scrollWidth, `${label} must not overflow horizontally`).toBeLessThanOrEqual(
    metrics.innerWidth + 1,
  );
}

test("landing page renders the editorial shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1").first()).toBeVisible();

  // 1: landing title.
  await expect(page).toHaveTitle("RepoScribe — Documentation that doesn't lie");

  // 2: all four self-hosted font families are active.
  const fontState = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      inter: document.fonts.check("16px Inter"),
      bricolage: document.fonts.check('16px "Bricolage Grotesque"'),
      mono: document.fonts.check('16px "JetBrains Mono"'),
      caveat: document.fonts.check("16px Caveat"),
      status: document.fonts.status,
    };
  });
  expect
    .soft(
      fontState.inter && fontState.bricolage && fontState.mono && fontState.caveat,
      `self-hosted fonts active: ${JSON.stringify(fontState)}`,
    )
    .toBe(true);

  // 3: the display font is applied to the main heading.
  const headingFont = await page.locator("h1").first().evaluate((element) => {
    return getComputedStyle(element).fontFamily;
  });
  expect.soft(headingFont, "heading font computed").toMatch(/Bricolage/i);
});

test("landing narrative holds its layout across widths and reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("h1").first()).toBeVisible();
  await expectNoHorizontalOverflow(page, "landing at 1440");

  await page.locator("#drift").scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("heading", { name: /A doc line and a code line disagree/i }),
  ).toBeVisible();

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.locator("h1").first()).toBeVisible();
  await expectNoHorizontalOverflow(page, "landing at 360");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator("h1")).toContainText("Docs drift");
  await expectNoHorizontalOverflow(page, "landing with reduced motion");
});

test("workspace routes have titles, headings, and no horizontal overflow", async ({
  page,
  fixtures,
}) => {
  const routes = [
    {
      path: `/r/${fixtures.repository.id}`,
      title: "overview",
      label: "overview",
    },
    {
      path: `/r/${fixtures.repository.id}/findings`,
      title: "findings",
      label: "findings",
    },
    {
      path: `/r/${fixtures.repository.id}/findings/${fixtures.finding.id}`,
      title: `${fixtures.finding.title} · RepoScribe`,
      label: "finding detail",
    },
    {
      path: `/r/${fixtures.repository.id}/patches/${fixtures.patch.id}`,
      title: `Patch · ${fixtures.patch.target_path}`,
      label: "patch",
    },
    {
      path: `/r/${fixtures.repository.id}/ask`,
      title: "Ask RepoScribe",
      label: "ask",
    },
    {
      path: `/r/${fixtures.repository.id}/settings`,
      title: "settings",
      label: "settings",
    },
  ];

  for (const route of routes) {
    await test.step(route.label, async () => {
      await page.goto(route.path);
      await expect(page.locator("h1").first()).toBeVisible();

      // Checks 4, 7, 10, 13, 16, 19: route title.
      await expect(page).toHaveTitle(new RegExp(escapeRegExp(route.title)));

      // Checks 5, 8, 11, 14, 17, 20: no horizontal overflow at 1440 px.
      await expectNoHorizontalOverflow(page, route.label);

      // Checks 6, 9, 12, 15, 18, 21: headings are present.
      const headingCount = await page.locator("h1, h2").count();
      expect.soft(headingCount, `${route.label} must render headings`).toBeGreaterThan(0);
    });
  }
});

test("overview labels report indexed files and limitations honestly", async ({
  page,
  fixtures,
}) => {
  await page.goto(`/r/${fixtures.repository.id}`);
  await expect(page.getByRole("heading", { name: "Repository overview" })).toBeVisible();

  const text = await page.locator("body").innerText();

  // 22: files-indexed label.
  expect.soft(text, "overview files-indexed label").toMatch(/files indexed/i);

  // 23: limitations are surfaced.
  expect.soft(text, "overview limitations label").toMatch(/limitations/i);

  // 24: the old, misleading label is gone.
  expect.soft(text, "overview must not use the stale inspected label").not.toMatch(
    /files inspected/i,
  );
});

test("findings page adopts URL search and status filters", async ({ page, fixtures }) => {
  await page.goto(`/r/${fixtures.repository.id}/findings?status=verified&q=README`);
  await expect(page.getByRole("heading", { name: "Audit findings" })).toBeVisible();

  await expect(page.locator("#finding-search")).toHaveValue("README");
  await expect(page.locator("#filter-status")).toHaveValue("verified");

  // 25: URL state applied to the inputs and kept in the address bar.
  const urlState = await page.evaluate(() => ({
    query: (document.querySelector("#finding-search") as HTMLInputElement | null)?.value ?? null,
    status: (document.querySelector("#filter-status") as HTMLSelectElement | null)?.value ?? null,
    search: location.search,
  }));
  expect.soft(urlState.query, "findings URL query").toBe("README");
  expect.soft(urlState.status, "findings URL status").toBe("verified");
  expect.soft(urlState.search, "findings URL search string").toContain("status=verified");
  expect.soft(urlState.search, "findings URL search string").toContain("q=README");
});

test("Ask renders a grounded local-demo answer", async ({ page, fixtures }) => {
  await page.goto(`/r/${fixtures.repository.id}/ask`);
  await expect(page.getByRole("heading", { name: "Ask RepoScribe" })).toBeVisible();

  const example = page.getByRole("button", {
    name: "Which endpoints does this service expose?",
  });
  await expect(example).toBeEnabled();
  await example.click();

  // 26: example question submitted and echoed in the transcript.
  await expect(
    page.getByRole("heading", { name: "Which endpoints does this service expose?" }),
  ).toBeVisible();

  // 27: an answer with citations (or an explicit no-evidence statement) appears.
  await expect(
    page.getByText(/Citations|No retrieved excerpt matched/i).first(),
  ).toBeVisible({ timeout: 20_000 });

  // 28: provider copy identifies the local demo mode.
  const text = await page.locator("body").innerText();
  expect.soft(text, "ask provider copy is mode-aware").toContain("Local demo mode");
});

test("finding can be dismissed and reopened", async ({ page, fixtures }) => {
  await page.goto(
    `/r/${fixtures.repository.id}/findings/${fixtures.finding.id}`,
  );

  const dismiss = page.getByRole("button", { name: "Dismiss finding" });
  await expect(dismiss).toBeVisible();
  await dismiss.click();

  // 29: dismissed state is persisted and reflected in the UI.
  await expect(page.getByRole("button", { name: "Reopen finding" })).toBeVisible();
  await expect(page.getByText("Dismissed", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Reopen finding" }).click();

  // 30: reopening restores the status the finding held before it was dismissed.
  const reopenedLabel =
    fixtures.finding.status === "verified"
      ? "Verified"
      : fixtures.finding.status === "insufficient_evidence"
        ? "Insufficient evidence"
        : "Needs review";
  await expect(page.getByRole("button", { name: "Dismiss finding" })).toBeVisible();
  await expect(page.getByText(reopenedLabel, { exact: true }).first()).toBeVisible();
});

test("mobile drawer opens with focus, traps Tab, and restores focus", async ({
  page,
  fixtures,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`/r/${fixtures.repository.id}`);

  const openButton = page.getByRole("button", { name: "Open navigation" });
  const dialog = page.getByRole("dialog", { name: "Navigation" });

  await expect(openButton).toBeVisible();
  await openButton.click();
  await expect(dialog).toBeVisible();

  // 31: the drawer is modal, marks the trigger, locks scroll, and moves focus.
  await expect(openButton).toHaveAttribute("aria-expanded", "true");
  await expect(openButton).toHaveAttribute("aria-controls", "mobile-navigation");
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const open = document.querySelector('[role="dialog"][aria-label="Navigation"]');
        return Boolean(open?.contains(document.activeElement));
      }),
    )
    .toBe(true);
  const openState = await page.evaluate(() => {
    const open = document.querySelector('[role="dialog"][aria-label="Navigation"]');
    return {
      bodyOverflow: document.body.style.overflow,
      activeInside: Boolean(open?.contains(document.activeElement)),
    };
  });
  expect.soft(openState.bodyOverflow, "drawer locks body scroll").toBe("hidden");
  expect.soft(openState.activeInside, "drawer moves focus inside").toBe(true);

  // 32: Tab stays within the dialog.
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab");
  }
  const trapped = await page.evaluate(() => {
    const open = document.querySelector('[role="dialog"][aria-label="Navigation"]');
    return {
      inside: Boolean(open?.contains(document.activeElement)),
      tag: document.activeElement?.tagName ?? null,
    };
  });
  expect.soft(trapped.inside, `drawer traps Tab focus: ${JSON.stringify(trapped)}`).toBe(true);

  // 33: Escape closes, unlocks scroll, and restores focus to the trigger.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(openButton).toHaveAttribute("aria-expanded", "false");
  await expect(openButton).toBeFocused();
  const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
  expect.soft(bodyOverflow, "drawer releases body scroll").not.toBe("hidden");
});

test("360 px routes do not overflow horizontally", async ({ page, fixtures }) => {
  await page.setViewportSize({ width: 360, height: 800 });

  const routes = [
    { path: `/r/${fixtures.repository.id}`, label: "mobile overview" },
    { path: `/r/${fixtures.repository.id}/findings`, label: "mobile findings" },
    { path: `/r/${fixtures.repository.id}/ask`, label: "mobile ask" },
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.locator("h1").first()).toBeVisible();
    // 34-36: no horizontal overflow at the 360 px viewport.
    await expectNoHorizontalOverflow(page, route.label);
  }
});

test("pages stay local and load self-hosted fonts", async ({ telemetry }) => {
  // 37: no request left 127.0.0.1 or localhost during the whole suite.
  expect.soft(
    Array.from(telemetry.externalRequests),
    "no external network requests",
  ).toEqual([]);

  // 38: at least the four font families were fetched from the local build.
  expect
    .soft(
      Array.from(telemetry.fontRequests).length,
      `font files requested locally: ${Array.from(telemetry.fontRequests).join(", ")}`,
    )
    .toBeGreaterThanOrEqual(4);
});

test("no console errors or warnings", async ({ telemetry }) => {
  // 39: app console and uncaught exceptions stayed clean.
  expect.soft(telemetry.consoleEvents, "no console errors or warnings").toEqual([]);
});
