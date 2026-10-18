import { integrationsList } from "@murafaa/sdk";
import { t } from "@murafaa/i18n";
import { HR_INTEGRATION_KEYS } from "@murafaa/rules";
import { IntegrationList } from "@/components/settings/integration-list";
import { serverApi } from "@/lib/api";
import { HrHeader } from "../hr-header";

/**
 * التكاملات (legacy /hr/integrations): the HR-side platforms with their real
 * status from the API. Legacy's connect/sync toggles simulated a link that did
 * not exist, which the owner decision on fabricated integrations rules out.
 */
export default async function IntegrationsPage() {
  const all = (await integrationsList({ client: await serverApi() })).data?.data ?? [];
  const keys: readonly string[] = HR_INTEGRATION_KEYS;
  const rows = HR_INTEGRATION_KEYS.flatMap((k) => all.filter((r) => r.key === k));
  return (
    <>
      <HrHeader />
      <div className="panel">
        <div className="sub" style={{ marginBottom: 0 }}>
          {t("integration.hint")}
        </div>
      </div>
      <IntegrationList rows={rows.filter((r) => keys.includes(r.key))} />
    </>
  );
}
