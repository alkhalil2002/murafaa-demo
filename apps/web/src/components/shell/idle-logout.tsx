"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { SESSION_POLICY } from "@murafaa/auth";
import { signOut } from "@/lib/sign-out";

/**
 * Auto sign-out after sustained inactivity (docs "الأمان", legacy
 * idle-logout). Any listed activity event resets the timer. The API also
 * expires idle sessions, so this only makes the browser follow promptly.
 */
export function IdleLogout() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void signOut(router), SESSION_POLICY.idleTimeoutMs);
    }
    reset();
    for (const evt of SESSION_POLICY.activityEvents)
      window.addEventListener(evt, reset, { passive: true });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const evt of SESSION_POLICY.activityEvents) window.removeEventListener(evt, reset);
    };
  }, [router]);

  return null;
}
