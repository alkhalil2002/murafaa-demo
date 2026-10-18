import Link from "next/link";
import { documentsTemplateForm } from "@murafaa/sdk";
import { t } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { GenerateForm } from "@/components/documents/generate-form";
import { serverApi } from "@/lib/api";

/** Fill a template (prefilled from the case) and generate the letterhead PDF (legacy generate page). */
export default async function GenerateDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ caseId?: string }>;
}) {
  const { key } = await params;
  const { caseId } = await searchParams;
  const form = (
    await documentsTemplateForm({
      client: await serverApi(),
      path: { key },
      query: caseId ? { caseId } : {},
    })
  ).data?.data;
  if (!form) return <DeniedPanel />;
  return (
    <>
      <Link
        href={`/documents${caseId ? `?caseId=${encodeURIComponent(caseId)}` : ""}`}
        className="backbtn"
      >
        ‹ {t("documents.templates")}
      </Link>
      <div className="vhead">
        <h2>{form.template.title}</h2>
        <span className="pill">
          {form.caseTitle
            ? t("documents.caseAutofill", { title: form.caseTitle })
            : t("documents.noCaseAutofill")}
        </span>
      </div>
      <GenerateForm form={form} />
    </>
  );
}
