"use client";

import { permissionsSetUserRole } from "@murafaa/sdk";
import { roleLabel } from "@murafaa/i18n";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { browserApi } from "@/lib/browser-api";

const ROLES = ["PARTNER", "LAWYER", "ASSISTANT", "ACCOUNTANT", "ADMIN", "RECEPTION"] as const;

export function UserRoles({ users }: { users: Array<{ id: string; name: string; role: string }> }) {
  const options = ROLES.map((r) => ({ value: r, label: roleLabel(r) }));
  return (
    <div className="clist">
      {users.map((u) => (
        <div key={u.id} className="approve-row">
          <span className="at">{u.name}</span>
          <AutoSubmitSelect
            label={u.name}
            value={u.role}
            options={options}
            save={(role) =>
              permissionsSetUserRole({
                client: browserApi,
                path: { id: u.id },
                body: { role: role as (typeof ROLES)[number] },
              })
            }
          />
        </div>
      ))}
    </div>
  );
}
