import { redirect } from "next/navigation";
import Link from "next/link";
import { ConflictSeverity, ConflictStatus } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { getCase } from "@/server/cases";
import { renderConflictMessage } from "@/lib/conflict/service";
import { PermissionError } from "@/lib/permissions/guard";
import {
  caseStatusLabel,
  hearingKindLabel,
  hearingStatusLabel,
  partyRoleLabel,
  stageLabel,
} from "@/lib/labels";
import { t } from "@/lib/i18n";

function fmt(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  let content: React.ReactNode;
  try {
    const c = await getCase(session, id);
    const activeFlags = c.conflictFlags.filter((f) => f.status === ConflictStatus.ACTIVE);
    const anyHigh = activeFlags.some((f) => f.severity === ConflictSeverity.HIGH);
    const messages = await Promise.all(activeFlags.map((f) => renderConflictMessage(session, f)));

    content = (
      <>
        <div className="mb-6 flex items-center gap-3">
          <Link href="/cases" className="text-sm text-ink-soft hover:underline">
            → {t("cases.title")}
          </Link>
        </div>
        <h1 className="font-serif text-3xl text-bench">{c.title}</h1>
        <p className="mt-1 text-ink-soft">
          {t("cases.number")}: {c.number} · {partyRoleLabel(c.clientRole)}
        </p>

        {activeFlags.length > 0 && (
          <div
            className={`mt-5 rounded-2xl border p-4 ${
              anyHigh ? "border-advocate bg-advocate/5" : "border-gold bg-gold/5"
            }`}
          >
            <div className="mb-2 font-semibold text-advocate">
              ⚠ {anyHigh ? t("conflict.banner.titleHigh") : t("conflict.banner.title")}
            </div>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {messages.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
            <div className="mt-3 text-xs text-ink-soft">{t("conflict.banner.footer")}</div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-line bg-white p-5 text-sm md:grid-cols-3">
          <Field label={t("cases.client")} value={c.client?.name ?? "—"} />
          <Field label={t("cases.opponent")} value={c.opposingParty ?? "—"} />
          <Field
            label={t("cases.classification")}
            value={[c.najizMainClass, c.najizSubClass, c.najizCaseType].filter(Boolean).join(" · ") || "—"}
          />
          <Field label={t("cases.stage")} value={stageLabel(c.effectiveStage)} />
          <Field label={t("cases.status")} value={caseStatusLabel(c.status)} />
          <Field label={t("cases.judgmentDate")} value={fmt(c.judgmentDate)} />
          <Field label={t("cases.objectionDue")} value={fmt(c.objectionDueAt)} />
        </div>

        <section className="mt-6">
          <h2 className="mb-3 font-serif text-xl text-bench">{t("cases.hearings")}</h2>
          {c.hearings.length === 0 ? (
            <p className="text-sm text-ink-soft">{t("common.none")}</p>
          ) : (
            <ul className="space-y-2">
              {c.hearings.map((h) => (
                <li key={h.id} className="rounded-xl border border-line bg-white p-3 text-sm">
                  <span className="font-medium">
                    {h.sequenceNo ? `#${h.sequenceNo} ` : ""}
                    {h.kind ? hearingKindLabel(h.kind) : ""}
                  </span>
                  <span className="mx-2 text-ink-soft">{fmt(h.hearingDate)}</span>
                  <span className="text-ink-soft">{hearingStatusLabel(h.status)}</span>
                  {h.result && <div className="mt-1 text-ink-soft">{h.result}</div>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6">
          <h2 className="mb-3 font-serif text-xl text-bench">{t("cases.timeline")}</h2>
          {c.events.length === 0 ? (
            <p className="text-sm text-ink-soft">{t("common.none")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {c.events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="text-ink-soft">{fmt(e.occurredAt)}</span>
                  <span>{e.description}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return <AppShell>{content}</AppShell>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-soft">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}
