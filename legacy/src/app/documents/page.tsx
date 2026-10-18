import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { IconDocuments } from "@/components/icons";
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
      <div className="panel">
        {templates.map((tpl) => (
          <Link key={tpl.id} href={`/documents/new/${tpl.key}${qs}`} className="tpl">
            <div className="ti">
              <IconDocuments />
            </div>
            <div>
              <div className="tt">{tpl.title}</div>
              <div className="tc">{docCategoryLabel(tpl.category)}</div>
            </div>
            <span className="use">{t("documents.create")} ›</span>
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
      <div className="vhead">
        <h2>{t("documents.templates")}</h2>
        <span className="pill">{t("documents.templatesHint")}</span>
      </div>
      {content}
    </AppShell>
  );
}
