import { expect, test, type Page } from "@playwright/test";
import { scenarios } from "../../src/plan-catalogue/scenarios";

async function expectAligned(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const dock = document.querySelector(".composer-dock");
        const thread = document.querySelector(".thread");
        const region = document.querySelector(".thread-region");
        if (!dock || !thread || !region) throw new Error("Missing chat layout");
        const reference = thread.getBoundingClientRect();
        const elements = [
          dock,
          ...document.querySelectorAll(
            ".coach-copy > *, .composer, .coach-answer-prompt, .coach-answer-prompt > *",
          ),
        ];
        return {
          misaligned: elements.flatMap((element) => {
            const bounds = element.getBoundingClientRect();
            if (!bounds.width) return [];
            const left = bounds.left - reference.left;
            const right = bounds.right - reference.right;
            return Math.abs(left) < 0.5 && Math.abs(right) < 0.5
              ? []
              : [{ element: element.className, left, right }];
          }),
          overflow: Math.max(0, region.scrollWidth - region.clientWidth),
        };
      }),
    )
    .toEqual({ misaligned: [], overflow: 0 });
}

test("every catalogue state aligns its full-width content with the composer", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const width = testInfo.project.name.startsWith("compact") ? "compact" : "wide";
  const theme = testInfo.project.name.endsWith("light") ? "light" : "dark";
  for (const scenario of scenarios) {
    for (const variation of ["", ...(scenario.variations ?? []).map((entry) => entry.id)]) {
      await test.step(`${scenario.id}/${variation || "default"}`, async () => {
        const query = new URLSearchParams({ scenario: scenario.id, variation, width, theme });
        await page.goto(`/experiments/plan-in-chat/?${query}`);
        await page.locator(".thread").waitFor();
        if (!(await page.locator(".composer-dock").count())) return;
        await page.locator(".thread-region").evaluate((element) => {
          element.style.scrollbarGutter = "stable";
        });
        await expectAligned(page);
      });
    }
  }
});

for (const scenario of ["goal-answered", "draft-review", "plan-change"]) {
  test(`${scenario} keeps aligned edges while scrolling and changing context`, async ({
    page,
  }, testInfo) => {
    const width = testInfo.project.name.startsWith("compact") ? "compact" : "wide";
    const theme = testInfo.project.name.endsWith("light") ? "light" : "dark";
    await page.goto(
      `/experiments/plan-in-chat/?scenario=${scenario}&width=${width}&theme=${theme}`,
    );
    await page.locator(".composer-dock").waitFor();
    for (const contextOpen of [true, false]) {
      if (width === "wide" && !contextOpen) await page.locator("#context-toggle").click();
      for (const gutter of ["auto", "stable"]) {
        await page.locator(".thread-region").evaluate((element, value) => {
          element.style.scrollbarGutter = value;
        }, gutter);
        const dock = await page.locator(".composer-dock").boundingBox();
        if (!dock) throw new Error("Missing composer dock bounds");
        for (const bottom of [false, true]) {
          await page.locator(".thread-region").evaluate((element, atBottom) => {
            element.scrollTop = atBottom ? element.scrollHeight : 0;
          }, bottom);
          await expectAligned(page);
          const current = await page.locator(".composer-dock").boundingBox();
          expect(current?.y).toBeCloseTo(dock.y, 0);
        }
      }
    }
    await page.locator(".app-frame").screenshot({ path: testInfo.outputPath("aligned.png") });
  });
}
