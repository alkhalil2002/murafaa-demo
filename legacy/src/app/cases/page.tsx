import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { CaseList, type CaseListItem } from "@/components/cases/case-list";
import { ConflictBadge } from "@/components/conflict-badge";
import { getSession } from "@/lib/auth/session";
import { listCases } from "@/server/cases";
import { PermissionError } from "@/lib/permissions/guard";
import { caseStatusLabel, stageLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";
import { CaseStatus } from "@prisma/client";

export default async function CasesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  let pillCount = 0;
  try {
    const cases = await listCases(session);
    pillCount = cases.length;
    const items: CaseListItem[] = cases.map((c) => ({
      id: c.id,
      number: c.number,
      title: c.title,
      clientName: c.client?.name ?? null,
      opposingParty: c.opposingParty,
      city: c.city,
      category: c.najizMainClass,
      stageLabel: stageLabel(c.stage),
      statusLabel: caseStatusLabel(c.status),
      isDone: c.status === CaseStatus.CLOSED,
      conflictBadge: <ConflictBadge severity={c.conflictSeverity} />,
    }));
    content =
      items.length === 0 ? (
        <p className="text-ink-soft">{t("cases.empty")}</p>
      ) : (
        <CaseList cases={items} />
      );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("cases.title")}</h2>
        <span className="pill">{t("cases.pill", { n: pillCount.toLocaleString("ar-SA") })}</span>
      </div>
      {content}
    </AppShell>
  );
}
