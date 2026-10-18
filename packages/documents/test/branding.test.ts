import { describe, expect, it } from "vitest";
import { DEFAULT_BRANDING, resolveBranding } from "../src/branding.js";

describe("resolveBranding", () => {
  it("falls back to the defaults for missing or empty branding", () => {
    expect(resolveBranding(null)).toEqual(DEFAULT_BRANDING);
    expect(resolveBranding({ name: "مكتب" }).name).toBe("مكتب");
    expect(resolveBranding({ name: "مكتب" }).tagline).toBe(DEFAULT_BRANDING.tagline);
  });

  it("only accepts strict hex colours (they enter a CSS context)", () => {
    expect(resolveBranding({ primaryColor: "#123abc" }).primaryColor).toBe("#123abc");
    expect(resolveBranding({ primaryColor: "red;}</style><script>" }).primaryColor).toBe(
      DEFAULT_BRANDING.primaryColor,
    );
    expect(resolveBranding({ accentColor: "url(http://x)" }).accentColor).toBe(
      DEFAULT_BRANDING.accentColor,
    );
  });
});
