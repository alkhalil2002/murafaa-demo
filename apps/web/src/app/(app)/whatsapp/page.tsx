import Link from "next/link";
import { whatsappMessages } from "@murafaa/sdk";
import { formatWhen, t } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { serverApi } from "@/lib/api";

/** واتساب (legacy /whatsapp): message contacts staff recorded, across visible cases. */
export default async function WhatsappPage() {
  const rows = (await whatsappMessages({ client: await serverApi() })).data?.data;
  return (
    <>
      <div className="vhead">
        <h2>{t("whatsapp.title")}</h2>
        <span className="pill">{t("whatsapp.pill")}</span>
      </div>
      {!rows ? (
        <DeniedPanel />
      ) : (
        <>
          <div className="panel">
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("whatsapp.hint")}
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="panel">
              <div className="sub" style={{ marginBottom: 0 }}>
                {t("whatsapp.empty")}
              </div>
            </div>
          ) : (
            <div className="clist">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="dcard"
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <span style={{ fontSize: 22.5 }}>💬</span>
                  <div style={{ flex: 1 }}>
                    <div>{r.note}</div>
                    <div className="sub">
                      {r.clientName ?? "—"}
                      {r.clientPhone ? ` · ${r.clientPhone}` : ""} · {formatWhen(r.createdAt)}
                    </div>
                  </div>
                  <Link href={`/cases/${r.caseId}`} className="tinybtn">
                    {t("whatsapp.openCase")}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
