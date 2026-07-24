import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { listTemplates } from "@/server/templates";
import { PermissionError } from "@/lib/permissions/guard";
import { docCategoryLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { caseId } = await searchParams;
  const qs = caseId ? `?caseId=${caseId}` : "";

  let content: React.ReactNode;
  try {
    const templates = await listTemplates(session);
    content = (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((tpl) => (
          <Link
            key={tpl.id}
            href={`/documents/new/${tpl.key}${qs}`}
            className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4 transition-colors hover:border-bench"
          >
            <span className="text-2xl">📄</span>
            <div>
              <div className="font-medium">{tpl.title}</div>
              <div className="mt-1 text-xs text-ink-soft">{docCategoryLabel(tpl.category)}</div>
              <div className="mt-2 text-sm text-bench">{t("documents.create")} ›</div>
            </div>
          </Link>
        ))}
      </div>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <h1 className="mb-1 font-serif text-3xl text-bench">{t("documents.templates")}</h1>
      <p className="mb-6 text-sm text-ink-soft">{t("documents.templatesHint")}</p>
      {content}
    </AppShell>
  );
}
