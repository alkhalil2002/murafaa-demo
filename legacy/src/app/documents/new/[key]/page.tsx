import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { prepareGenerateForm } from "@/server/documents";
import { PermissionError } from "@/lib/permissions/guard";
import { t } from "@/lib/i18n";
import { generateAction } from "../../actions";

export default async function GenerateDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ caseId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { key } = await params;
  const { caseId } = await searchParams;

  let content: React.ReactNode;
  try {
    const form = await prepareGenerateForm(session, key, caseId ?? null);
    content = (
      <>
        <Link href={`/documents${caseId ? `?caseId=${caseId}` : ""}`} className="backbtn">
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

        <form action={generateAction} className="panel">
          <input type="hidden" name="templateKey" value={form.template.key} />
          {form.caseId && <input type="hidden" name="caseId" value={form.caseId} />}
          <div className="two">
            {form.fields.map((f) => {
              const value = form.values[f.id] ?? "";
              return (
                <div key={f.id} className="field" style={f.type === "textarea" ? { gridColumn: "span 2" } : undefined}>
                  <label htmlFor={`field_${f.id}`}>{f.label}</label>
                  {f.type === "select" ? (
                    <select id={`field_${f.id}`} name={`field_${f.id}`} defaultValue={value}>
                      {(f.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea id={`field_${f.id}`} name={`field_${f.id}`} defaultValue={value} rows={3} />
                  ) : (
                    <input
                      type="text"
                      id={`field_${f.id}`}
                      name={`field_${f.id}`}
                      defaultValue={value}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="actions">
            <button type="submit" className="act b-add">
              {t("documents.generate")}
            </button>
          </div>
        </form>
      </>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return <AppShell>{content}</AppShell>;
}
