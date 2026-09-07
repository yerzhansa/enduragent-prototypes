import { test as base, expect } from "@playwright/test";

const test = base.extend<{ isolation: void }>({
  isolation: [
    async ({ context, page, baseURL }, use) => {
      if (baseURL === undefined) throw new Error("Prototype baseURL is missing");
      const unexpected: string[] = [];
      const errors: string[] = [];
      await context.route("**/*", async (route) => {
        if (new URL(route.request().url()).origin !== new URL(baseURL).origin) {
          unexpected.push(route.request().url());
          await route.abort();
        } else await route.continue();
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await use();
      expect(unexpected).toEqual([]);
      expect(errors).toEqual([]);
      if (page.url() !== "about:blank") {
        expect(
          await page.evaluate(() => ({
            local: Object.keys(localStorage),
            session: Object.keys(sessionStorage),
            native: "enduragentAuth" in window,
          })),
        ).toEqual({ local: [], session: [], native: false });
      }
    },
    { auto: true },
  ],
});

test("selection, review, cancel, discard and reset use shared controls", async ({
  page,
}, testInfo) => {
  await page.goto("/experiments/day-review");
  await page.evaluate(() => document.fonts.ready);
  const day = page.getByRole("combobox", { name: "Training day", exact: true });
  await expect(day).toContainText("Monday");
  await day.click();
  await page.getByRole("option", { name: "Friday", exact: true }).click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Friday is selected");
  await expect(page.getByRole("button", { name: "Back to selection" })).toBeFocused();
  await testInfo.attach("review", {
    path: await page
      .screenshot({ path: testInfo.outputPath("review.png") })
      .then(() => testInfo.outputPath("review.png")),
    contentType: "image/png",
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Review", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Discard selection", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(day).toContainText("Friday");
  await expect(page.getByRole("button", { name: "Discard selection", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Discard selection", exact: true }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(day).toBeFocused();
  await expect(page.getByRole("button", { name: "Review", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(day).toContainText("Monday");
  await testInfo.attach("reset", {
    path: await page
      .screenshot({ path: testInfo.outputPath("reset.png") })
      .then(() => testInfo.outputPath("reset.png")),
    contentType: "image/png",
  });
});

test("scenario navigation resets state and selection works with the keyboard", async ({ page }) => {
  await page.goto("/experiments/day-review?scenario=empty");
  await expect(page.getByRole("button", { name: "Review", exact: true })).toBeDisabled();
  const day = page.getByRole("combobox", { name: "Training day", exact: true });
  await day.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Review", exact: true })).toBeEnabled();
  await page.getByRole("combobox", { name: "Scenario", exact: true }).click();
  await page.getByRole("option", { name: "Discard confirmation", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(day).toContainText("Monday");
});

test("themes and package identity are visible and fonts stay local", async ({
  page,
  request,
  colorScheme,
}, testInfo) => {
  await page.goto("/experiments/day-review");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    colorScheme === "dark" ? "dark" : "light",
  );
  await page.getByRole("button", { name: /Switch to .* appearance/ }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    colorScheme === "dark" ? "light" : "dark",
  );
  await page.getByText("Review details", { exact: true }).click();
  const identity: unknown = await (await request.get("/review-source.json")).json();
  expect(identity).toMatchObject({
    schemaVersion: 1,
    repository: "yerzhansa/enduragent-prototypes",
    revision: expect.stringMatching(/^[a-f0-9]{40}$/),
    uiVersion: expect.any(String),
    uiContentSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    lockfileSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    outputs: expect.any(Object),
  });
  expect(
    await page.evaluate(() =>
      [...document.fonts].some((font) => font.family.includes("Inter") && font.status === "loaded"),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () =>
        performance.getEntriesByType("resource").filter((entry) => entry.name.endsWith(".woff2"))
          .length,
    ),
  ).toBeGreaterThan(0);
  await testInfo.attach("appearance", {
    path: await page
      .screenshot({ path: testInfo.outputPath("appearance.png") })
      .then(() => testInfo.outputPath("appearance.png")),
    contentType: "image/png",
  });
  await testInfo.attach("source", {
    body: JSON.stringify(identity),
    contentType: "application/json",
  });
});

test("each linked scenario starts independently", async ({ page }, testInfo) => {
  for (const scenario of ["editing", "empty", "review", "discard"]) {
    await page.goto(`/experiments/day-review?scenario=${scenario}`);
    await page.evaluate(() => document.fonts.ready);
    if (scenario === "review") await expect(page.getByRole("dialog")).toBeVisible();
    else if (scenario === "discard")
      await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    else
      await expect(page.getByRole("combobox", { name: "Training day", exact: true })).toContainText(
        scenario === "empty" ? "Choose a day" : "Monday",
      );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await testInfo.attach(scenario, {
      path: await page
        .screenshot({ path: testInfo.outputPath(`${scenario}.png`) })
        .then(() => testInfo.outputPath(`${scenario}.png`)),
      contentType: "image/png",
    });
  }
});

test("day select portal fits and restores keyboard focus", async ({ page }, testInfo) => {
  await page.goto("/experiments/day-review");
  const day = page.getByRole("combobox", { name: "Training day", exact: true });
  await day.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  await testInfo.attach("select-open", {
    path: await page
      .screenshot({ path: testInfo.outputPath("select-open.png") })
      .then(() => testInfo.outputPath("select-open.png")),
    contentType: "image/png",
  });
  await page.keyboard.press("Escape");
  await expect(day).toBeFocused();
  await expect(page.getByRole("listbox")).toBeHidden();
});

test("unknown routes do not expose the experiment", async ({ page }) => {
  for (const path of [
    "/",
    "/unknown",
    "/experiments/unknown",
    "/experiments/day-review/",
    "/experiments/day-review/extra",
  ]) {
    await page.goto(`${path}?scenario=review`);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("combobox")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Review", exact: true })).toHaveCount(0);
  }
});
