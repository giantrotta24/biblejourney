import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const ICONS = [
  { source: "public/icon.svg", out: "public/icons/icon-192.png", size: 192 },
  { source: "public/icon.svg", out: "public/icons/icon-512.png", size: 512 },
  { source: "public/icons/icon-maskable.svg", out: "public/icons/icon-maskable-192.png", size: 192 },
  { source: "public/icons/icon-maskable.svg", out: "public/icons/icon-maskable-512.png", size: 512 },
  { source: "public/icons/icon-maskable.svg", out: "public/icons/apple-touch-icon.png", size: 180 },
  { source: "public/icons/badge.svg", out: "public/icons/badge-96.png", size: 96 },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const { source, out, size } of ICONS) {
    const svg = await readFile(source, "utf8");
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await writeFile(out, await page.screenshot({ omitBackground: true }));
    console.log(`${out} ${size}x${size}`);
  }
} finally {
  await browser.close();
}
