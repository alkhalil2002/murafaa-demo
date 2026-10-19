import { cache } from "react";
import {
  clientPortalCaseDetail,
  clientPortalListCases,
  clientPortalMe,
  employeePortalMe,
  platformMe,
} from "@murafaa/sdk";
import { daysLeft, urgencyOf } from "@murafaa/rules";
import { t } from "@murafaa/i18n";
import { serverApi } from "./api";

/**
 * The client's cases with their details, fetched once per request: the
 * portal's approvals, documents and chat pages gather them across cases.
 */
export const clientPortalData = cache(async () => {
  const client = await serverApi();
  const me = (await clientPortalMe({ client })).data?.data ?? null;
  if (!me) return null;
  const cases = (await clientPortalListCases({ client })).data?.data ?? [];
  const details = await Promise.all(
    cases.map(
      async (c) => (await clientPortalCaseDetail({ client, path: { id: c.id } })).data?.data,
    ),
  );
  return { me, cases, details: details.filter((d) => d !== undefined) };
});

export const employeePortalMeData = cache(async () => {
  return (await employeePortalMe({ client: await serverApi() })).data?.data ?? null;
});

/** The signed-in platform member with their role's actions (the API enforces them too). */
export const platformMeData = cache(async () => {
  return (await platformMe({ client: await serverApi() })).data?.data ?? null;
});

export const arNum = (n: number) => n.toLocaleString("ar-SA");

/** Chip tone for a date by the docs/06 §9 bands (maroon only at ≤2 days). */
export function urgencyTone(iso: string): string {
  const u = urgencyOf(iso);
  return u === "overdue" || u === "critical" ? "t-danger" : u === "soon" ? "t-warn" : "t-ok";
}

/** "اليوم" / "خلال N يوم" / "منذ N يوم". */
export function urgencyText(iso: string): string {
  const n = daysLeft(iso);
  if (n < 0) return t("today.since", { n: arNum(-n) });
  if (n === 0) return t("common.today");
  return t("today.within", { n: arNum(n) });
}
