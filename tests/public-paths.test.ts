import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/auth/public-paths";

/**
 * Regression cover for the staff-session route gate.
 *
 * The gate previously allowed only "/portal", which made the entire employee
 * portal unreachable (/emp-portal/login 307'd to the staff /login) and left the
 * client portal's login page unable to request an OTP, because
 * /api/portal-auth/otp was gated too. Both portals were effectively dead.
 */
describe("isPublicPath", () => {
  it("allows the staff login page and static assets", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/favicon.ico")).toBe(true);
    expect(isPublicPath("/_next/static/chunk.js")).toBe(true);
    expect(isPublicPath("/api/auth/session")).toBe(true);
  });

  it("allows the client portal and its OTP endpoints", () => {
    expect(isPublicPath("/portal")).toBe(true);
    expect(isPublicPath("/portal/login")).toBe(true);
    expect(isPublicPath("/api/portal-auth/otp")).toBe(true);
    expect(isPublicPath("/api/portal-auth/verify")).toBe(true);
  });

  it("allows the employee portal and its OTP endpoints", () => {
    expect(isPublicPath("/emp-portal")).toBe(true);
    expect(isPublicPath("/emp-portal/login")).toBe(true);
    expect(isPublicPath("/api/emp-portal-auth/otp")).toBe(true);
    expect(isPublicPath("/api/emp-portal-auth/verify")).toBe(true);
  });

  it("allows the PWA surface — the browser fetches these uncredentialed", () => {
    for (const p of ["/manifest.webmanifest", "/sw.js", "/offline.html", "/icons/icon-192.png"]) {
      expect(isPublicPath(p)).toBe(true);
    }
  });

  it("still gates every staff route", () => {
    for (const p of [
      "/today",
      "/cases",
      "/cases/abc",
      "/finance",
      "/hr",
      "/perms",
      "/api/search",
      "/settings",
    ]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });

  it("does not let a prefix match leak past a path segment", () => {
    // "/portalX" must not inherit "/portal"'s public status.
    expect(isPublicPath("/portal-admin")).toBe(false);
    expect(isPublicPath("/emp-portalX")).toBe(false);
    expect(isPublicPath("/api/portal-authorize")).toBe(false);
  });
});
