import { expect, test, type Page } from "@playwright/test";

const reading = (page: Page) => page.getByRole("heading", { level: 2, name: /^Today’s reading:/ });

test("settings opens from the header next to Account, not as a sixth tab", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Sections" }).getByRole("link")).toHaveCount(5);
  const link = page.getByRole("link", { name: "Settings" });
  const box = await link.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  await link.click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(link).toHaveAttribute("aria-current", "page");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("without push keys or Supabase the reminder setting says reminders are not set up", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/settings");
  await expect(page.getByText("Reminders aren’t set up on this copy of the app.", { exact: false })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /daily reminder/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the theme persists across a reload and is applied before the page paints", async ({ page }) => {
  await page.addInitScript(() => {
    const record = () => {
      if (!document.body) return false;
      (window as unknown as { themeAtBody: string | null }).themeAtBody = document.documentElement.dataset.theme ?? null;
      return true;
    };
    const observer = new MutationObserver(() => {
      if (record()) observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  const themeAtBody = () => page.evaluate(() => (window as unknown as { themeAtBody: string | null }).themeAtBody);
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/settings");
  const theme = page.getByRole("radiogroup", { name: "Theme" });
  await expect(theme.getByRole("radio", { name: "System" })).toBeChecked();
  expect(await background()).toBe("rgb(244, 246, 241)");

  await theme.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background()).toBe("rgb(20, 26, 22)");

  await page.reload();
  expect(await themeAtBody()).toBe("dark");
  await expect(page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "Dark" })).toBeChecked();
  await page.goto("/");
  expect(await themeAtBody()).toBe("dark");
  expect(await background()).toBe("rgb(20, 26, 22)");

  await page.goto("/settings");
  await page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "System" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await page.reload();
  expect(await themeAtBody()).toBeNull();
  expect(await background()).toBe("rgb(244, 246, 241)");
});

test("Read online links use the chosen translation", async ({ page }) => {
  await page.goto("/settings");
  const select = page.getByLabel("Translation for Read online links");
  await expect(select).toHaveValue("NIV");
  await select.selectOption("ESV");

  await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Today" }).click();
  const link = page.getByRole("link", { name: /Read online/ });
  await expect(link).toHaveAttribute("href", "https://www.biblegateway.com/passage/?search=Genesis+1-4&version=ESV");
  await page.reload();
  await expect(link).toHaveAttribute("href", /version=ESV$/);
});

test("reset clears progress only after the confirmation word is typed", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mark as read" }).click();
  await expect(reading(page)).toHaveText(/Genesis 5–7/);

  await page.goto("/settings");
  const open = page.getByRole("button", { name: "Reset progress…" });

  await open.click();
  let dialog = page.getByRole("alertdialog", { name: "Reset your progress?" });
  await expect(dialog).toBeVisible();
  const word = dialog.getByLabel(/Type RESET to confirm/);
  await expect(word).toBeFocused();
  const confirm = dialog.getByRole("button", { name: "Reset progress" });
  await expect(confirm).toBeDisabled();
  await word.fill("RES");
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/");
  await expect(reading(page)).toHaveText(/Genesis 5–7/);

  await page.goto("/settings");
  await page.getByRole("button", { name: "Reset progress…" }).click();
  dialog = page.getByRole("alertdialog", { name: "Reset your progress?" });
  await dialog.getByLabel(/Type RESET to confirm/).fill("reset");
  await dialog.getByRole("button", { name: "Reset progress" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Your progress has been reset." })).toBeVisible();

  await page.goto("/");
  await expect(reading(page)).toHaveText(/Genesis 1–4/);
  await page.reload();
  await expect(reading(page)).toHaveText(/Genesis 1–4/);
});

test("the reset dialog sits above the header, scrolls on a short screen and confirms with Enter", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mark as read" }).click();
  await expect(reading(page)).toHaveText(/Genesis 5–7/);

  await page.goto("/settings");
  await page.getByRole("button", { name: "Reset progress…" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Reset your progress?" });
  await expect(dialog).toBeVisible();
  const plan = page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Plan" });
  await plan.click({ force: true });
  await expect(page).toHaveURL(/\/settings$/);
  await expect(dialog).toBeVisible();

  await page.setViewportSize({ width: 360, height: 420 });
  const confirm = dialog.getByRole("button", { name: "Reset progress" });
  await confirm.scrollIntoViewIfNeeded();
  await expect(confirm).toBeInViewport();
  const box = await dialog.boundingBox();
  expect(box!.height).toBeLessThanOrEqual(420);

  const word = dialog.getByLabel(/Type RESET to confirm/);
  await word.fill("RES");
  await word.press("Enter");
  await expect(dialog).toBeVisible();
  await word.fill("RESET");
  await word.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Your progress has been reset." })).toBeVisible();
});

test("the selected theme is clearly marked", async ({ page }) => {
  await page.goto("/settings");
  const theme = page.getByRole("radiogroup", { name: "Theme" });
  await theme.getByRole("radio", { name: "Dark" }).click();
  for (const scheme of ["dark", "light"] as const) {
    if (scheme === "light") await theme.getByRole("radio", { name: "Light" }).click();
    const ratio = await theme.evaluate((group) => {
      const rgb = (value: string) => value.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number);
      const lum = ([r, g, b]: number[]) => {
        const c = [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      const contrast = (a: number[], b: number[]) => {
        const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
        return (x + 0.05) / (y + 0.05);
      };
      const checked = group.querySelector("[data-checked]")!;
      const unchecked = group.querySelector("[data-slot=segmented-control-item]:not([data-checked])")!;
      const underline = getComputedStyle(checked, "::after");
      const ground = rgb(getComputedStyle(document.body).backgroundColor);
      return {
        underline: contrast(rgb(underline.backgroundColor), ground),
        underlineHeight: parseFloat(underline.height),
        weight: Number(getComputedStyle(checked).fontWeight),
        neighbourWeight: Number(getComputedStyle(unchecked).fontWeight),
        label: contrast(rgb(getComputedStyle(checked).color), ground),
      };
    });
    expect(ratio.underline, scheme).toBeGreaterThanOrEqual(3);
    expect(ratio.underlineHeight, scheme).toBeGreaterThan(0);
    expect(ratio.weight, scheme).toBeGreaterThan(ratio.neighbourWeight);
    expect(ratio.label, scheme).toBeGreaterThanOrEqual(4.5);
  }
});

test("browser chrome follows the chosen theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/settings");
  const color = () => page.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((meta) => meta.getAttribute("content")));
  await page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "Dark" }).click();
  expect(new Set(await color())).toEqual(new Set(["#141a16"]));
  await page.reload();
  expect(new Set(await color())).toEqual(new Set(["#141a16"]));
  await page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "System" }).click();
  expect(new Set(await color())).toEqual(new Set(["#f4f6f1", "#141a16"]));
});

test("a long translation name never widens the page", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Translation for Read online links").selectOption("NRSVUE");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("the installed app is not locked to one orientation", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.orientation).toBeUndefined();
});
