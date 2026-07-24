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
        <div className="mb-4 flex items-center gap-3">
          <Link href={`/documents${caseId ? `?caseId=${caseId}` : ""}`} className="text-sm text-ink-soft hover:underline">
            → {t("documents.templates")}
          </Link>
        </div>
        <h1 className="font-serif text-3xl text-bench">{form.template.title}</h1>
        <p className="mt-1 mb-6 text-sm text-ink-soft">
          {form.caseTitle
            ? t("documents.caseAutofill", { title: form.caseTitle })
            : t("documents.noCaseAutofill")}
        </p>

        <form action={generateAction} className="max-w-3xl space-y-4">
          <input type="hidden" name="templateKey" value={form.template.key} />
          {form.caseId && <input type="hidden" name="caseId" value={form.caseId} />}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {form.fields.map((f) => {
              const value = form.values[f.id] ?? "";
              const full = f.type === "textarea" ? "md:col-span-2" : "";
              return (
                <div key={f.id} className={`flex flex-col gap-1 ${full}`}>
                  <label htmlFor={`field_${f.id}`} className="text-sm font-medium">
                    {f.label}
                  </label>
                  {f.type === "select" ? (
                    <select
                      id={`field_${f.id}`}
                      name={`field_${f.id}`}
                      defaultValue={value}
                      className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
                    >
                      {(f.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      id={`field_${f.id}`}
                      name={`field_${f.id}`}
                      defaultValue={value}
                      rows={3}
                      className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
                    />
                  ) : (
                    <input
                      id={`field_${f.id}`}
                      name={`field_${f.id}`}
                      defaultValue={value}
                      className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="submit"
            className="rounded-xl bg-bench px-5 py-2.5 text-sm font-medium text-white hover:bg-bench-2"
          >
            {t("documents.generate")}
          </button>
        </form>
      </>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return <AppShell>{content}</AppShell>;
}
