/**
 * Office IP allowlist matching (docs "الأمان" — لا حصر بعنوان شبكي). Each
 * allowlist entry is either an exact IPv4 address ("203.0.113.5") or a CIDR
 * block ("203.0.113.0/24"). An empty allowlist means unrestricted (default —
 * adding an office to this list is an explicit opt-in, never silently on).
 *
 * IPv4 entries support CIDR; any other entry (e.g. IPv6) matches exactly. The
 * client IP comes from Fastify's `request.ip` (trustProxy is on for Cloud Run).
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
    if (baseInt === null || ipInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32)
      return false;
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

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** Whether an allowlist entry is well-formed: IPv4, IPv4/CIDR (0–32), or an IPv6 address. */
export function isValidIpEntry(entry: string): boolean {
  const e = entry.trim();
  if (e.includes("/")) {
    const [base, bits] = e.split("/");
    return IPV4.test(base ?? "") && /^\d{1,2}$/.test(bits ?? "") && Number(bits) <= 32;
  }
  if (IPV4.test(e)) return true;
  // IPv6: hex groups with at most one "::" (no CIDR for IPv6, matching isIpAllowed).
  return (
    /^[0-9a-f:]+$/i.test(e) &&
    e.includes(":") &&
    (e.match(/::/g)?.length ?? 0) <= 1 &&
    e.split(":").length <= 8
  );
}
