import Link from "next/link";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { ConflictBadge } from "@/components/conflict-badge";
import { getSession } from "@/lib/auth/session";
import { listCases } from "@/server/cases";
import { PermissionError } from "@/lib/permissions/guard";
import { caseStatusLabel, stageLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";
import { redirect } from "next/navigation";

export default async function CasesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const cases = await listCases(session);
    content =
      cases.length === 0 ? (
        <p className="text-ink-soft">{t("cases.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th className="p-3 font-medium">{t("cases.number")}</th>
                <th className="p-3 font-medium">{t("cases.title")}</th>
                <th className="p-3 font-medium">{t("cases.client")}</th>
                <th className="p-3 font-medium">{t("cases.opponent")}</th>
                <th className="p-3 font-medium">{t("cases.stage")}</th>
                <th className="p-3 font-medium">{t("cases.status")}</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="border-b border-parch-line last:border-0 hover:bg-parch">
                  <td className="p-3">
                    <Link href={`/cases/${c.id}`} className="text-bench hover:underline">
                      {c.number}
                    </Link>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/cases/${c.id}`} className="font-medium hover:underline">
                        {c.title}
                      </Link>
                      <ConflictBadge severity={c.conflictSeverity} />
                    </div>
                  </td>
                  <td className="p-3 text-ink-soft">{c.client?.name ?? "—"}</td>
                  <td className="p-3 text-ink-soft">{c.opposingParty ?? "—"}</td>
                  <td className="p-3">{stageLabel(c.stage)}</td>
                  <td className="p-3">{caseStatusLabel(c.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <h1 className="mb-6 font-serif text-3xl text-bench">{t("cases.title")}</h1>
      {content}
    </AppShell>
  );
}
