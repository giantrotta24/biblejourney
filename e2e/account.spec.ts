import { expect, test } from "@playwright/test";

test("without Supabase settings the account screen says progress stays on this device", async ({ page }) => {
  await page.goto("/");
  const sections = page.getByRole("navigation", { name: "Sections" });
  await expect(sections.getByRole("link")).toHaveCount(5);

  await page.getByRole("link", { name: "Account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
  await expect(page.getByText("Accounts aren’t set up on this copy of the app.")).toBeVisible();
  await expect(page.getByText(/Your progress is saved on this device/)).toBeVisible();
  await expect(page.getByRole("button", { name: /sign-in link|Google/ })).toHaveCount(0);

  await sections.getByRole("link", { name: "Today" }).click();
  await page.getByRole("button", { name: "Mark as read" }).click();
  await expect(page.getByRole("status")).toHaveText("Marked as read");
  await expect(page.getByRole("heading", { level: 2, name: /^Today’s reading:/ })).toHaveText(/Genesis 5–7/);

  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: /^Today’s reading:/ })).toHaveText(/Genesis 5–7/);
});

test("the account link is keyboard reachable and marks the current page", async ({ page }) => {
  await page.goto("/account");
  const link = page.getByRole("link", { name: "Account" });
  await expect(link).toHaveAttribute("aria-current", "page");
  const box = await link.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});
