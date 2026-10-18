import Link from "next/link";
import { documentsTemplates } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { IconDocuments } from "@/components/icons";
import { serverApi } from "@/lib/api";

/** Document templates (legacy documents page); `caseId` carries the case to prefill from. */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string }>;
}) {
  const { caseId } = await searchParams;
  const qs = caseId ? `?caseId=${encodeURIComponent(caseId)}` : "";
  const templates = (await documentsTemplates({ client: await serverApi() })).data?.data;
  return (
    <>
      <div className="vhead">
        <h2>{t("documents.templates")}</h2>
        <span className="pill">{t("documents.templatesHint")}</span>
      </div>
      {!templates ? (
        <DeniedPanel />
      ) : (
        <div className="panel">
          {templates.map((tpl) => (
            <Link key={tpl.key} href={`/documents/new/${tpl.key}${qs}`} className="tpl">
              <div className="ti">
                <IconDocuments />
              </div>
              <div>
                <div className="tt">{tpl.title}</div>
                <div className="tc">{t(`docCategory.${tpl.category}` as MessageKey)}</div>
              </div>
              <span className="use">{t("documents.create")} ›</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
