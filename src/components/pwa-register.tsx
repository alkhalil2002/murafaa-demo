"use client";

import { useEffect } from "react";

/**
 * Registers the service worker.
 *
 * Production only: in dev the worker would serve stale build assets between
 * rebuilds and cost an hour working out why a change did not appear.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration failure must never break the app */
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
