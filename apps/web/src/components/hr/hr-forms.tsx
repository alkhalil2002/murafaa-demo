"use client";

import { useState } from "react";
import {
  hrClockOut,
  hrCreateAdvance,
  hrCreateCandidate,
  hrCreateEmployee,
  hrCreateLeave,
  hrCreateRequest,
  hrDecideRequest,
  hrGrantAccount,
  hrMoveCandidate,
  hrRemoveCandidate,
  hrRunPayroll,
  hrSetAttendance,
  hrTerminate,
  hrUpdateEmployee,
  pulseResetWeight,
  pulseSetWeight,
} from "@murafaa/sdk";
import type { CreateLeaveBody, CreateEmployeeRequestBody, GrantAccountBody } from "@murafaa/sdk";
import { Role } from "@murafaa/auth";
import { roleLabel, t, type MessageKey } from "@murafaa/i18n";
import {
  LEAD_SOURCES,
  LEAVE_TYPES,
  REQUEST_KINDS,
  SAUDI_NATIONALITY,
  type AttendanceStatus,
  type PerformanceEventKind,
  riyalsToHalalas,
} from "@murafaa/rules";
import { browserApi } from "@/lib/browser-api";
import { useApiAction } from "@/lib/use-api-action";

const c = browserApi;
const INPUT = "w-full rounded-lg border border-line bg-parch px-3 py-2 text-sm";
const BTN = "rounded-lg bg-bench px-4 py-2 text-sm font-medium text-white hover:bg-bench-2";
const BAR = "mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4";

type Option = { id: string; name: string };

function ErrorLine({ error }: { error: MessageKey | null }) {
  return error ? (
    <div className="mb-4 rounded-xl border border-advocate/30 bg-advocate/10 px-4 py-2.5 text-sm text-advocate">
      {t(error)}
    </div>
  ) : null;
}
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const int = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v == null ? null : Number(v);
};
/** Riyal input → integer halalas (money is never a float). */
const sar = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v == null ? 0 : riyalsToHalalas(Number(v));
};

/** A form that calls the API, shows its error, and resets on success. */
function ApiForm({
  call,
  children,
  className = BAR,
}: {
  call: (fd: FormData) => Promise<{ error?: unknown }>;
  children: (pending: boolean) => React.ReactNode;
  className?: string;
}) {
  const { run, pending, error } = useApiAction();
  const [key, setKey] = useState(0);
  return (
    <>
      <ErrorLine error={error} />
      <form
        key={key}
        className={className}
        action={(fd) =>
          run(
            () => call(fd),
            () => setKey((k) => k + 1),
          )
        }
      >
        {children(pending)}
      </form>
    </>
  );
}

function Field({
  label,
  children,
  grow,
}: {
  label: string;
  children: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <label className={`text-sm${grow ? " grow" : ""}`}>
      <span className="mb-1 block text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

function EmployeeSelect({ employees }: { employees: Option[] }) {
  return (
    <select name="employeeId" required className={INPUT} defaultValue="">
      <option value="" disabled>
        {t("hr.form.select")}
      </option>
      {employees.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name}
        </option>
      ))}
    </select>
  );
}

/** "موظف جديد" (legacy /hr <details> form). Salaries are typed in riyals. */
export function NewEmployeeForm() {
  return (
    <details className="mt-6 rounded-2xl border border-line bg-white p-5">
      <summary className="cursor-pointer font-serif text-lg text-bench">
        {t("hr.action.newEmployee")}
      </summary>
      <ApiForm
        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3"
        call={(fd) =>
          hrCreateEmployee({
            client: c,
            body: {
              name: str(fd, "name") ?? "",
              phone: str(fd, "phone"),
              department: str(fd, "department"),
              jobTitle: str(fd, "jobTitle"),
              nationality: str(fd, "nationality") ?? SAUDI_NATIONALITY,
              nationalId: str(fd, "nationalId"),
              iban: str(fd, "iban"),
              hireDate: str(fd, "hireDate") ?? "",
              basicSalary: sar(fd, "basicSalary"),
              allowances: sar(fd, "allowances"),
              gosiContribution: sar(fd, "gosiContribution"),
              leaveBalanceDays: int(fd, "leaveBalanceDays") ?? 0,
            },
          })
        }
      >
        {(pending) => (
          <>
            <Field label={t("hr.col.name")}>
              <input type="text" name="name" required className={INPUT} />
            </Field>
            <Field label={t("hr.phone")}>
              <input type="text" name="phone" dir="ltr" className={INPUT} />
            </Field>
            <Field label={t("hr.department")}>
              <input type="text" name="department" className={INPUT} />
            </Field>
            <Field label={t("hr.jobTitle")}>
              <input type="text" name="jobTitle" className={INPUT} />
            </Field>
            <Field label={t("hr.nationality")}>
              <input
                type="text"
                name="nationality"
                defaultValue={SAUDI_NATIONALITY}
                className={INPUT}
              />
            </Field>
            <Field label={t("hr.form.nationalId")}>
              <input type="text" name="nationalId" dir="ltr" className={INPUT} />
            </Field>
            <Field label="IBAN">
              <input type="text" name="iban" dir="ltr" className={INPUT} />
            </Field>
            {(
              [
                ["basicSalary", "hr.form.basicSalarySar", true],
                ["allowances", "hr.form.allowancesSar", false],
                ["gosiContribution", "hr.form.gosiSar", false],
              ] as const
            ).map(([name, label, required]) => (
              <Field key={name} label={t(label)}>
                <input
                  type="number"
                  name={name}
                  min={0}
                  step={0.01}
                  required={required}
                  className={INPUT}
                />
              </Field>
            ))}
            <Field label={t("hr.leaveBalance")}>
              <input type="number" name="leaveBalanceDays" min={0} step={1} className={INPUT} />
            </Field>
            <Field label={t("hr.hireDate")}>
              <input type="date" name="hireDate" required className={INPUT} />
            </Field>
            <div className="flex items-end">
              <button type="submit" className={BTN} disabled={pending}>
                {t("hr.action.save")}
              </button>
            </div>
          </>
        )}
      </ApiForm>
    </details>
  );
}

/** منح حساب نظام + دور (full HR). Only a partner is offered the partner role. */
export function GrantAccountForm({
  employeeId,
  canGrantPartner,
}: {
  employeeId: string;
  canGrantPartner: boolean;
}) {
  const roles = Object.values(Role).filter((r) => canGrantPartner || r !== Role.PARTNER);
  return (
    <ApiForm
      className="mt-2 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4"
      call={(fd) =>
        hrGrantAccount({
          client: c,
          path: { id: employeeId },
          body: {
            phone: str(fd, "phone") ?? "",
            role: str(fd, "role") as GrantAccountBody["role"],
          },
        })
      }
    >
      {(pending) => (
        <>
          <Field label={t("hr.account.phone")}>
            <input
              type="text"
              name="phone"
              dir="ltr"
              placeholder="5XXXXXXXX"
              required
              className={INPUT}
            />
          </Field>
          <Field label={t("hr.account.role")}>
            <select name="role" defaultValue={Role.RECEPTION} className={INPUT}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" className={BTN} disabled={pending}>
            {t("hr.account.grant")}
          </button>
        </>
      )}
    </ApiForm>
  );
}

export function TerminateButton({ employeeId }: { employeeId: string }) {
  const { run, pending, error } = useApiAction();
  return (
    <div className="mt-6">
      <ErrorLine error={error} />
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => hrTerminate({ client: c, path: { id: employeeId } }))}
        className="rounded-lg border border-advocate/40 bg-advocate/10 px-4 py-2 text-sm font-medium text-advocate hover:bg-advocate/20"
      >
        {t("hr.action.terminate")}
      </button>
    </div>
  );
}

export function AdvanceForm({ employees }: { employees: Option[] }) {
  return (
    <ApiForm
      call={(fd) =>
        hrCreateAdvance({
          client: c,
          body: {
            employeeId: str(fd, "employeeId") ?? "",
            amount: sar(fd, "amount"),
            months: int(fd, "months") ?? 1,
            note: str(fd, "note"),
          },
        })
      }
    >
      {(pending) => (
        <>
          <Field label={t("hr.employee")}>
            <EmployeeSelect employees={employees} />
          </Field>
          <Field label={t("hr.form.amountSar")}>
            <input type="number" name="amount" min={1} step={0.01} required className={INPUT} />
          </Field>
          <Field label={t("hr.form.months")}>
            <input
              type="number"
              name="months"
              min={1}
              defaultValue={1}
              required
              className={INPUT}
            />
          </Field>
          <Field label={t("hr.form.note")} grow>
            <input type="text" name="note" className={INPUT} />
          </Field>
          <button type="submit" className={BTN} disabled={pending}>
            {t("hr.action.newAdvance")}
          </button>
        </>
      )}
    </ApiForm>
  );
}

export function LeaveForm({ employees }: { employees: Option[] }) {
  return (
    <ApiForm
      call={(fd) =>
        hrCreateLeave({
          client: c,
          body: {
            employeeId: str(fd, "employeeId") ?? "",
            type: (str(fd, "type") ?? "ANNUAL") as CreateLeaveBody["type"],
            days: int(fd, "days") ?? 0,
            startDate: str(fd, "startDate") ?? "",
            note: str(fd, "note"),
          },
        })
      }
    >
      {(pending) => (
        <>
          <Field label={t("hr.employee")}>
            <EmployeeSelect employees={employees} />
          </Field>
          <Field label={t("hr.col.type")}>
            <select name="type" defaultValue="ANNUAL" className={INPUT}>
              {LEAVE_TYPES.map((v) => (
                <option key={v} value={v}>
                  {t(`leaveType.${v}` as MessageKey)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("hr.col.days")}>
            <input type="number" name="days" min={1} required className={INPUT} />
          </Field>
          <Field label={t("hr.form.startDate")}>
            <input type="date" name="startDate" required className={INPUT} />
          </Field>
          <Field label={t("hr.form.note")} grow>
            <input type="text" name="note" className={INPUT} />
          </Field>
          <button type="submit" className={BTN} disabled={pending}>
            {t("hr.action.newLeave")}
          </button>
        </>
      )}
    </ApiForm>
  );
}

export function RequestForm({ employees }: { employees: Option[] }) {
  return (
    <ApiForm
      call={(fd) =>
        hrCreateRequest({
          client: c,
          body: {
            employeeId: str(fd, "employeeId") ?? "",
            kind: (str(fd, "kind") ?? "OTHER") as CreateEmployeeRequestBody["kind"],
            detail: str(fd, "detail"),
            days: int(fd, "days"),
          },
        })
      }
    >
      {(pending) => (
        <>
          <Field label={t("hr.employee")}>
            <EmployeeSelect employees={employees} />
          </Field>
          <Field label={t("hr.col.type")}>
            <select name="kind" defaultValue="LEAVE" className={INPUT}>
              {REQUEST_KINDS.map((v) => (
                <option key={v} value={v}>
                  {t(`reqKind.${v}` as MessageKey)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("hr.form.days")}>
            <input
              type="number"
              name="days"
              min="1"
              step="1"
              className={INPUT}
              style={{ width: 90 }}
            />
          </Field>
          <Field label={t("hr.form.detail")} grow>
            <input type="text" name="detail" className={INPUT} />
          </Field>
          <button type="submit" className={BTN} disabled={pending}>
            {t("hr.action.newRequest")}
          </button>
        </>
      )}
    </ApiForm>
  );
}

export function DecideButtons({ id }: { id: string }) {
  const { run, pending, error } = useApiAction();
  const decide = (status: "APPROVED" | "REJECTED") =>
    run(() => hrDecideRequest({ client: c, path: { id }, body: { status } }));
  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide("APPROVED")}
          className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-1 text-xs font-medium text-ok hover:bg-ok/20"
        >
          {t("hr.action.approve")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide("REJECTED")}
          className="rounded-lg border border-advocate/40 bg-advocate/10 px-3 py-1 text-xs font-medium text-advocate hover:bg-advocate/20"
        >
          {t("hr.action.reject")}
        </button>
      </div>
      {error && <div className="mt-1 text-xs text-advocate">{t(error)}</div>}
    </>
  );
}

const ATTENDANCE_BUTTONS: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT"];

export function AttendanceButtons({
  employeeId,
  status,
}: {
  employeeId: string;
  status: AttendanceStatus | null;
}) {
  const { run, pending, error } = useApiAction();
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {ATTENDANCE_BUTTONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            onClick={() =>
              run(() =>
                hrSetAttendance({ client: c, path: { id: employeeId }, body: { status: s } }),
              )
            }
            className={`rounded-lg border px-2 py-1 text-xs ${status === s ? "border-bench bg-bench/10 text-bench" : "border-line text-ink-soft"}`}
          >
            {t(`hr.attendance.status.${s}` as MessageKey)}
          </button>
        ))}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => hrClockOut({ client: c, path: { id: employeeId } }))}
          className="rounded-lg border border-line px-2 py-1 text-xs text-ink-soft"
        >
          {t("hr.attendance.clockOut")}
        </button>
      </div>
      {error && <div className="mt-1 text-xs text-advocate">{t(error)}</div>}
    </>
  );
}

/** Defaults to the current month (legacy hard-coded July 2026). */
export function RunPayrollForm({ year, month }: { year: number; month: number }) {
  return (
    <ApiForm
      call={(fd) =>
        hrRunPayroll({
          client: c,
          body: { year: int(fd, "year") ?? year, month: int(fd, "month") ?? month },
        })
      }
    >
      {(pending) => (
        <>
          <Field label={t("hr.form.year")}>
            <input
              type="number"
              name="year"
              defaultValue={year}
              min={2000}
              max={2100}
              required
              className={INPUT}
            />
          </Field>
          <Field label={t("hr.form.month")}>
            <select name="month" defaultValue={month} className={INPUT}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {(i + 1).toLocaleString("ar-SA")}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" className={BTN} disabled={pending}>
            {t("hr.action.runPayroll")}
          </button>
        </>
      )}
    </ApiForm>
  );
}

export function PerformanceScoreForm({
  employeeId,
  score,
}: {
  employeeId: string;
  score: number | null;
}) {
  return (
    <ApiForm
      className="flex items-center gap-2"
      call={(fd) =>
        hrUpdateEmployee({
          client: c,
          path: { id: employeeId },
          body: { performanceScore: int(fd, "performanceScore") },
        })
      }
    >
      {(pending) => (
        <>
          <input
            type="number"
            name="performanceScore"
            min={0}
            max={100}
            defaultValue={score ?? ""}
            className="w-20 rounded-lg border border-line px-2 py-1"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-line px-2 py-1 text-xs text-ink-soft"
          >
            {t("hr.perf.save")}
          </button>
        </>
      )}
    </ApiForm>
  );
}

export function CandidateForm() {
  return (
    <details className="panel">
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        {t("hr.recruit.addCandidate")}
      </summary>
      <ApiForm
        className=""
        call={(fd) =>
          hrCreateCandidate({
            client: c,
            body: {
              name: str(fd, "name") ?? "",
              roleTitle: str(fd, "roleTitle"),
              source: (str(fd, "source") ?? "OTHER") as (typeof LEAD_SOURCES)[number],
            },
          })
        }
      >
        {(pending) => (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 12,
              alignItems: "flex-end",
            }}
          >
            <label className="field" style={{ flex: 1, minWidth: 160 }}>
              <span>{t("hr.recruit.name")}</span>
              <input type="text" name="name" required />
            </label>
            <label className="field" style={{ flex: 1, minWidth: 200 }}>
              <span>{t("hr.recruit.roleTitle")}</span>
              <input type="text" name="roleTitle" />
            </label>
            <label className="field" style={{ minWidth: 140 }}>
              <span>{t("hr.recruit.source")}</span>
              <select name="source" defaultValue="OTHER">
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {t(`leadSource.${s}` as MessageKey)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="act b-add" disabled={pending}>
              {t("hr.recruit.save")}
            </button>
          </div>
        )}
      </ApiForm>
    </details>
  );
}

export function CandidateControls({
  id,
  canBack,
  canForward,
}: {
  id: string;
  canBack: boolean;
  canForward: boolean;
}) {
  const { run, pending, error } = useApiAction();
  const move = (direction: 1 | -1) =>
    run(() => hrMoveCandidate({ client: c, path: { id }, body: { direction } }));
  return (
    <>
      <div className="lctrl">
        {canBack && (
          <button type="button" disabled={pending} onClick={() => move(-1)}>
            {t("leads.back")}
          </button>
        )}
        {canForward && (
          <button type="button" className="fwd" disabled={pending} onClick={() => move(1)}>
            {t("leads.advance")}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => hrRemoveCandidate({ client: c, path: { id } }))}
        >
          {t("hr.recruit.delete")}
        </button>
      </div>
      {error && <div className="lerr">{t(error)}</div>}
    </>
  );
}

/** One editable point weight (prototype pulseSaveWeights / pulseResetWeights). */
export function WeightForm({
  kind,
  points,
  isDefault,
}: {
  kind: PerformanceEventKind;
  points: number;
  isDefault: boolean;
}) {
  const { run, pending, error } = useApiAction();
  return (
    <form
      className="approve-row"
      style={{ gap: 8, alignItems: "center" }}
      action={(fd) =>
        run(() =>
          pulseSetWeight({ client: c, path: { kind }, body: { points: int(fd, "points") ?? 0 } }),
        )
      }
    >
      <span className="at">{t(`performanceEventKind.${kind}` as MessageKey)}</span>
      <input
        type="number"
        name="points"
        min="0"
        defaultValue={points}
        style={{ width: 80 }}
        key={points}
      />
      {isDefault && <span className="chip">{t("pulse.weights.default")}</span>}
      <button type="submit" className="tinybtn" disabled={pending}>
        {t("pulse.weights.save")}
      </button>
      {!isDefault && (
        <button
          type="button"
          className="tinybtn del"
          disabled={pending}
          onClick={() => run(() => pulseResetWeight({ client: c, path: { kind } }))}
        >
          {t("pulse.weights.reset")}
        </button>
      )}
      {error && <span className="lerr">{t(error)}</span>}
    </form>
  );
}
