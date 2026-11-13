import { expect, test, type Page } from "@playwright/test";

const ROUTES: Array<{ path: string; tab: string; heading: string; content: RegExp; also?: RegExp }> = [
  { path: "/", tab: "Today", heading: "Today", content: /Genesis 1–4/ },
  { path: "/plan", tab: "Plan", heading: "The full plan", content: /Creation and the early world/ },
  { path: "/timeline", tab: "Timeline", heading: "The story in time", content: /Creation and the patriarchs/ },
  { path: "/verses", tab: "Verses", heading: "Memory verses", content: /Genesis 1:1/ },
  { path: "/whos-who", tab: "Who’s who", heading: "Who’s who", content: /Israelites/, also: /Jonah/ },
];

async function pageWidth(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

for (const route of ROUTES) {
  test(`${route.path} renders its heading and content without horizontal scroll`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeAttached();
    await expect(page.getByText(route.content).first()).toBeVisible();
    if (route.also) await expect(page.getByText(route.also).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: route.tab })).toHaveAttribute("aria-current", "page");
    expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  });
}

for (const route of ROUTES) {
  test(`${route.path} has no horizontal scroll with the root font size at 130%`, async ({ page }) => {
    await page.goto(route.path);
    await page.addStyleTag({ content: "html { font-size: 130%; }" });
    expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  });
}

test("a focused tab at the end of an overflowing nav sits clear of the fade", async ({ page }) => {
  await page.goto("/");
  await page.addStyleTag({ content: "html { font-size: 130%; }" });
  const nav = page.getByRole("navigation", { name: "Sections" });
  expect(await nav.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  const last = nav.getByRole("link", { name: "Who’s who" });
  await last.focus();
  await page.waitForTimeout(300);
  const gap = await last.evaluate((link) => {
    const navBox = link.closest("nav")!.getBoundingClientRect();
    const fade = parseFloat(getComputedStyle(document.documentElement).fontSize) * 2.5;
    return navBox.right - link.getBoundingClientRect().right - fade;
  });
  expect(gap).toBeGreaterThanOrEqual(-0.5);
});

test("Today shows the first day, its week and a Read online link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: /Genesis 1–4/ })).toBeVisible();
  await expect(page.getByText("4 chapters · about 20 minutes")).toBeVisible();
  await expect(page.getByRole("list", { name: "This week’s readings" }).getByRole("checkbox")).toHaveCount(6);
  await expect(page.getByText(/You are in week 1 of 52/)).toBeAttached();
  const link = page.getByRole("link", { name: /Read online/ });
  await expect(link).toHaveAttribute("href", "https://www.biblegateway.com/passage/?search=Genesis+1-4&version=NIV");
});

test("Plan opens week 1 and toggles other weeks", async ({ page }) => {
  await page.goto("/plan");
  await expect(page.getByRole("button", { name: /Wk 1 Creation and the early world/ })).toHaveAttribute("aria-expanded", "true");
  const week2 = page.getByRole("button", { name: /Wk 2 The book of Job/ });
  await expect(week2).toHaveAttribute("aria-expanded", "false");
  await week2.focus();
  await page.keyboard.press("Enter");
  await expect(week2).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Job 16–19")).toBeVisible();
});

test("a timeline era opens its first week in the plan", async ({ page }) => {
  await page.goto("/timeline");
  await expect(page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2 }) })).toHaveCount(11);
  await page.getByRole("link", { name: "Open week 13 in the plan" }).click();
  await expect(page).toHaveURL(/\/plan#week-13$/);
  await expect(page.getByRole("button", { name: /Wk 13 / })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: /Wk 13 / })).toBeFocused();
});

test("the memory verse switches between hidden, first letters and full text", async ({ page }) => {
  await page.goto("/verses");
  const card = page.getByRole("region", { name: "This week’s memory verse" });
  await expect(card.getByText("Say it from memory, then reveal to check.")).toBeVisible();
  await card.getByRole("radio", { name: "First letters" }).click();
  await expect(card.getByText("I t b G c t h a t e.")).toBeVisible();
  await card.getByRole("radio", { name: "Full text" }).click();
  await expect(card.getByText("In the beginning God created the heaven and the earth.")).toBeVisible();
});

test.describe("dark theme", () => {
  test.use({ colorScheme: "dark" });

  test("follows the system and yields to a data-theme override", async ({ page }) => {
    await page.goto("/");
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await background()).toBe("rgb(14, 20, 36)");
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    expect(await background()).toBe("rgb(243, 245, 249)");
  });
});
