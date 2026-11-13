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

function seedDays(page: Page, count: number) {
  return page.evaluate(
    (total) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("bible-journey");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("day_progress", "readwrite");
          for (let i = 0; i < total; i++) tx.objectStore("day_progress").put({ day_index: i, completed_at: new Date().toISOString() });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    count,
  );
}

test("the timeline marks the era of the current week and follows progress", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  const here = page.getByRole("listitem").filter({ hasText: "You are here" });

  await page.goto("/timeline");
  await expect(here).toHaveCount(1);
  await expect(here).toContainText("Creation and the patriarchs");

  await page.goto("/");
  await expect(reading(page)).toBeVisible();
  await seedDays(page, 24);
  await page.goto("/timeline");
  await expect(here).toHaveCount(1);
  await expect(here).toContainText("Egypt and the Exodus");
  await expect(here).not.toContainText("Creation and the patriarchs");

  await page.goto("/");
  await seedDays(page, 312);
  await page.goto("/timeline");
  await expect(here).toHaveCount(1);
  await expect(here).toContainText("The early church");
  expect(errors).toEqual([]);
});

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

test("the verse controls stay put when the verse text changes height", async ({ page }) => {
  await page.goto("/verses");
  const card = page.getByRole("region", { name: "This week’s memory verse" });
  const modeSwitch = card.getByRole("radiogroup", { name: "Show the verse as" });
  const top = async () => (await modeSwitch.boundingBox())!.y;
  const start = await top();

  for (const name of ["First letters", "Full text", "Hide"]) {
    await card.getByRole("radio", { name }).click();
    expect(await top()).toBe(start);
  }

  const practice = page.getByRole("region", { name: /Practice/ });
  const reveal = practice.getByRole("button", { name: /^(Reveal|Hide)$/ });
  const revealTop = (await reveal.boundingBox())!.y;
  await reveal.click();
  expect((await reveal.boundingBox())!.y).toBe(revealTop);
});

test("the plan page does not serialize week objects into client props", async ({ request }) => {
  const html = await (await request.get("/plan")).text();
  expect(html).not.toContain("textKJV");
  expect(html).not.toContain("deepDive");
});

test("a closed hash-linked week stays closed when progress changes", async ({ page }) => {
  await page.goto("/plan#week-13");
  const week13 = page.getByRole("button", { name: /Wk 13 / });
  await expect(week13).toHaveAttribute("aria-expanded", "true");
  await week13.click();
  await expect(week13).toHaveAttribute("aria-expanded", "false");

  const week2 = page.getByRole("button", { name: /Wk 2 / });
  await week2.click();
  await expect(week2).toHaveAttribute("aria-expanded", "true");
  await planWeek(page, 2).getByRole("checkbox").first().check();
  await expect(page.getByRole("img", { name: "1 of 6 days read" }).first()).toBeVisible();
  await savedDays(page, [6]);

  await expect(week13).toHaveAttribute("aria-expanded", "false");
});

test("the strip’s text alternative names each phase and its weeks", async ({ page }) => {
  await page.goto("/");
  const summary = page.locator("#journey-heading + p");
  await expect(summary).toContainText(/You are in week 1 of 52/);
  await expect(summary).toContainText("Origins and the Exodus, weeks 1–12");
  await expect(summary).toContainText("Jesus and the early church, weeks 40–52");
  await expect(page.locator("section[aria-labelledby=journey-heading] ul")).toHaveAttribute("aria-hidden", "true");
});

test("strip segments never use faded fills and the pulse respects reduced motion", async ({ page }) => {
  await page.goto("/");
  await expect(reading(page)).toBeVisible();
  await seedDays(page, 9);
  await page.reload();
  await expect(page.locator('svg a[data-week="1"]')).toHaveAttribute("data-state", "full");
  await expect(page.locator('svg a[data-week="2"]')).toHaveAttribute("data-state", "partial");
  await expect(page.locator('svg a[data-week="3"]')).toHaveAttribute("data-state", "empty");

  expect(await page.locator("svg [fill-opacity], svg [opacity]").count()).toBe(0);
  for (const week of [1, 2, 3]) {
    const outline = page.locator(`svg a[data-week="${week}"] [data-part="outline"]`);
    await expect(outline).toHaveAttribute("vector-effect", "non-scaling-stroke");
    await expect(outline).toHaveAttribute("stroke-width", "2");
  }
  await expect(page.locator('svg a[data-week="2"] [data-part="bar"]')).toHaveCount(1);
  await expect(page.locator('svg a[data-week="3"] [data-part="bar"]')).toHaveCount(0);
  await expect(page.locator('svg a[data-week="1"] [data-part="outline"]')).not.toHaveAttribute("fill", "none");
  await expect(page.locator('svg a[data-week="3"] [data-part="outline"]')).toHaveAttribute("fill", "none");

  const animation = () => page.locator(".current-week").evaluate((el) => getComputedStyle(el).animationName);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(await animation()).toBe("current-week");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await animation()).toBe("none");
});
