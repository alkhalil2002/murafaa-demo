import { t } from "@murafaa/i18n";
import { CasePicker } from "@/components/portal/case-picker";
import { ChatThread } from "@/components/portal/portal-blocks";
import { clientPortalData } from "@/lib/portal-data";

/** المحادثة: the chat of one case with the office team. */
export default async function PortalChatPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const data = await clientPortalData();
  if (!data) return null;
  const wanted = (await searchParams).case;
  const c = data.details.find((d) => d.id === wanted) ?? data.details[0];
  return (
    <>
      <div className="vhead">
        <h2>{t("portal.nav.chat")}</h2>
        <span className="pill">{t("portal.chat.pill")}</span>
      </div>
      {!c ? (
        <div className="empty-list">{t("portal.dashboard.empty")}</div>
      ) : (
        <>
          <CasePicker
            cases={data.details.map((d) => ({ id: d.id, title: d.title }))}
            value={c.id}
          />
          <div className="panel">
            <ChatThread caseId={c.id} messages={c.messages} />
          </div>
        </>
      )}
    </>
  );
}
