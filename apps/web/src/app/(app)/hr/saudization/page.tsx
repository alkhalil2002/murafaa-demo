import { hrSaudization } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { CELL, HrTable, Pill, ROW, SOFT, StatCard, type Tone } from "@/components/hr/hr-ui";
import { serverApi } from "@/lib/api";
import { HrHeader } from "../hr-header";

const BAND_TONE: Record<string, Tone> = {
  PLATINUM: "ok",
  HIGH_GREEN: "ok",
  MID_GREEN: "ok",
  LOW_GREEN: "gold",
  YELLOW: "warn",
  RED: "bad",
};
const pct = (n: number) => t("common.percent", { n: n.toLocaleString("ar-SA") });

/** السعودة / نطاقات (legacy /hr/saudization, docs/06 §6). */
export default async function SaudizationPage() {
  const sz = (await hrSaudization({ client: await serverApi() })).data?.data;
  if (!sz)
    return (
      <>
        <HrHeader />
        <DeniedPanel />
      </>
    );
  const band = (key: string) => (
    <Pill tone={BAND_TONE[key]}>{t(`nitaqat.${key}` as MessageKey)}</Pill>
  );
  return (
    <>
      <HrHeader />
      <div className="kpis">
        <StatCard label={t("hr.saudizationPct")} value={pct(Math.round(sz.pct))} />
        <div className="kpi">
          <div className="l">{t("hr.sz.target")}</div>
          <div style={{ marginTop: 6 }}>{band(sz.band)}</div>
        </div>
        <StatCard label={t("hr.kpi.staff")} value={sz.total.toLocaleString("ar-SA")} />
        <StatCard
          label={t("hr.sz.saudis")}
          value={`${sz.saudiCount.toLocaleString("ar-SA")} / ${sz.total.toLocaleString("ar-SA")}`}
        />
      </div>
      {sz.targets.length === 0 ? (
        <p className="text-ink-soft">—</p>
      ) : (
        <HrTable head={[t("hr.sz.target"), t("hr.saudizationPct"), t("hr.sz.needed")]}>
          {sz.targets.map((tg) => (
            <tr key={tg.band} className={ROW}>
              <td className={CELL}>{band(tg.band)}</td>
              <td className={SOFT}>≥ {pct(tg.minPct)}</td>
              <td className={CELL}>{tg.saudisNeeded.toLocaleString("ar-SA")}</td>
            </tr>
          ))}
        </HrTable>
      )}
    </>
  );
}
