"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { casesCreate, casesUpdate } from "@murafaa/sdk";
import { CASE_STATUSES, NAJIZ, SAUDI_CITIES } from "@murafaa/rules";
import { t, type MessageKey } from "@murafaa/i18n";
import { browserApi } from "@/lib/browser-api";
import { useApiAction } from "@/lib/use-api-action";

const NAJIZ_MAP = NAJIZ as Record<string, Record<string, readonly string[]>>;
const MAIN_CLASSES = Object.keys(NAJIZ_MAP);
const firstSub = (main: string) => Object.keys(NAJIZ_MAP[main] ?? {})[0] ?? "";
const firstType = (main: string, sub: string) => NAJIZ_MAP[main]?.[sub]?.[0] ?? "";

type Role = "PLAINTIFF" | "DEFENDANT";
type Status = (typeof CASE_STATUSES)[number];

export type CaseFormValues = {
  number: string;
  title: string;
  clientRole: Role;
  clientId: string;
  opposingParty: string;
  entity: string;
  najizMainClass: string;
  najizSubClass: string;
  najizCaseType: string;
  city: string;
  status: Status;
  assigneeIds: string[];
};

/** Plaintiff / defendant cards (legacy role-picker). */
function RolePicker({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <div className="roles">
      <div
        className={`role plaintiff${value === "PLAINTIFF" ? " sel" : ""}`}
        onClick={() => onChange("PLAINTIFF")}
      >
        <b>{t("cases.role.plaintiff")}</b>
        <small>{t("cases.new.plaintiffHint")}</small>
      </div>
      <div
        className={`role defendant${value === "DEFENDANT" ? " sel" : ""}`}
        onClick={() => onChange("DEFENDANT")}
      >
        <b>{t("cases.role.defendant")}</b>
        <small>{t("cases.new.defendantHint")}</small>
      </div>
    </div>
  );
}

/**
 * New-case and edit-case form (legacy /cases/new and the overview edit
 * panel): role cards, client, opponent, cascading Najiz picker, city and,
 * on create, extra assignees.
 */
export function CaseForm({
  mode,
  caseId,
  initial,
  clients,
  users,
  currentUserId,
}: {
  mode: "create" | "edit";
  caseId?: string;
  initial?: Partial<CaseFormValues>;
  clients: Array<{ id: string; name: string }> | null;
  users?: Array<{ id: string; name: string }>;
  currentUserId?: string;
}) {
  const router = useRouter();
  const { run, pending, error } = useApiAction();
  const main0 =
    initial?.najizMainClass && NAJIZ_MAP[initial.najizMainClass]
      ? initial.najizMainClass
      : MAIN_CLASSES[0]!;
  const sub0 =
    initial?.najizSubClass && NAJIZ_MAP[main0]?.[initial.najizSubClass]
      ? initial.najizSubClass
      : firstSub(main0);
  const [v, setV] = useState<CaseFormValues>({
    number: initial?.number ?? "",
    title: initial?.title ?? "",
    clientRole: initial?.clientRole ?? "PLAINTIFF",
    clientId: initial?.clientId ?? "",
    opposingParty: initial?.opposingParty ?? "",
    entity: initial?.entity ?? "",
    najizMainClass: main0,
    najizSubClass: sub0,
    najizCaseType: initial?.najizCaseType ?? firstType(main0, sub0),
    city: initial?.city ?? SAUDI_CITIES[0],
    status: initial?.status ?? "ACTIVE",
    assigneeIds: [],
  });
  const set = <K extends keyof CaseFormValues>(k: K, value: CaseFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: value }));

  const body = {
    number: v.number,
    title: v.title,
    clientRole: v.clientRole,
    clientId: v.clientId || null,
    opposingParty: v.opposingParty,
    najizMainClass: v.najizMainClass,
    najizSubClass: v.najizSubClass,
    najizCaseType: v.najizCaseType,
    city: v.city,
  };

  return (
    <form
      className={mode === "create" ? "panel" : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        if (mode === "create") {
          run(async () => {
            const res = await casesCreate({
              client: browserApi,
              body: { ...body, assigneeIds: v.assigneeIds },
            });
            if (res.data) router.push(`/cases/${res.data.data.id}`);
            return res;
          });
        } else {
          run(() =>
            casesUpdate({
              client: browserApi,
              path: { id: caseId! },
              body: { ...body, entity: v.entity, status: v.status },
            }),
          );
        }
      }}
    >
      <div className="two">
        <div className="field">
          <label>{t("cases.new.number")}</label>
          <input
            type="text"
            value={v.number}
            onChange={(e) => set("number", e.target.value)}
            placeholder="1446/XXX"
            required
          />
        </div>
        <div className="field">
          <label>{t("cases.new.title.field")}</label>
          <input
            type="text"
            value={v.title}
            onChange={(e) => set("title", e.target.value)}
            required
          />
        </div>
      </div>
      {mode === "edit" && (
        <div className="field">
          <label>{t("cases.edit.status")}</label>
          <select value={v.status} onChange={(e) => set("status", e.target.value as Status)}>
            {CASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`case.status.${s}` as MessageKey)}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label>{t("cases.new.roleLabel")}</label>
      </div>
      {mode === "create" && (
        <div className="sub" style={{ marginTop: -8 }}>
          {t("cases.new.roleHint")}
        </div>
      )}
      <RolePicker value={v.clientRole} onChange={(r) => set("clientRole", r)} />
      <div className="two">
        <div className="field">
          <label>{t("cases.new.client")}</label>
          {clients ? (
            <select value={v.clientId} onChange={(e) => set("clientId", e.target.value)}>
              <option value="">{t("cases.new.clientNone")}</option>
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
          <input
            type="text"
            value={v.opposingParty}
            onChange={(e) => set("opposingParty", e.target.value)}
            placeholder={t("cases.new.opponentPlaceholder")}
          />
        </div>
      </div>
      {mode === "edit" && (
        <div className="field">
          <label>{t("cases.edit.entity")}</label>
          <input type="text" value={v.entity} onChange={(e) => set("entity", e.target.value)} />
        </div>
      )}
      <div className="field">
        <label>{t("cases.new.classification")}</label>
        <div className="three">
          <select
            value={v.najizMainClass}
            onChange={(e) => {
              const main = e.target.value;
              const sub = firstSub(main);
              setV((prev) => ({
                ...prev,
                najizMainClass: main,
                najizSubClass: sub,
                najizCaseType: firstType(main, sub),
              }));
            }}
          >
            {MAIN_CLASSES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={v.najizSubClass}
            onChange={(e) => {
              const sub = e.target.value;
              setV((prev) => ({
                ...prev,
                najizSubClass: sub,
                najizCaseType: firstType(prev.najizMainClass, sub),
              }));
            }}
          >
            {Object.keys(NAJIZ_MAP[v.najizMainClass] ?? {}).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={v.najizCaseType} onChange={(e) => set("najizCaseType", e.target.value)}>
            {(NAJIZ_MAP[v.najizMainClass]?.[v.najizSubClass] ?? []).map((ct) => (
              <option key={ct} value={ct}>
                {ct}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label>{t("cases.new.city")}</label>
        <select value={v.city} onChange={(e) => set("city", e.target.value)}>
          {SAUDI_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {mode === "create" && users && (
        <div className="field">
          <label>{t("cases.new.assignees")}</label>
          {users.length <= 1 ? (
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("cases.new.assigneesEmpty")}
            </div>
          ) : (
            <div className="chips">
              {users
                .filter((u) => u.id !== currentUserId)
                .map((u) => (
                  <label
                    key={u.id}
                    className="chip"
                    style={{ display: "inline-flex", gap: 6, cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={v.assigneeIds.includes(u.id)}
                      onChange={(e) =>
                        set(
                          "assigneeIds",
                          e.target.checked
                            ? [...v.assigneeIds, u.id]
                            : v.assigneeIds.filter((x) => x !== u.id),
                        )
                      }
                    />
                    {u.name}
                  </label>
                ))}
            </div>
          )}
        </div>
      )}
      <div className="actions">
        <button type="submit" className="act b-add" disabled={pending}>
          {mode === "create" ? t("cases.new.submit") : t("cases.edit.save")}
        </button>
      </div>
      {error && <div className="lerr">{t(error)}</div>}
    </form>
  );
}
