import { expect, test, type Page } from "@playwright/test";

async function saved(page: Page): Promise<unknown> {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("enduragent-fictional-plan-catalogue-v1") || "null"),
  );
}
function property(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") throw new Error(`Missing ${key}`);
  return Reflect.get(value, key);
}

test("draft input keeps the form mounted and submits the resumed goal", async ({ page }) => {
  await page.goto("/experiments/plan-in-chat/?scenario=custom-answer");
  const name = page.getByRole("textbox", { name: "Event name", exact: true });
  const field = await name.elementHandle();
  if (!field) throw new Error("Missing goal input");
  await name.fill("Meadow ride");
  await page.locator("#field-date").fill("1998-10-04");
  expect(await field.evaluate((element) => element.isConnected)).toBe(true);
  expect(await saved(page)).toMatchObject({
    ui: { values: { name: "Meadow ride", date: "1998-10-04", days: [] } },
  });
  await page.getByRole("button", { name: "Later", exact: true }).click();
  expect(await saved(page)).toMatchObject({ state: { creation: { paused: true } } });
  await page.getByRole("button", { name: "Continue in Chat", exact: true }).click();
  await expect(name).toHaveValue("Meadow ride");
  await page.locator("#answer-form").getByRole("button", { name: "Continue", exact: true }).click();
  expect(await saved(page)).toMatchObject({
    state: {
      creation: {
        answers: {
          goal: { kind: "event", name: "Meadow ride", date: "1998-10-04", source: "your answer" },
        },
      },
    },
    ui: { editor: null },
  });
});

test("saved appearance survives reload and fixture reset", async ({ page }) => {
  await page.goto("/experiments/plan-in-chat/?scenario=custom-answer");
  await page.locator("#field-name").fill("Saved draft");
  await page.getByRole("button", { name: "Compact", exact: true }).click();
  await page.getByRole("button", { name: "Switch appearance", exact: true }).click();
  await page.reload();
  await expect(page.locator("#field-name")).toHaveValue("Saved draft");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".app-frame")).toHaveAttribute("data-width", "compact");
  await page.getByRole("button", { name: "Reset this fixture", exact: true }).click();
  expect(await saved(page)).toMatchObject({
    ui: { theme: "light", width: "compact", values: {}, editor: "goal" },
  });
  await expect(page.locator("#field-name")).toHaveValue("");
});

test("discard traps keyboard focus and preserves the active Plan", async ({ page }) => {
  await page.goto("/experiments/plan-in-chat/?scenario=creation-start");
  await page.locator("#prototype-canvas").waitFor();
  const active = property(property(await saved(page), "state"), "active");
  const discard = page.getByRole("button", { name: "Discard", exact: true });
  await discard.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Keep creating", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Discard creation", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Keep creating", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(discard).toBeFocused();
  await discard.click();
  await dialog.getByRole("button", { name: "Discard creation", exact: true }).click();
  expect(await saved(page)).toMatchObject({
    state: { creation: null, active, notice: "Plan creation discarded" },
  });
});
