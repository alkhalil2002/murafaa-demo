import { describe, expect, it } from "vitest";
import { isIpAllowed } from "../src/common/security/ip-allowlist.js";

describe("isIpAllowed", () => {
  it("is unrestricted when the allowlist is empty", () => {
    expect(isIpAllowed("198.51.100.7", [])).toBe(true);
    expect(isIpAllowed(null, [])).toBe(true);
  });

  it("matches exact addresses and CIDR blocks", () => {
    expect(isIpAllowed("203.0.113.5", ["203.0.113.5"])).toBe(true);
    expect(isIpAllowed("203.0.113.77", ["203.0.113.0/24"])).toBe(true);
    expect(isIpAllowed("203.0.114.1", ["203.0.113.0/24"])).toBe(false);
    expect(isIpAllowed("10.1.2.3", ["0.0.0.0/0"])).toBe(true);
  });

  it("fails closed on unknown IPs and malformed entries", () => {
    expect(isIpAllowed(null, ["203.0.113.5"])).toBe(false);
    expect(isIpAllowed("203.0.113.5", ["203.0.113.0/33", "not-an-ip"])).toBe(false);
  });

  it("matches IPv6 entries exactly", () => {
    expect(isIpAllowed("2001:db8::1", ["2001:db8::1"])).toBe(true);
    expect(isIpAllowed("2001:db8::2", ["2001:db8::1"])).toBe(false);
  });
});
