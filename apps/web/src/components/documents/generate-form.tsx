"use client";

import { useRouter } from "next/navigation";
import { documentsGenerate } from "@murafaa/sdk";
import type { TemplateForm } from "@murafaa/sdk";
import { t } from "@murafaa/i18n";
import { browserApi } from "@/lib/browser-api";
import { useApiAction } from "@/lib/use-api-action";

/** Template fields → generate; a case document opens the case's documents, a standalone one downloads. */
export function GenerateForm({ form }: { form: TemplateForm }) {
  const router = useRouter();
  const { run, pending, error } = useApiAction();
  return (
    <form
      className="panel"
      action={(fd) => {
        const values: Record<string, string> = {};
        for (const f of form.fields) {
          const v = fd.get(`field_${f.id}`);
          if (typeof v === "string") values[f.id] = v;
        }
        run(async () => {
          const res = await documentsGenerate({
            client: browserApi,
            body: { templateKey: form.template.key, caseId: form.caseId, values },
          });
          if (res.data) {
            const doc = res.data.data;
            if (form.caseId) router.push(`/cases/${form.caseId}?tab=documents`);
            // A standalone document has no case page: download it (an API file route, not a Next page).
            else window.open(`/api/v1/documents/${doc.id}/download`, "_self");
          }
          return res;
        });
      }}
    >
      <div className="two">
        {form.fields.map((f) => {
          const value = form.values[f.id] ?? "";
          const name = `field_${f.id}`;
          return (
            <div
              key={f.id}
              className="field"
              style={f.type === "textarea" ? { gridColumn: "span 2" } : undefined}
            >
              <label htmlFor={name}>{f.label}</label>
              {f.type === "select" ? (
                <select id={name} name={name} defaultValue={value}>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea id={name} name={name} defaultValue={value} rows={3} />
              ) : (
                <input type="text" id={name} name={name} defaultValue={value} />
              )}
            </div>
          );
        })}
      </div>
      <div className="actions">
        <button type="submit" className="act b-add" disabled={pending}>
          {t("documents.generate")}
        </button>
      </div>
      {error && <div className="lerr">{t(error)}</div>}
    </form>
  );
}
