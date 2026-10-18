import Link from "next/link";
import { authCurrent, casesAssignable, crmClients } from "@murafaa/sdk";
import { t } from "@murafaa/i18n";
import { CaseForm } from "@/components/cases/case-form";
import { DeniedPanel } from "@/components/denied-panel";
import { serverApi } from "@/lib/api";

export default async function NewCasePage() {
  const api = await serverApi();
  const [me, users, clients] = await Promise.all([
    authCurrent({ client: api }),
    casesAssignable({ client: api }),
    crmClients({ client: api }),
  ]);
  const level = me.data?.data.modules.CASES;
  if (!(level === "EDIT" || level === "FULL") || me.data?.data.user.previewRole)
    return <DeniedPanel />;

  return (
    <>
      <Link href="/cases" className="backbtn">
        ‹ {t("cases.title")}
      </Link>
      <div className="vhead">
        <h2>{t("cases.new.title")}</h2>
      </div>
      <CaseForm
        mode="create"
        clients={clients.data?.data.map((c) => ({ id: c.id, name: c.name })) ?? null}
        users={users.data?.data ?? []}
        currentUserId={me.data?.data.user.id}
      />
    </>
  );
}
