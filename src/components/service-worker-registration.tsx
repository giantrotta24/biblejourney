"use client";

import { useEffect } from "react";
import { registerServiceWorker, serviceWorkerSupported } from "@/pwa/service-worker";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !serviceWorkerSupported()) return;
    const register = () => void registerServiceWorker().catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
