"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

/** Auto-logout after sustained inactivity (docs "الأمان" — تسجيل خروج تلقائي
 * عند الخمول). Any of the listed activity events resets the timer; nothing
 * fires while the tab is actively used. */
const IDLE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

export function IdleLogout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void signOut({ callbackUrl: "/login" });
      }, IDLE_TIMEOUT_MS);
    }
    reset();
    for (const evt of ACTIVITY_EVENTS) window.addEventListener(evt, reset, { passive: true });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, reset);
    };
  }, []);

  return null;
}
