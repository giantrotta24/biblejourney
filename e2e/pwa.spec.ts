import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "allow" });

const reading = (page: Page) => page.getByRole("heading", { level: 2, name: /^Today’s reading:/ });

async function waitForOfflineReady(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 30_000 });
  await page.waitForFunction(
    async () => {
      const names = await caches.keys();
      const name = names.find((n) => n.startsWith("bible-journey-"));
      if (!name) return false;
      const cache = await caches.open(name);
      const saved = await Promise.all(["/", "/plan", "/verses", "/settings"].map((path) => cache.match(path)));
      return saved.every(Boolean);
    },
    undefined,
    { timeout: 30_000, polling: 250 },
  );
}

test("the manifest describes an installable app with any and maskable icons", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ name: "One-Year Bible Journey", short_name: "Bible Journey", start_url: "/", display: "standalone" });
  const purposes = manifest.icons.map((icon: { purpose: string; sizes: string }) => `${icon.purpose} ${icon.sizes}`);
  expect(purposes).toEqual(expect.arrayContaining(["any 192x192", "any 512x512", "maskable 512x512"]));
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-icon\.png/);
  await expect(page.locator('meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-capable"]').first()).toHaveAttribute("content", "yes");
});

test("Today, Plan and Verses keep working offline once the app has loaded", async ({ page, context }) => {
  await page.goto("/");
  await expect(reading(page)).toHaveText(/Genesis 1–4/);
  await page.getByRole("button", { name: "Mark as read" }).click();
  await expect(reading(page)).toHaveText(/Genesis 5–7/);
  await waitForOfflineReady(page);

  const viaWorker = await page.evaluate(async () => {
    const response = await fetch("/api/ask");
    return { ok: response.ok, controlled: navigator.serviceWorker.controller !== null, body: await response.json() };
  });
  expect(viaWorker).toMatchObject({ ok: true, controlled: true, body: { configured: false } });

  const cachedApi = await page.evaluate(async () => {
    const found: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) {
        if (new URL(request.url).pathname.startsWith("/api/")) found.push(request.url);
      }
    }
    return found;
  });
  expect(cachedApi).toEqual([]);

  await context.setOffline(true);
  const network = await page.evaluate(() => fetch("/api/reminders/send", { method: "POST" }).then(() => "online", () => "offline"));
  expect(network).toBe("offline");
  const askOffline = await page.evaluate(() => fetch("/api/ask").then(() => "answered", () => "failed"));
  expect(askOffline).toBe("failed");

  await page.reload();
  await expect(reading(page)).toHaveText(/Genesis 5–7/);
  await expect(page.getByText("You’re offline. The study assistant needs a connection; the rest of the app works as usual.")).toBeVisible();
  const ask = await page.evaluate(() => fetch("/api/ask").then(() => "answered", () => "failed"));
  expect(ask).toBe("failed");

  const sections = page.getByRole("navigation", { name: "Sections" });
  await sections.getByRole("link", { name: "Plan" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "The full plan" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Wk 1 Creation and the early world/ })).toBeVisible();

  await sections.getByRole("link", { name: "Verses" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Memory verses" })).toBeVisible();
  await expect(page.getByText(/Genesis 1:1/).first()).toBeVisible();

  await page.goto("/plan");
  await expect(page.getByRole("heading", { level: 1, name: "The full plan" })).toBeVisible();
  await page.goto("/verses");
  await expect(page.getByText(/Genesis 1:1/).first()).toBeVisible();
  await page.goto("/");
  await expect(reading(page)).toHaveText(/Genesis 5–7/);
});

test("a new build keeps the previous build's cache for old tabs and prunes anything older", async ({ page }) => {
  await page.goto("/");
  await waitForOfflineReady(page);

  const legacy = "/_next/static/chunks/legacy-build-only.js";
  await page.evaluate(async (path) => {
    await caches.open("bible-journey-older");
    const previous = await caches.open("bible-journey-previous");
    await previous.put(path, new Response("window.legacyChunk = true;", { headers: { "content-type": "application/javascript" } }));
  }, legacy);

  const served = await page.evaluate(async (path) => {
    const response = await fetch(path);
    return { status: response.status, body: await response.text() };
  }, legacy);
  expect(served).toEqual({ status: 200, body: "window.legacyChunk = true;" });

  const names = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register("/sw.js?v=e2e-next", { scope: "/", updateViaCache: "none" });
    const worker = registration.installing ?? registration.waiting ?? registration.active;
    if (worker && worker.state !== "activated") {
      await new Promise<void>((resolve) => worker.addEventListener("statechange", () => worker.state === "activated" && resolve()));
    }
    return (await caches.keys()).filter((name) => name.startsWith("bible-journey-"));
  });
  expect(names).toEqual(["bible-journey-previous", "bible-journey-e2e-next"]);
});
