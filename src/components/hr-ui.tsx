import { t, type MessageKey } from "@/lib/i18n";

/** Known service error codes that have a localized message; others fall back. */
const ERR_KEYS = new Set([
  "PAYROLL_ALREADY_RUN",
  "NO_ACTIVE_EMPLOYEES",
  "NO_PAYABLE_SALARIES",
  "LEAVE_BALANCE_INSUFFICIENT",
  "LEAVE_REQUEST_MISSING_DAYS",
  "PHONE_INVALID",
  "EMPLOYEE_ALREADY_HAS_ACCOUNT",
  "PHONE_ALREADY_IN_USE",
  "INSTALLMENT_EXCEEDS_AMOUNT",
  "INSTALLMENT_TOO_SMALL",
  "EMPLOYEE_ALREADY_TERMINATED",
  "REQUEST_ALREADY_DECIDED",
  "PERIOD_LOCKED",
]);

/** Localized banner for an action error surfaced via `?err=<code>`. */
export function ErrBanner({ code }: { code?: string }) {
  if (!code) return null;
  const key: MessageKey = code === "permission denied"
    ? "hr.err.permission"
    : ERR_KEYS.has(code)
      ? (`hr.err.${code}` as MessageKey)
      : "hr.err.default";
  return (
    <div className="mb-4 rounded-xl border border-advocate/30 bg-advocate/10 px-4 py-2.5 text-sm text-advocate">
      {t(key)}
    </div>
  );
}

/** A compact KPI card, reproducing the prototype's `.kpi`. */
export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="kpi">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
      {hint ? (
        <div className="l" style={{ marginTop: 2 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

type Tone = "ok" | "warn" | "muted" | "bad" | "gold";
const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-ok/15 text-ok",
  warn: "bg-gold/20 text-warn",
  muted: "bg-parch text-ink-soft",
  bad: "bg-advocate/15 text-advocate",
  gold: "bg-gold/25 text-warn",
};

/** A small status pill. */
export function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs ${TONE_CLASS[tone]}`}>{children}</span>;
}
