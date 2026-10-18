/**
 * Office IP allowlist matching (docs "الأمان" — لا حصر بعنوان شبكي). Each
 * allowlist entry is either an exact IPv4 address ("203.0.113.5") or a CIDR
 * block ("203.0.113.0/24"). An empty allowlist means unrestricted (default —
 * adding an office to this list is an explicit opt-in, never silently on).
 */

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function matchesEntry(ip: string, entry: string): boolean {
  const trimmed = entry.trim();
  if (!trimmed) return false;
  if (trimmed.includes("/")) {
    const [base, bitsRaw] = trimmed.split("/");
    const bits = Number(bitsRaw);
    const baseInt = ipv4ToInt(base ?? "");
    const ipInt = ipv4ToInt(ip);
    if (baseInt === null || ipInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (baseInt & mask) === (ipInt & mask);
  }
  return trimmed === ip;
}

/** True when the allowlist is empty (unrestricted) or the IP matches an entry. */
export function isIpAllowed(ip: string | null, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  if (!ip) return false;
  return allowlist.some((entry) => matchesEntry(ip, entry));
}

/** Best-effort client IP from standard proxy headers (Cloud Run sets X-Forwarded-For). */
export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip");
}
