import { expect, test, type Page } from "@playwright/test";

const reading = (page: Page) => page.getByRole("heading", { level: 2, name: /^Today’s reading:/ });
const stats = (page: Page) => page.getByTestId("journey-stats");
const weekList = (page: Page) => page.getByRole("list", { name: "This week’s readings" });
const planWeek = (page: Page, week: number) => page.getByRole("list", { name: `Week ${week} readings` });

function storedKeys(page: Page, store: "day_progress" | "verse_progress") {
  return page.evaluate(
    (name) =>
      new Promise<number[]>((resolve, reject) => {
        const open = indexedDB.open("bible-journey");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const keys = db.transaction(name).objectStore(name).getAllKeys();
          keys.onsuccess = () => {
            db.close();
            resolve((keys.result as number[]).sort((a, b) => a - b));
          };
          keys.onerror = () => reject(keys.error);
        };
      }),
    store,
  );
}

const savedDays = (page: Page, expected: number[]) => expect.poll(() => storedKeys(page, "day_progress")).toEqual(expected);
const savedVerses = (page: Page, expected: number[]) => expect.poll(() => storedKeys(page, "verse_progress")).toEqual(expected);

test("marking a day read shows the next day and survives a reload", async ({ page }) => {
  await page.goto("/");
  await expect(reading(page)).toHaveText(/Genesis 1–4/);

  await page.getByRole("button", { name: "Mark as read" }).click();
  await expect(page.getByRole("status")).toHaveText("Marked as read");
  await expect(reading(page)).toHaveText(/Genesis 5–7/);
  await expect(weekList(page).getByRole("checkbox", { name: /Genesis 1–4/ })).toBeChecked();
  await expect(stats(page)).toContainText("1 of 312 days");
  await savedDays(page, [0]);

  await page.reload();
  await expect(reading(page)).toHaveText(/Genesis 5–7/);
  await expect(weekList(page).getByRole("checkbox", { name: /Genesis 1–4/ })).toBeChecked();
  await expect(stats(page)).toContainText("1 of 312 days");
});

test("ticking and unticking in the plan updates the strip stats", async ({ page }) => {
  await page.goto("/plan");
  await planWeek(page, 1).getByRole("checkbox", { name: /Genesis 1–4/ }).check();
  await planWeek(page, 1).getByRole("checkbox", { name: /Genesis 8–11/ }).check();
  await expect(page.getByRole("img", { name: "2 of 6 days read" })).toBeVisible();

  await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Today" }).click();
  await expect(stats(page)).toContainText("2 of 312 days");
  await expect(reading(page)).toHaveText(/Genesis 5–7/);
  await expect(page.locator('svg a[data-week="1"]')).toHaveAttribute("data-state", "partial");

  await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Plan" }).click();
  await planWeek(page, 1).getByRole("checkbox", { name: /Genesis 1–4/ }).uncheck();
  await savedDays(page, [2]);
  await page.reload();
  await expect(planWeek(page, 1).getByRole("checkbox", { name: /Genesis 1–4/ })).not.toBeChecked();
  await expect(planWeek(page, 1).getByRole("checkbox", { name: /Genesis 8–11/ })).toBeChecked();

  await page.goto("/");
  await expect(stats(page)).toContainText("1 of 312 days");
  await expect(reading(page)).toHaveText(/Genesis 1–4/);
  await expect(page.getByText("Picking up where you left off.")).toBeVisible();
});

test("a strip segment opens its week in the plan", async ({ page }) => {
  await page.goto("/");
  await expect(reading(page)).toBeVisible();
  await page.locator('svg a[data-week="5"]').click();
  await expect(page).toHaveURL(/\/plan#week-5$/);
  await expect(page.getByRole("button", { name: /Wk 5 / })).toHaveAttribute("aria-expanded", "true");
});

test("finishing a week shows the Sunday view, then the next week", async ({ page }) => {
  await page.goto("/");
  await expect(reading(page)).toHaveText(/Genesis 1–4/);
  for (const name of [/Genesis 1–4/, /Genesis 5–7/, /Job 1–4/, /Job 5–8/, /Job 9–12/]) await weekList(page).getByRole("checkbox", { name }).check();
  await expect(reading(page)).toHaveText(/Genesis 8–11/);
  await page.getByRole("button", { name: "Mark as read" }).click();

  await expect(page.getByRole("heading", { level: 2, name: /Sunday deep dive: Creation and the early world/ })).toBeVisible();
  await expect(page.getByText(/Tigris and Euphrates/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Verse review" }).getByRole("heading", { name: "Genesis 1:1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick up where you left off" })).toHaveCount(0);
  await expect(page.locator('svg a[data-week="1"]')).toHaveAttribute("data-state", "full");
  await savedDays(page, [0, 1, 2, 3, 4, 5]);

  await page.reload();
  await page.getByRole("button", { name: "Start week 2" }).click();
  await expect(reading(page)).toHaveText(/Job 13–15/);
  await page.reload();
  await expect(reading(page)).toHaveText(/Job 13–15/);
});

test("the Sunday view lists skipped days to pick up, without blame", async ({ page }) => {
  await page.goto("/plan");
  for (const name of [/Genesis 1–4/, /Job 1–4/, /Job 5–8/, /Job 9–12/]) await planWeek(page, 1).getByRole("checkbox", { name }).check();
  await page.getByRole("button", { name: /Wk 2 / }).click();
  for (const box of await planWeek(page, 2).getByRole("checkbox").all()) await box.check();
  await savedDays(page, [0, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: /Sunday deep dive: The book of Job/ })).toBeVisible();
  const pickUp = page.getByRole("list", { name: "Readings to pick up" });
  await expect(pickUp.getByRole("checkbox")).toHaveCount(2);
  await pickUp.getByRole("checkbox", { name: /Genesis 5–7/ }).check();
  await expect(pickUp.getByRole("checkbox", { name: /Genesis 5–7/ })).toBeChecked();
  await expect(page.getByText(/missed/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Continue reading" }).click();
  await expect(reading(page)).toHaveText(/Genesis 8–11/);
});

test("“I know it” persists and practice starts with one unlocked verse", async ({ page }) => {
  await page.goto("/verses");
  await page.getByRole("region", { name: "This week’s memory verse" }).getByRole("checkbox", { name: /I know it/ }).check();
  await savedVerses(page, [1]);
  await page.reload();
  await expect(page.getByRole("region", { name: "This week’s memory verse" }).getByRole("checkbox", { name: /I know it/ })).toBeChecked();

  const practice = page.getByRole("region", { name: /Practice/ });
  await expect(practice).toContainText("1 verse unlocked");
  await expect(practice.getByRole("button", { name: "Next verse" })).toBeDisabled();
  await expect(page.locator("li[data-upcoming]")).toHaveCount(51);

  await page.goto("/");
  await expect(stats(page)).toContainText("1 of 52 verses");
});

test("practice draws from every verse up to the current week", async ({ page }) => {
  await page.goto("/plan");
  await expect(page.getByRole("button", { name: /Wk 1 / })).toHaveAttribute("aria-expanded", "true");
  for (const box of await planWeek(page, 1).getByRole("checkbox").all()) await box.check();
  await expect(page.getByRole("button", { name: /Wk 2 / })).toHaveAttribute("aria-expanded", "true");
  for (const box of await planWeek(page, 2).getByRole("checkbox").all()) await box.check();
  await savedDays(page, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

  await page.goto("/verses");
  const practice = page.getByRole("region", { name: /Practice/ });
  await expect(practice).toContainText("3 verses unlocked");
  await expect(page.locator("li[data-upcoming]")).toHaveCount(49);
  const reference = practice.locator("p").first();
  await expect(reference).toHaveText("Genesis 12:2–3");
  await practice.getByRole("button", { name: "Next verse" }).click();
  await expect(reference).toHaveText(/^(Genesis 1:1|Job 19:25)$/);
  await practice.getByRole("button", { name: "Reveal" }).click();
  await expect(practice.getByRole("button", { name: "Hide" })).toBeVisible();
});
