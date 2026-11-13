const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `bible-journey-${VERSION}`;
const ROUTES = ["/", "/plan", "/timeline", "/verses", "/whos-who", "/account", "/settings"];
const EXTRAS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/icon.svg",
];
const NAVIGATION_TIMEOUT_MS = 4000;
const STATIC_ASSET = /\/_next\/static\/[^"'\\\s)<>]+/g;
const CSS_URL = /url\(\s*["']?([^"')]+)["']?\s*\)/g;

function sameOrigin(url) {
  return new URL(url, self.location.origin).origin === self.location.origin;
}

async function fetchAndStore(cache, path) {
  const response = await fetch(path, { cache: "reload", credentials: "same-origin" });
  if (!response.ok) throw new Error(`Could not cache ${path}: ${response.status}`);
  await cache.put(path, response.clone());
  return response;
}

async function precache() {
  const cache = await caches.open(CACHE);
  const assets = new Set();
  for (const route of ROUTES) {
    const html = await (await fetchAndStore(cache, route)).text();
    for (const match of html.matchAll(STATIC_ASSET)) assets.add(match[0]);
  }
  await Promise.all(EXTRAS.map((path) => fetchAndStore(cache, path).catch(() => {})));
  const styles = [];
  await Promise.all(
    [...assets].map(async (path) => {
      const response = await fetchAndStore(cache, path);
      if (path.endsWith(".css")) styles.push({ path, css: await response.text() });
    }),
  );
  const fonts = new Set();
  for (const { path, css } of styles) {
    for (const match of css.matchAll(CSS_URL)) {
      const url = new URL(match[1], new URL(path, self.location.origin));
      if (url.origin === self.location.origin && !url.href.startsWith("data:")) fonts.add(url.pathname);
    }
  }
  await Promise.all([...fonts].filter((path) => !assets.has(path)).map((path) => fetchAndStore(cache, path)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const older = (await caches.keys()).filter((name) => name.startsWith("bible-journey-") && name !== CACHE);
      const keep = older.at(-1);
      await Promise.all(older.filter((name) => name !== keep).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

function routeKey(url) {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return ROUTES.includes(path) ? path : null;
}

async function cachedPage(url) {
  const cache = await caches.open(CACHE);
  const key = routeKey(url);
  return (key && (await cache.match(key))) || (await cache.match("/"));
}

async function navigate(request) {
  const url = new URL(request.url);
  const network = fetch(request).then(async (response) => {
    const key = routeKey(url);
    if (response.ok && key && response.headers.get("content-type")?.includes("text/html")) {
      const cache = await caches.open(CACHE);
      await cache.put(key, response.clone());
    }
    return response;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, NAVIGATION_TIMEOUT_MS, null));
  try {
    const first = await Promise.race([network, timeout]);
    if (first) return first;
    return (await cachedPage(url)) || (await network);
  } catch {
    const cached = await cachedPage(url);
    if (cached) return cached;
    throw new Error("Offline and this page was not saved");
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const isBuildAsset = request.url.includes("/_next/static/");
  const cached =
    (await cache.match(request, { ignoreSearch: !request.url.includes("/_next/") })) ||
    (isBuildAsset ? await caches.match(request) : undefined);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !sameOrigin(request.url)) return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;
  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
    return;
  }
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;
  event.respondWith(cacheFirst(request));
});

self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = {};
  }
  const title = message.title || "Today’s reading is ready";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: message.body || "Pick up where you left off.",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: "daily-reading",
      data: { url: message.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
