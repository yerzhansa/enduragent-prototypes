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
      ).toEqual({ local: [], session: [], native: false });
    },
    { auto: true },
  ],
});

test("Chat sends, stops, edits answers, removes attachments and resets", async ({
  page,
}, testInfo) => {
  await page.goto("/experiments/chat");
  await page.getByRole("button", { name: "Write my own" }).click();
  await expect(page.getByRole("button", { name: "Use answer" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Your weekly time" }).fill("5 hours");
  await page.getByRole("button", { name: "Use answer" }).click();
  await expect(page.getByText("5 hours", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "4 hours" }).click();
  await page.getByRole("button", { name: "Remove attachment" }).click();
  await expect(page.getByText("sample-ride.txt")).toHaveCount(0);
  const input = page.getByRole("textbox", { name: "Message your coach" });
  await input.fill("Review this fictional week.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Review this fictional week.", { exact: true })).toBeVisible();
  await input.fill("One more question.");
  await page.getByRole("button", { name: "Queue message", exact: true }).click();
  await expect(page.getByText("One more question.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit queued message" }).click();
  await expect(input).toHaveValue("One more question.");
  await page.getByRole("button", { name: "Queue message", exact: true }).click();
  await page.getByRole("button", { name: "Remove queued message" }).click();
  await page.getByRole("button", { name: "Stop responding" }).click();
  await expect(page.getByText("Response stopped", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("chat.png"), fullPage: true });
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(input).toHaveValue("");
  await expect(page.getByText("sample-ride.txt")).toBeVisible();
  await expect(page.getByRole("button", { name: "4 hours" })).toBeVisible();
  await expect(page.getByText("Review this fictional week.", { exact: true })).toHaveCount(0);
});

test("Training changes periods and data, opens missing facts and returns", async ({
  page,
}, testInfo) => {
  await page.goto("/experiments/training");
  await page.getByRole("combobox", { name: "Week", exact: true }).click();
  await page.getByRole("option", { name: "24–30 August 1998" }).click();
  await page.getByRole("combobox", { name: "Sample data" }).click();
  await page.getByRole("option", { name: "Missing power" }).click();
  await page.getByRole("button", { name: /Morning ride/ }).click();
  await expect(page.getByText("27 August 1998", { exact: true })).toBeVisible();
  await expect(page.getByText("—", { exact: true })).toBeVisible();
  await page.getByText("Ride details", { exact: true }).click();
  await expect(page.getByText(/No power samples are available/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("ride.png"), fullPage: true });
  await page.getByRole("button", { name: "Back to Training" }).click();
  await page.getByRole("combobox", { name: "Sample data" }).click();
  await page.getByRole("option", { name: "No rides", exact: true }).click();
  await expect(page.getByText("No rides recorded", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Week", exact: true })).toContainText(
    "31 August–6 September 1998",
  );
  await expect(page.getByRole("button", { name: /Morning ride/ })).toBeVisible();
});

test("Plan resumes, reviews, cancels activation and records a sample change", async ({
  page,
}, testInfo) => {
  await page.goto("/experiments/plan-presentation");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "6 hours" }).click();
  await page.getByRole("button", { name: "Review sample Draft" }).click();
  await page.getByText("How this Plan was built", { exact: true }).click();
  await expect(page.getByText("6 hours", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Activate Plan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Activate Plan", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Activate Plan", exact: true }).click();
  await page.getByRole("button", { name: "Activate sample Plan", exact: true }).click();
  await page.getByRole("button", { name: "View history" }).click();
  await expect(page.getByText("No changes yet", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to Plan" }).click();
  await page.getByRole("button", { name: "Review sample change" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Review sample change" }).click();
  await page.getByRole("button", { name: "Apply sample change" }).click();
  await expect(page.getByText("60 min → 45 min", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("plan.png"), fullPage: true });
  await page.getByRole("button", { name: "Back to Plan", exact: true }).click();
  await expect(page.getByRole("list", { name: "Active Plan Workouts" })).toContainText(
    "Steady ride · 45 min",
  );
  await expect(page.getByRole("button", { name: "Review sample change", exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Apply sample change", exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "View history", exact: true }).click();
  await expect(page.getByText("60 min → 45 min", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "6 hours" }).click();
  await page.getByRole("button", { name: "Review sample Draft" }).click();
  await page.getByRole("button", { name: "Activate Plan", exact: true }).click();
  await page.getByRole("button", { name: "Activate sample Plan", exact: true }).click();
  await expect(page.getByRole("list", { name: "Active Plan Workouts" })).toContainText(
    "Steady ride · 60 min",
  );
  await expect(
    page.getByRole("button", { name: "Review sample change", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
});

test("navigation and appearance preserve isolated responsive experiments", async ({
  page,
  colorScheme,
}, testInfo) => {
  await page.goto("/experiments/day-review");
  for (const [label, path] of [
    ["Chat", "chat"],
    ["Training", "training"],
    ["Plan presentation", "plan-presentation"],
  ]) {
    await page
      .getByRole("navigation", { name: "Experiments" })
      .getByRole("button", { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/experiments/${path}$`));
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      colorScheme === "dark" ? "dark" : "light",
    );
    await page.getByRole("button", { name: /Switch to .* appearance/ }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      colorScheme === "dark" ? "light" : "dark",
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`${path}-entry.png`), fullPage: true });
  }
});

test("Plan requires recorded answers and rebuilds stale Draft evidence", async ({
  page,
}, testInfo) => {
  await page.goto("/experiments/plan-presentation");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  const review = page.getByRole("button", { name: "Review sample Draft", exact: true });
  await expect(review).toBeDisabled();
  await page.getByRole("button", { name: "6 hours" }).click();
  await expect(review).toBeEnabled();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(review).toBeDisabled();
  await page.getByRole("button", { name: "6 hours" }).click();
  await review.click();
  const evidence = page.getByRole("table", { name: "Draft inputs" });
  await page.getByText("How this Plan was built", { exact: true }).click();
  await expect(evidence).toContainText("6 hours");
  await page.getByRole("button", { name: "Edit answers", exact: true }).click();
  await expect(review).toBeDisabled();
  await page.getByRole("button", { name: "4 hours" }).click();
  await review.click();
  await expect(page.getByText("Answers changed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Activate Plan", exact: true })).toHaveCount(0);
  await page.getByText("How this Plan was built", { exact: true }).click();
  await expect(evidence).toContainText("6 hours");
  await expect(evidence).not.toContainText("4 hours");
  await page.screenshot({ path: testInfo.outputPath("stale-draft.png"), fullPage: true });
  await page.getByRole("button", { name: "Rebuild sample Draft", exact: true }).click();
  await expect(page.getByText("Answers changed", { exact: true })).toHaveCount(0);
  await expect(evidence).toContainText("4 hours");
  await expect(evidence).not.toContainText("6 hours");
  await expect(page.getByRole("button", { name: "Activate Plan", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(review).toBeDisabled();
  await page.getByRole("button", { name: "6 hours" }).click();
  await review.click();
  await expect(page.getByText("Answers changed", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(review).toBeDisabled();
});

test("Chat and Training describe the same fictional week", async ({ page }) => {
  await page.goto("/experiments/chat");
  const facts = page.getByRole("table", { name: "Weekly facts" });
  await expect(facts).toContainText("1h 20m");
  await expect(facts).toContainText("56");
  await expect(
    page.getByText("Your recorded ride totals 1h 20m for 31 August–6 September 1998.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByText("Data reviewed", { exact: true }).click();
  await expect(page.getByText(/One fictional ride from this week/)).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByText("The fictional week contains one recorded ride, totalling 1h 20m.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Experiments" })
    .getByRole("button", { name: "Training", exact: true })
    .click();
  await expect(page.getByRole("combobox", { name: "Week", exact: true })).toContainText(
    "31 August–6 September 1998",
  );
  const week = page.getByRole("region", { name: "Weekly summary" });
  await expect(week).toContainText("1h 20m");
  await expect(week).toContainText("1 ride");
  await expect(week).toContainText("Load 56");
});
