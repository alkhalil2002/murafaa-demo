/** A compact KPI card (prototype `.kpi`, legacy hr-ui StatCard). */
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

export type Tone = "ok" | "warn" | "muted" | "bad" | "gold";
const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-ok/15 text-ok",
  warn: "bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]",
  muted: "bg-parch text-ink-soft",
  bad: "bg-advocate/15 text-advocate",
  gold: "bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]",
};

/** A small status pill (legacy hr-ui Pill). */
export function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs ${TONE_CLASS[tone]}`}>{children}</span>
  );
}

/** A plain table in a panel (legacy HR tables). */
export function HrTable({
  head,
  children,
}: {
  head: React.ReactNode[];
  children: React.ReactNode;
}) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full text-right text-sm">
        <thead className="border-b border-line text-ink-soft">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="p-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const ROW = "border-b border-parch-line last:border-0";
export const CELL = "p-3";
export const SOFT = "p-3 text-ink-soft";
