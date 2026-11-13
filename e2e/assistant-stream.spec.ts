import { expect, test, type Page } from "@playwright/test";

const END = "\u001E";

function mockAssistant(page: Page) {
  let release: (body: string) => void = () => {};
  const posts: string[] = [];
  page.route("**/api/ask", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { configured: true, signInRequired: false } });
    posts.push(route.request().postData() ?? "");
    const body = await new Promise<string>((resolve) => (release = resolve));
    await route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body });
  });
  return { posts, respond: (body: string) => release(body) };
}

const panel = (page: Page) => page.getByRole("region", { name: "Ask about this reading" });

test("focus moves to Stop while an answer streams and back to the quick prompt after", async ({ page }) => {
  const api = mockAssistant(page);
  await page.goto("/");
  const trigger = panel(page).getByRole("button", { name: "Where on the map" });
  await trigger.focus();
  await page.keyboard.press("Enter");

  const stop = panel(page).getByRole("button", { name: "Stop" });
  await expect(stop).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-disabled", "true");
  await trigger.dispatchEvent("click");
  await expect(stop).toBeFocused();
  expect(api.posts).toHaveLength(1);

  api.respond(`Eden sits near the Tigris and Euphrates.${END}complete`);
  await expect(panel(page).getByText("Eden sits near the Tigris and Euphrates.")).toBeVisible();
  await expect(stop).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(panel(page).locator("[aria-live=polite]")).toHaveText("Answer ready.");
  await expect(panel(page).locator("[aria-live=polite]")).not.toContainText("Tigris");
});

test("Stop returns focus to the field the question came from", async ({ page }) => {
  mockAssistant(page);
  await page.goto("/");
  const field = panel(page).getByLabel("Or ask your own question");
  await field.fill("Who was Enoch?");
  await field.press("Enter");
  const stop = panel(page).getByRole("button", { name: "Stop" });
  await expect(stop).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(panel(page).getByText("Stopped. Ask again whenever you like.")).toBeVisible();
  await expect(field).toBeFocused();
});

test("a refused answer is cleared and a length stop keeps its text with a note", async ({ page }) => {
  const api = mockAssistant(page);
  await page.goto("/");
  await panel(page).getByRole("button", { name: "Who’s who" }).click();
  await expect(panel(page).getByRole("button", { name: "Stop" })).toBeVisible();
  api.respond(`Partial words${END}refused`);
  await expect(panel(page).getByText(/can’t help with that one/)).toBeVisible();
  await expect(panel(page).getByText("Partial words")).toHaveCount(0);

  await panel(page).getByRole("button", { name: "Historical setting" }).click();
  await expect(panel(page).getByRole("button", { name: "Stop" })).toBeVisible();
  api.respond(`A long answer that ran out${END}truncated`);
  await expect(panel(page).getByText("A long answer that ran out")).toBeVisible();
  await expect(panel(page).getByText(/reached its length limit/)).toBeVisible();

  await panel(page).getByRole("button", { name: "Historical setting" }).click();
  await expect(panel(page).getByRole("button", { name: "Stop" })).toBeVisible();
  api.respond("Cut without an ending");
  await expect(panel(page).getByText("Cut without an ending")).toBeVisible();
  await expect(panel(page).getByText(/cut off part way/)).toBeVisible();
});

test("going offline keeps a finished answer on screen with the offline note beside it", async ({ page, context }) => {
  const api = mockAssistant(page);
  await page.goto("/");
  await panel(page).getByRole("button", { name: "Where on the map" }).click();
  api.respond(`Eden sits near the Tigris and Euphrates.${END}complete`);
  await expect(panel(page).getByText("Eden sits near the Tigris and Euphrates.")).toBeVisible();

  await context.setOffline(true);
  await expect(panel(page).locator("[aria-live=polite]")).toHaveText(
    "You’re offline. The study assistant needs a connection; the rest of the app works as usual.",
  );
  await expect(panel(page).getByText("Eden sits near the Tigris and Euphrates.")).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Historical setting" })).toHaveAttribute("aria-disabled", "true");

  await context.setOffline(false);
  await expect(panel(page).getByText("Eden sits near the Tigris and Euphrates.")).toBeVisible();
  await expect(panel(page).locator("[aria-live=polite]")).not.toContainText("offline");
});

test("Stop sits with the prompts, above the answer, and the loading line stays while it streams", async ({ page }) => {
  const api = mockAssistant(page);
  await page.goto("/");
  await panel(page).getByRole("button", { name: "Historical setting" }).click();
  const stop = panel(page).getByRole("button", { name: "Stop" });
  await expect(stop).toBeVisible();
  await expect(panel(page).getByText("Looking into today’s reading…")).toBeVisible();
  const stopBeforeAnswer = await stop.evaluate((button) => {
    const live = button.closest("section")!.querySelector("[aria-live=polite]")!;
    return Boolean(button.compareDocumentPosition(live) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(stopBeforeAnswer).toBe(true);
  api.respond(`Abraham came from Ur.${END}complete`);
  await expect(panel(page).getByText("Abraham came from Ur.")).toBeVisible();
  await expect(panel(page).getByText("Looking into today’s reading…")).toHaveCount(0);
});

test("a finished answer with no text shows the error notice instead of clearing the panel", async ({ page }) => {
  const api = mockAssistant(page);
  await page.goto("/");
  await panel(page).getByRole("button", { name: "Historical setting" }).click();
  await expect(panel(page).getByRole("button", { name: "Stop" })).toBeVisible();
  api.respond(`${END}complete`);
  await expect(panel(page).getByText("That didn’t go through. Please try again in a moment.")).toBeVisible();
  await expect(panel(page).getByText("Answer ready.")).toHaveCount(0);
});

test("the sign-in link in the assistant is a full-size target", async ({ page }) => {
  await page.route("**/api/ask", (route) => route.fulfill({ json: { configured: true, signInRequired: true } }));
  await page.goto("/");
  const link = panel(page).getByRole("link", { name: "Sign in" });
  await expect(link).toBeVisible();
  const box = await link.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.width).toBeGreaterThanOrEqual(44);
});
