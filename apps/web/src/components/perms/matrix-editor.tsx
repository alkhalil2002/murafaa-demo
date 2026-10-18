"use client";

import { permissionsSetLevel, permissionsSetScope } from "@murafaa/sdk";
import { moduleLabel, permLevelLabel, roleLabel, t } from "@murafaa/i18n";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { browserApi } from "@/lib/browser-api";

type Level = "NONE" | "VIEW" | "EDIT" | "FULL";
type Row = { role: string; levels: Record<string, Level>; caseScope: "ALL" | "ASSIGNED" };

const LEVELS: Level[] = ["NONE", "VIEW", "EDIT", "FULL"];

/** Role × module matrix with the case-scope column (legacy /perms table). */
export function MatrixEditor({ rows, modules }: { rows: Row[]; modules: string[] }) {
  const levelOptions = LEVELS.map((l) => ({ value: l, label: permLevelLabel(l) }));
  const scopeOptions = [
    { value: "ALL", label: t("perms.roles.scope.all") },
    { value: "ASSIGNED", label: t("perms.roles.scope.assigned") },
  ];

  return (
    <table className="ptable">
      <thead>
        <tr>
          <th>{t("perms.tab.roles")}</th>
          {modules.map((m) => (
            <th key={m}>{moduleLabel(m)}</th>
          ))}
          <th>{t("perms.roles.scope")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.role}>
            <td style={{ fontWeight: 600 }}>{roleLabel(row.role)}</td>
            {modules.map((m) => (
              <td key={m}>
                <AutoSubmitSelect
                  label={`${roleLabel(row.role)} · ${moduleLabel(m)}`}
                  value={row.levels[m] ?? "NONE"}
                  options={levelOptions}
                  save={(level) =>
                    permissionsSetLevel({
                      client: browserApi,
                      body: { role: row.role as never, module: m as never, level: level as Level },
                    })
                  }
                />
              </td>
            ))}
            <td>
              <AutoSubmitSelect
                label={`${roleLabel(row.role)} · ${t("perms.roles.scope")}`}
                value={row.caseScope}
                options={scopeOptions}
                save={(scope) =>
                  permissionsSetScope({
                    client: browserApi,
                    body: { role: row.role as never, scope: scope as "ALL" | "ASSIGNED" },
                  })
                }
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
