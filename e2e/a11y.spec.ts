import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ROUTES = [
  { path: "/", title: "One-Year Bible Journey", h1: "Today" },
  { path: "/plan", title: "The full plan · One-Year Bible Journey", h1: "The full plan" },
  { path: "/timeline", title: "The story in time · One-Year Bible Journey", h1: "The story in time" },
  { path: "/verses", title: "Memory verses · One-Year Bible Journey", h1: "Memory verses" },
  { path: "/whos-who", title: "Who’s who · One-Year Bible Journey", h1: "Who’s who" },
  { path: "/account", title: "Account · One-Year Bible Journey", h1: "Account" },
  { path: "/settings", title: "Settings · One-Year Bible Journey", h1: "Settings" },
] as const;

async function chooseTheme(page: Page, theme: "Light" | "Dark") {
  await page.goto("/settings");
  await page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name: theme }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme.toLowerCase());
}

function seedDays(page: Page, count: number, sundaySeen: number) {
  return page.evaluate(
    ({ total, seen }) =>
      new Promise<void>((resolve, reject) => {
        localStorage.setItem("bible-journey:sunday-seen", String(seen));
        const open = indexedDB.open("bible-journey");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("day_progress", "readwrite");
          tx.objectStore("day_progress").clear();
          for (let i = 0; i < total; i++) tx.objectStore("day_progress").put({ day_index: i, completed_at: new Date().toISOString() });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { total: count, seen: sundaySeen },
  );
}

const TODAY_STATES = [
  { name: "mid-plan", days: 100, seen: 16, heading: /^Today’s reading:/ },
  { name: "Sunday", days: 6, seen: 0, heading: /^Sunday deep dive:/ },
  { name: "finished", days: 312, seen: 0, heading: /You read the whole Bible/ },
] as const;

async function settle(page: Page) {
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

for (const theme of ["Light", "Dark"] as const) {
  test(`every route has no serious or critical axe violations in ${theme.toLowerCase()} theme`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await chooseTheme(page, theme);
    const problems: string[] = [];
    const pages = [...ROUTES.map((route) => ({ label: route.path, path: route.path, days: null as number | null, seen: 0, heading: null as RegExp | null })),
      ...TODAY_STATES.map((state) => ({ label: `/ (${state.name})`, path: "/", days: state.days as number | null, seen: state.seen as number, heading: state.heading as RegExp | null }))];
    for (const route of pages) {
      await page.goto(route.path);
      if (route.days !== null) {
        await seedDays(page, route.days, route.seen);
        await page.reload();
        await expect(page.getByRole("heading", { level: 2, name: route.heading! }).first()).toBeVisible();
      }
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme.toLowerCase());
      await settle(page);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
      expect(results.passes.length, route.label).toBeGreaterThan(10);
      for (const violation of results.violations) {
        if (violation.impact !== "serious" && violation.impact !== "critical") continue;
        problems.push(`${route.label} ${violation.id} (${violation.impact}): ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
      }
    }
    expect(problems).toEqual([]);
  });
}

test("each route has its own title, one h1, the main landmarks and an English lang", async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto(route.path);
    await expect(page).toHaveTitle(route.title);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(route.h1);
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Sections" })).toHaveCount(1);
  }
});

test("tabbing through every route shows a focus ring on each stop and never gets stuck", async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto(route.path);
    await settle(page);
    const seen = new Set<string>();
    for (let presses = 0; presses < 60; presses++) {
      await page.keyboard.press("Tab");
      const stop = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element || element === document.body) return null;
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        const ring = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2;
        const svgRing = element.closest("svg") !== null && element.querySelector("[data-part=focus]") !== null;
        const checkRing = element.matches("input[type=checkbox], input[type=radio], [role=radio]") && style.outlineStyle !== "none";
        return {
          key: `${element.tagName}#${element.id}|${element.getAttribute("href") ?? ""}|${element.textContent?.slice(0, 40)}|${Math.round(box.top)}`,
          name: element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 40) ?? element.tagName,
          visible: ring || svgRing || checkRing,
          size: [box.width, box.height],
        };
      });
      if (!stop) break;
      expect(stop.visible, `${route.path}: no visible focus on ${stop.name}`).toBe(true);
      if (seen.has(stop.key)) break;
      seen.add(stop.key);
    }
    expect(seen.size, `${route.path}: too few focus stops`).toBeGreaterThan(5);
  }
});

test("interactive targets are at least 44px tall", async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto(route.path);
    await settle(page);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("main a, main button, header a, main label:has(input), main select, main input:not([type=checkbox]):not([type=radio])")]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return false;
          if (element.closest("svg")) return false;
          const inline = element.tagName === "A" && getComputedStyle(element).display === "inline";
          return !inline && box.height < 44;
        })
        .map((element) => `${element.tagName} ${element.textContent?.trim().slice(0, 30)} ${Math.round(element.getBoundingClientRect().height)}px`),
    );
    expect(small, route.path).toEqual([]);
  }
});

test("the reset dialog keeps focus inside and returns it to its trigger", async ({ page }) => {
  await page.goto("/settings");
  const trigger = page.getByRole("button", { name: "Reset progress…" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox")).toBeFocused();
  for (let presses = 0; presses < 6; presses++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("the plan accordion opens and closes from the keyboard", async ({ page }) => {
  await page.goto("/plan");
  const week2 = page.getByRole("button", { name: /Wk 2 / });
  await week2.focus();
  await page.keyboard.press("Enter");
  await expect(week2).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Space");
  await expect(week2).toHaveAttribute("aria-expanded", "false");
});
