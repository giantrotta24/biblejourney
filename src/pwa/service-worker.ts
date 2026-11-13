export const SERVICE_WORKER_URL = `/sw.js?v=${encodeURIComponent(process.env.NEXT_PUBLIC_BUILD_VERSION ?? "dev")}`;

export function serviceWorkerSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/", updateViaCache: "none" });
}
