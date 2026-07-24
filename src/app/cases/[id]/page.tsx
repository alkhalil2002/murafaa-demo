import { redirect } from "next/navigation";
import Link from "next/link";
import { ConflictSeverity, ConflictStatus } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { getCase } from "@/server/cases";
import { listDocuments } from "@/server/documents";
import { renderConflictMessage } from "@/lib/conflict/service";
import { PermissionError } from "@/lib/permissions/guard";
import { docSourceLabel } from "@/lib/labels";
import { shareDocumentAction } from "@/app/documents/actions";
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

    // Documents section is optional: hide it if the role lacks المستندات access.
    let documents: Awaited<ReturnType<typeof listDocuments>> | null = null;
    try {
      documents = await listDocuments(session, id);
    } catch {
      documents = null;
    }

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

        {documents && (
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-xl text-bench">{t("documents.caseDocs")}</h2>
              <Link
                href={`/documents?caseId=${c.id}`}
                className="rounded-xl bg-bench px-3 py-1.5 text-sm text-white hover:bg-bench-2"
              >
                {t("documents.create")}
              </Link>
            </div>
            {documents.length === 0 ? (
              <p className="text-sm text-ink-soft">{t("documents.empty")}</p>
            ) : (
              <ul className="space-y-2">
                {documents.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-3 text-sm"
                  >
                    <span>📄</span>
                    <span className="font-medium">{d.fileName}</span>
                    <span className="rounded-full bg-parch px-2 py-0.5 text-xs text-ink-soft">
                      {docSourceLabel(d.source)}
                    </span>
                    {d.clientVisible && (
                      <span className="rounded-full bg-ok/15 px-2 py-0.5 text-xs text-ok">
                        {t("documents.shared")}
                      </span>
                    )}
                    <div className="ms-auto flex items-center gap-2">
                      <a
                        href={`/api/documents/${d.id}/download`}
                        className="rounded-lg border border-line px-2.5 py-1 text-xs hover:bg-parch"
                      >
                        {t("documents.download")}
                      </a>
                      <form action={shareDocumentAction}>
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="caseId" value={c.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-line px-2.5 py-1 text-xs hover:bg-parch"
                        >
                          {d.clientVisible ? t("documents.unshare") : t("documents.share")}
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

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
