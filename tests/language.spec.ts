import { expect, test as base, type Page } from "@playwright/test";

const test = base.extend<{ isolation: void }>({
  isolation: [
    async ({ context, page, baseURL }, use) => {
      if (!baseURL) throw new Error("Missing base URL");
      const unexpected: string[] = [];
      const errors: string[] = [];
      await context.route("**/*", async (route) => {
        const request = route.request();
        if (
          new URL(request.url()).origin !== new URL(baseURL).origin ||
          ["fetch", "xhr"].includes(request.resourceType())
        ) {
          unexpected.push(request.url());
          await route.abort();
        } else await route.continue();
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await use();
      expect(unexpected).toEqual([]);
      expect(errors).toEqual([]);
      expect(
        await page.evaluate(() => ({
          local: Object.keys(localStorage),
          session: Object.keys(sessionStorage),
        })),
      ).toEqual({ local: [], session: [] });
    },
    { auto: true },
  ],
});

async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const card of await page.locator(".setup-panel > div, section.rounded-card").all()) {
    expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
}

test("first launch follows OS scenarios, previews catalogs, and completes both selectors", async ({
  page,
  colorScheme,
}, testInfo) => {
  await page.goto("/experiments/language");
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    colorScheme === "dark" ? "dark" : "light",
  );
  const gate = page.getByRole("region", { name: "First launch prototype" });
  await expect(gate.getByRole("radio")).toHaveCount(17);
  await expect(gate.getByRole("radio", { name: "English", exact: true })).toBeChecked();
  await expect(gate.getByRole("button")).toHaveCount(1);
  await expect(gate.getByRole("navigation")).toHaveCount(0);
  await noOverflow(page);
  await gate.screenshot({ path: testInfo.outputPath("first-launch-radio.png") });

  await choose(page, "OS language", "Italiano · it");
  await expect(gate.getByRole("radio", { name: "Italiano", exact: true })).toBeChecked();
  await expect(gate.getByRole("heading", { level: 1 })).toHaveText("Scegli la tua lingua");
  await gate.getByRole("radio", { name: "Italiano", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(gate.getByRole("radio", { name: "Deutsch", exact: true })).toBeFocused();
  await expect(gate.getByRole("radio", { name: "Deutsch", exact: true })).toBeChecked();
  await expect(page.getByText(/English fallback active for de/)).toBeVisible();
  await page.keyboard.press("Home");
  await expect(gate.getByRole("radio", { name: "English", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(gate.getByRole("radio", { name: "繁體中文", exact: true })).toBeChecked();
  await page.keyboard.press("ArrowDown");
  await expect(gate.getByRole("radio", { name: "English", exact: true })).toBeChecked();

  await choose(page, "OS language", "日本語 · ja");
  await expect(gate.getByRole("radio", { name: "日本語", exact: true })).toBeChecked();
  await expect(gate.getByRole("heading", { level: 1 })).toHaveText("言語を選択");
  await gate.getByRole("button").click();
  await expect(gate.getByText("ja", { exact: true })).toBeVisible();
  await expect(gate.getByRole("heading", { level: 1 })).toBeFocused();
  await gate.getByRole("button").click();
  await expect(gate.getByRole("radio", { name: "日本語", exact: true })).toBeChecked();

  await choose(page, "OS language", "Unsupported · falls back to English");
  await expect(gate.getByRole("radio", { name: "English", exact: true })).toBeChecked();
  await choose(page, "Selector presentation", "Single Select");
  await gate.getByRole("combobox").click();
  await expect(page.getByRole("option")).toHaveCount(17);
  await page.getByRole("option", { name: "Italiano", exact: true }).click();
  await expect(gate.getByRole("heading", { level: 1 })).toHaveText("Scegli la tua lingua");
  await noOverflow(page);
  await gate.screenshot({ path: testInfo.outputPath("first-launch-select.png") });
  await gate.getByRole("button").click();
  await expect(gate.getByText("it", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(gate.getByRole("radio", { name: "English", exact: true })).toBeChecked();
});

test("Settings translates the group, preserves row order, and exposes unavailable states", async ({
  page,
}, testInfo) => {
  await page.goto("/experiments/language");
  await choose(page, "Prototype", "Settings language row");
  const group = page.locator("section.rounded-card");
  const titles = group.locator(".font-semibold");
  await expect(titles).toHaveText(["Language", "Units", "Appearance"]);
  await expect(group.getByRole("combobox", { name: "Language", exact: true })).toContainText(
    "Automatic",
  );
  await expect(group).toContainText(
    "Automatic follows your macOS language; the coach replies in the language you write in.",
  );
  await noOverflow(page);
  await group.screenshot({ path: testInfo.outputPath("settings-automatic.png") });
  await group.getByRole("combobox").click();
  await expect(page.getByRole("option")).toHaveText([
    "Automatic",
    "English",
    "Español",
    "Français",
    "Italiano",
    "Deutsch",
    "Nederlands",
    "Dansk",
    "Svenska",
    "Norsk bokmål",
    "Suomi",
    "Português (Portugal)",
    "Português (Brasil)",
    "Polski",
    "한국어",
    "日本語",
    "简体中文",
    "繁體中文",
  ]);
  await page.getByRole("option", { name: "Italiano", exact: true }).click();
  await expect(titles).toHaveText(["Lingua", "Unità", "Aspetto"]);
  await choose(page, "Language", "日本語");
  await expect(titles).toHaveText(["言語", "単位", "外観"]);
  await noOverflow(page);
  await group.screenshot({ path: testInfo.outputPath("settings-japanese.png") });
  await choose(page, "Language", "Deutsch");
  await expect(titles).toHaveText(["Language", "Units", "Appearance"]);
  await expect(page.getByText(/English fallback active for de/)).toBeVisible();
  await choose(page, "Settings state", "Saving");
  await expect(group).toContainText("Saving language…");
  await expect(group.getByRole("combobox")).toBeDisabled();
  await choose(page, "Settings state", "Unavailable");
  await expect(group).toContainText("Language preference unavailable");
  await expect(group.getByRole("combobox")).toBeDisabled();
  await choose(page, "Settings state", "Automatic");
  await expect(group.getByRole("combobox")).toBeEnabled();
  await choose(page, "OS language", "Italiano · it");
  await expect(titles).toHaveText(["Lingua", "Unità", "Aspetto"]);
  await choose(page, "OS language", "English · en");
  await group.getByRole("button", { name: "Imperial", exact: true }).click();
  await expect(group.getByRole("button", { name: "Imperial", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await group.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(group.getByRole("button", { name: "Dark", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await group.screenshot({ path: testInfo.outputPath("settings-narrow.png") });
  await page.reload();
  await choose(page, "Prototype", "Settings language row");
  await expect(group.getByRole("combobox")).toContainText("Automatic");
  await expect(group.getByRole("button", { name: "Metric", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
