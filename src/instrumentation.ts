/**
 * Next.js runs this once per server process, before the first request.
 * Used to fail fast on misconfiguration rather than serve traffic that will
 * silently lose data. See src/lib/config/env.ts for what is checked and why.
 */
export async function register() {
  // Only the Node runtime has process.env fully populated; the Edge runtime
  // (middleware) loads this too and must not run the check.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertEnv } = await import("@/lib/config/env");

  try {
    assertEnv();
  } catch (err) {
    // Throwing is NOT enough. Next catches an error from register(), logs
    // "Failed to prepare server", and then serves traffic anyway — verified
    // against the built image, where a container with STORAGE_DRIVER=local in
    // production still reported "Ready" and answered /api/health.
    //
    // A revision that will silently destroy uploaded documents must never
    // accept a request, so exit explicitly: the container dies, the Cloud Run
    // revision fails health checks, and traffic is never shifted to it.
    console.error(String(err instanceof Error ? err.message : err));
    process.exit(1);
  }
}
