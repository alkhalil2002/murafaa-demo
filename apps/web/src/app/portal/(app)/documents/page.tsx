import { t } from "@murafaa/i18n";
import { CasePicker } from "@/components/portal/case-picker";
import { DocRow, UploadHint } from "@/components/portal/portal-blocks";
import { PortalUploadForm } from "@/components/portal/portal-forms";
import { clientPortalData } from "@/lib/portal-data";

/** المستندات: shared by the office or uploaded by the client, across their cases. */
export default async function PortalDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const data = await clientPortalData();
  if (!data) return null;
  const only = (await searchParams).case ?? "";
  const shown = data.details.filter((d) => !only || d.id === only);
  const docs = shown
    .flatMap((d) => d.documents.map((doc) => ({ doc, caseTitle: d.title })))
    .sort((a, b) => b.doc.createdAt.localeCompare(a.doc.createdAt));
  const cases = data.details.map((d) => ({ id: d.id, title: d.title }));
  const open = data.details
    .filter((d) => d.status === "ACTIVE")
    .map((d) => ({ id: d.id, title: d.title }));
  return (
    <>
      <div className="vhead">
        <h2>{t("portal.nav.documents")}</h2>
        <span className="pill">{t("portal.documents.pill")}</span>
      </div>
      <CasePicker cases={cases} value={only} allLabel={t("portal.documents.allCases")} />
      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="panel">
          <h2>{t("portal.documents.title")}</h2>
          {docs.length === 0 ? (
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("portal.documents.empty")}
            </div>
          ) : (
            docs.map((x) => (
              <DocRow key={x.doc.id} d={x.doc} caseTitle={only ? undefined : x.caseTitle} />
            ))
          )}
        </div>
        {open.length > 0 && (
          <div className="panel">
            <h2>{t("portal.upload.title")}</h2>
            <UploadHint />
            <PortalUploadForm
              cases={open}
              caseId={only && open.some((c) => c.id === only) ? only : undefined}
            />
          </div>
        )}
      </div>
    </>
  );
}
