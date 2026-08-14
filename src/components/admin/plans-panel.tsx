"use client";

import { useActionState } from "react";
import type { PlanRow } from "@/server/platform";
import {
  createPlanAction,
  deletePlanAction,
  togglePlanAction,
  type PlanActionState,
} from "@/app/admin/plan-actions";
import { formatSar } from "@/lib/money";
import { t, type MessageKey } from "@/lib/i18n";

const ERROR_KEY: Record<string, MessageKey> = {
  VALIDATION: "admin.plans.errValidation",
  CODE_TAKEN: "admin.plans.errCodeTaken",
  IN_USE: "admin.plans.errInUse",
  NOT_FOUND: "auth.error.generic",
};

const arNum = (n: number) => n.toLocaleString("ar-SA");

/**
 * Plan catalogue: list, add, retire, delete.
 *
 * Delete and retire are shown as distinct actions because they are distinct
 * decisions. A plan nobody is on can go; a plan an office is paying on is the
 * terms of a live agreement, so it can only be hidden from new signups. Rather
 * than offering one "delete" that quietly means different things, the row shows
 * the subscriber count and the delete button is disabled with the count as the
 * reason.
 */
export function PlansPanel({ plans }: { plans: PlanRow[] }) {
  const [createState, createFormAction, creating] = useActionState<PlanActionState, FormData>(
    createPlanAction,
    {},
  );
  const [deleteState, deleteFormAction] = useActionState<PlanActionState, FormData>(
    deletePlanAction,
    {},
  );

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>{t("admin.plans.title")}</h2>

      <table className="tbl">
        <thead>
          <tr>
            <th>{t("admin.plans.name")}</th>
            <th>{t("admin.plans.code")}</th>
            <th>{t("admin.plans.price")}</th>
            <th>{t("admin.plans.seats")}</th>
            <th>{t("admin.plans.subscribers")}</th>
            <th>{t("admin.plans.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id} className={p.isActive ? undefined : "plan-retired"}>
              <td>
                {p.nameAr}
                {!p.isActive && <span className="pill">{t("admin.plans.retired")}</span>}
              </td>
              <td dir="ltr">{p.code}</td>
              <td>{formatSar(p.priceHalalas)}</td>
              <td>{p.seatLimit === null ? t("admin.plans.unlimited") : arNum(p.seatLimit)}</td>
              <td>{arNum(p.subscriberCount)}</td>
              <td className="plan-actions">
                <form action={togglePlanAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="isActive" value={p.isActive ? "0" : "1"} />
                  <button type="submit" className="tinybtn">
                    {p.isActive ? t("admin.plans.retire") : t("admin.plans.restore")}
                  </button>
                </form>
                <form action={deleteFormAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    className="tinybtn danger"
                    // A plan with subscribers is a live agreement's terms. The
                    // server refuses regardless; disabling here explains why
                    // instead of letting the click fail.
                    disabled={p.subscriberCount > 0}
                    title={
                      p.subscriberCount > 0
                        ? t("admin.plans.errInUse")
                        : t("admin.plans.delete")
                    }
                  >
                    {t("admin.plans.delete")}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {plans.length === 0 && (
            <tr>
              <td colSpan={6}>{t("admin.plans.empty")}</td>
            </tr>
          )}
        </tbody>
      </table>

      {deleteState.error && (
        <div className="lerr">{t(ERROR_KEY[deleteState.error] ?? "auth.error.generic")}</div>
      )}

      <h3 style={{ marginTop: 18 }}>{t("admin.plans.add")}</h3>
      <form action={createFormAction} className="plan-form">
        <div className="field">
          <label htmlFor="p-name">{t("admin.plans.name")}</label>
          <input id="p-name" name="nameAr" required maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="p-code">{t("admin.plans.code")}</label>
          <input id="p-code" name="code" required dir="ltr" pattern="[a-z0-9_]{2,32}" />
          <div className="ob-term-hint">{t("admin.plans.codeHint")}</div>
        </div>
        <div className="field">
          <label htmlFor="p-price">{t("admin.plans.priceRiyals")}</label>
          <input id="p-price" name="priceRiyals" type="number" min={0} step={1} required />
        </div>
        <div className="field">
          <label htmlFor="p-seats">{t("admin.plans.seats")}</label>
          <input id="p-seats" name="seatLimit" type="number" min={1} step={1} />
          <div className="ob-term-hint">{t("admin.plans.seatsHint")}</div>
        </div>
        <div className="field">
          <label htmlFor="p-sort">{t("admin.plans.sortOrder")}</label>
          <input id="p-sort" name="sortOrder" type="number" min={0} step={1} defaultValue={0} />
        </div>
        <div className="plan-form-actions">
          <button type="submit" className="tinybtn" disabled={creating}>
            {creating ? t("common.loading") : t("admin.plans.add")}
          </button>
        </div>
      </form>
      {createState.error && (
        <div className="lerr">{t(ERROR_KEY[createState.error] ?? "auth.error.generic")}</div>
      )}
    </div>
  );
}
