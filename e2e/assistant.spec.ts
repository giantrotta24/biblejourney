import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

test("without an Anthropic key, Today says the assistant is not set up and nothing errors", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });

  await page.goto("/");
  const panel = page.getByRole("region", { name: "Ask about this reading" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("The study assistant isn’t set up on this copy of the app.")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Historical setting" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark as read" })).toBeVisible();

  const status = await page.request.get("/api/ask");
  expect(await status.json()).toEqual({ configured: false, signInRequired: true });
  const ask = await page.request.post("/api/ask", { data: { dayIndex: 0, type: "history" } });
  expect(ask.status()).toBe(503);

  expect(problems).toEqual([]);
});

test("the assistant sits on the reading view only, not the Sunday view", async ({ page }) => {
  await page.goto("/");
  const panel = page.getByRole("region", { name: "Ask about this reading" });
  await expect(panel).toBeVisible();
  const week = page.getByRole("list", { name: "This week’s readings" });
  for (const name of [/Genesis 1–4/, /Genesis 5–7/, /Job 1–4/, /Job 5–8/, /Job 9–12/]) await week.getByRole("checkbox", { name }).check();
  await expect(page.getByRole("heading", { level: 2, name: /^Today’s reading:/ })).toHaveText(/Genesis 8–11/);
  await expect(panel).toBeVisible();
  await page.getByRole("button", { name: "Mark as read" }).click();

  await expect(page.getByRole("heading", { level: 2, name: /Sunday deep dive:/ })).toBeVisible();
  await expect(panel).toHaveCount(0);

  await page.getByRole("button", { name: "Start week 2" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /^Today’s reading:/ })).toHaveText(/Job 13–15/);
  await expect(panel).toBeVisible();
});

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : [full];
  });
}

test("the client bundle never reads the server secrets", () => {
  const scripts = files(path.join(process.cwd(), ".next", "static")).filter((file) => file.endsWith(".js"));
  expect(scripts.length).toBeGreaterThan(0);
  for (const file of scripts) {
    const source = readFileSync(file, "utf8");
    expect(source, file).not.toContain("ANTHROPIC_API_KEY");
    expect(source, file).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source, file).not.toContain("@anthropic-ai/sdk");
  }
});
