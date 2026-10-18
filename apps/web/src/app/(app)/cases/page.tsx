import { casesList } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { CaseList } from "@/components/cases/case-list";
import { DeniedPanel } from "@/components/denied-panel";
import { serverApi } from "@/lib/api";

export default async function CasesPage() {
  const cases = (await casesList({ client: await serverApi() })).data?.data;
  return (
    <>
      <div className="vhead">
        <h2>{t("cases.title")}</h2>
        <span className="pill">
          {t("cases.pill", { n: (cases?.length ?? 0).toLocaleString("ar-SA") })}
        </span>
      </div>
      {!cases ? (
        <DeniedPanel />
      ) : cases.length === 0 ? (
        <p className="text-ink-soft">{t("cases.empty")}</p>
      ) : (
        <CaseList
          cases={cases.map((c) => ({
            id: c.id,
            number: c.number,
            title: c.title,
            clientName: c.clientName,
            opposingParty: c.opposingParty,
            city: c.city,
            category: c.najizMainClass,
            stageLabel: t(`case.stage.${c.stage}` as MessageKey),
            statusLabel: t(`case.status.${c.status}` as MessageKey),
            isDone: c.status === "CLOSED",
            conflictSeverity: c.conflictSeverity,
          }))}
        />
      )}
    </>
  );
}
