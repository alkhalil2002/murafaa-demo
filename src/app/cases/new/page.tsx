import { redirect } from "next/navigation";
import Link from "next/link";
import { PermModule } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { NajizPicker, NajizFieldLabel } from "@/components/cases/najiz-picker";
import { RolePicker } from "@/components/cases/role-picker";
import { getSession } from "@/lib/auth/session";
import { listAssignableUsers } from "@/server/cases";
import { listClients } from "@/server/clients";
import { canAction } from "@/lib/permissions/guard";
import { SAUDI_CITIES } from "@/lib/cities";
import { t } from "@/lib/i18n";
import { createCaseAction } from "../actions";

export default async function NewCasePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const canCreate = await canAction(session, PermModule.CASES, "edit");
  if (!canCreate) {
    return (
      <AppShell>
        <DeniedPanel />
      </AppShell>
    );
  }

  const assignableUsers = await listAssignableUsers(session);
  let clients: Awaited<ReturnType<typeof listClients>> = [];
  let clientsAvailable = true;
  try {
    clients = await listClients(session);
  } catch {
    clientsAvailable = false;
  }

  return (
    <AppShell>
      <Link href="/cases" className="backbtn">
        ‹ {t("cases.title")}
      </Link>
      <div className="vhead">
        <h2>{t("cases.new.title")}</h2>
      </div>

      <form action={createCaseAction} className="panel">
        <div className="two">
          <div className="field">
            <label>{t("cases.new.number")}</label>
            <input type="text" name="number" placeholder="1446/XXX" required />
          </div>
          <div className="field">
            <label>{t("cases.new.title.field")}</label>
            <input type="text" name="title" required />
          </div>
        </div>

        <div className="field">
          <label>{t("cases.new.roleLabel")}</label>
        </div>
        <div className="sub" style={{ marginTop: -8 }}>
          {t("cases.new.roleHint")}
        </div>
        <RolePicker />

        <div className="two">
          <div className="field">
            <label>
              {t("cases.new.client")} <span className="req" aria-hidden="true">*</span>
            </label>
            {clientsAvailable ? (
              /* Required (docs/06 §case-client). `required` on a select with an
                 empty-valued first option is what makes the browser block
                 submission — the server enforces it regardless, this just says
                 so before a round trip. */
              <select name="clientId" defaultValue="" required>
                <option value="">{t("cases.new.clientPick")}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="sub" style={{ marginBottom: 0 }}>
                {t("cases.new.clientsUnavailable")}
              </div>
            )}
          </div>
          <div className="field">
            <label>{t("cases.new.opponent")}</label>
            <input type="text" name="opposingParty" placeholder={t("cases.new.opponentPlaceholder")} />
          </div>
        </div>

        <div className="field">
          <NajizFieldLabel />
          <NajizPicker />
        </div>

        <div className="field">
          <label>{t("cases.new.city")}</label>
          <select name="city" defaultValue={SAUDI_CITIES[0]}>
            {SAUDI_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>
            {t("cases.new.assignees")} <span className="hint">{t("cases.new.assigneesHint")}</span>
          </label>
          {assignableUsers.length <= 1 ? (
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("cases.new.assigneesEmpty")}
            </div>
          ) : (
            <div className="chips">
              {assignableUsers
                .filter((u) => u.id !== session.userId)
                .map((u) => (
                  <label key={u.id} className="chip" style={{ display: "inline-flex", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" name="assigneeIds" value={u.id} />
                    {u.name}
                  </label>
                ))}
            </div>
          )}
        </div>

        <div className="actions">
          <button type="submit" className="act b-add">
            {t("cases.new.submit")}
          </button>
          <Link href="/cases" className="mini">
            {t("cases.new.cancel")}
          </Link>
        </div>
      </form>
    </AppShell>
  );
}
