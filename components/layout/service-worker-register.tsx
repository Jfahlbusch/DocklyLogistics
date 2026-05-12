"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // avoid SW caching in dev
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[sw] register failed:", err);
    });
  }, []);
  return null;
}
