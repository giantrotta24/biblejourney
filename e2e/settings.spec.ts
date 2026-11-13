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
  expect(await background()).toBe("rgb(243, 245, 249)");

  await theme.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background()).toBe("rgb(14, 20, 36)");

  await page.reload();
  expect(await themeAtBody()).toBe("dark");
  await expect(page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "Dark" })).toBeChecked();
  await page.goto("/");
  expect(await themeAtBody()).toBe("dark");
  expect(await background()).toBe("rgb(14, 20, 36)");

  await page.goto("/settings");
  await page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: "System" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await page.reload();
  expect(await themeAtBody()).toBeNull();
  expect(await background()).toBe("rgb(243, 245, 249)");
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
