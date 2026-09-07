import { expect, test as base } from "@playwright/test";

const test = base.extend<{ isolation: void }>({
  isolation: [
    async ({ context, page, baseURL }, use) => {
      if (!baseURL) throw new Error("Missing base URL");
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
      expect(
        await page.evaluate(() => ({
          local: Object.keys(localStorage),
          session: Object.keys(sessionStorage),
          native: "enduragentAuth" in window,
        })),
      ).toEqual({ local: ["enduragent-fictional-plan-catalogue-v1"], session: [], native: false });
    },
    { auto: true },
  ],
});

test("navigation opens the complete catalogue and its appearance controls", async ({ page }) => {
  await page.goto("/experiments/day-review");
  await page
    .getByRole("navigation", { name: "Experiments" })
    .getByRole("button", { name: "Plan-in-Chat", exact: true })
    .click();
  await expect(page).toHaveURL(/\/experiments\/plan-in-chat\/$/);
  await expect(page).toHaveTitle("Enduragent Plan in Chat");
  await expect(page.locator("#scenario-select option")).toHaveCount(55);
  await expect(page.locator(".coverage-button")).toHaveCount(55);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch appearance" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Compact", exact: true }).click();
  await expect(page.locator(".app-frame")).toHaveAttribute("data-width", "compact");
  await page.locator("#scenario-select").selectOption("draft-review");
  await expect(page.getByRole("button", { name: "Activate Plan", exact: true })).toBeVisible();
  await page.locator("#variation-select").selectOption("flexible");
  await expect(page.locator("#prototype-canvas")).toContainText("Flexible");
});

test("direct entry preserves URL options and dirty fields across reload and Later", async ({
  page,
}) => {
  await page.goto("/experiments/plan-in-chat?scenario=custom-answer&theme=light&width=compact");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".app-frame")).toHaveAttribute("data-width", "compact");
  await page.locator("#field-name").fill("Meadow endurance ride");
  await page.locator("#field-date").fill("1998-11-15");
  await page.reload();
  await expect(page.locator("#field-name")).toHaveValue("Meadow endurance ride");
  await expect(page.locator("#field-date")).toHaveValue("1998-11-15");
  await page.getByRole("button", { name: "Later", exact: true }).click();
  await page
    .locator(".nav-item")
    .filter({ hasText: /^Plan$/ })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Continue in Chat", exact: true }).click();
  await expect(page.locator("#field-name")).toHaveValue("Meadow endurance ride");
  await expect(page.locator("#field-date")).toHaveValue("1998-11-15");
  await page.getByRole("button", { name: "Reset this fixture" }).click();
  await expect(page.locator("#field-name")).toHaveValue("");
  await expect(page.locator("#field-date")).toHaveValue("");
});

test("the build and activation preserve cancellation and confirmation", async ({ page }) => {
  await page.goto("/experiments/plan-in-chat/?scenario=building&width=compact");
  await page.getByRole("button", { name: "Next build checkpoint" }).click();
  await page.getByRole("button", { name: "Finish fixture build" }).click();
  await expect(page.locator("#prototype-canvas")).toContainText("Every week and Workout");
  const activate = page.getByRole("button", { name: "Activate Plan", exact: true });
  await activate.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("[data-dialog-cancel]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(activate).toBeFocused();
  await activate.click();
  await dialog.getByRole("button", { name: "Activate new Plan", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#prototype-canvas")).toContainText("Plan activated locally.");
  await expect(page.locator("#prototype-canvas")).toContainText("Closed to start a new Plan");
});

test("a pending change survives reload, applies, and supports confirmed Undo", async ({ page }) => {
  await page.goto("/experiments/plan-in-chat/?scenario=plan-change&width=compact");
  await page
    .locator(".nav-item")
    .filter({ hasText: /^Plan$/ })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Change in Chat", exact: true }).click();
  await page.getByRole("button", { name: "Apply to Plan", exact: true }).click();
  await expect(page.locator("#prototype-canvas")).toContainText("Change applied locally.");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("#prototype-canvas")).toContainText("Undo the latest Change");
  await page.getByRole("button", { name: "Apply to Plan", exact: true }).click();
  await expect(page.locator("#prototype-canvas")).toContainText("Change applied locally.");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveCount(2);
});
