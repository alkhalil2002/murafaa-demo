"use client";

import { useState } from "react";
import {
  financeAddTime,
  financeCreateInvoice,
  financeCreditNote,
  financeInvoiceFee,
  financeInvoiceTime,
  financeRecordPayment,
  financeSaveFeeAgreement,
  financeTrustMove,
  financeWriteOff,
} from "@murafaa/sdk";
import {
  FEE_TYPES,
  halalasToRiyals,
  PAYMENT_METHODS,
  riyalsToHalalas,
  TRUST_TXN_TYPES,
} from "@murafaa/rules";
import { t, type MessageKey } from "@murafaa/i18n";
import { browserApi } from "@/lib/browser-api";
import { useApiAction } from "@/lib/use-api-action";

const c = browserApi;
type Option = { id: string; name: string };

function ErrorLine({ error }: { error: MessageKey | null }) {
  return error ? <div className="lerr">{t(error)}</div> : null;
}
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
/** Riyal input → integer halalas (money is never a float). */
const sar = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v == null ? null : riyalsToHalalas(Number(v));
};

/** A form that calls the API and resets itself on success. */
function ApiForm({
  call,
  children,
  className,
  style,
  onDone,
}: {
  call: (fd: FormData) => Promise<{ error?: unknown }>;
  children: (pending: boolean) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onDone?: () => void;
}) {
  const { run, pending, error } = useApiAction();
  const [key, setKey] = useState(0);
  return (
    <>
      <form
        key={key}
        className={className}
        style={style}
        action={(fd) =>
          run(
            () => call(fd),
            () => {
              setKey((k) => k + 1);
              onDone?.();
            },
          )
        }
      >
        {children(pending)}
      </form>
      <ErrorLine error={error} />
    </>
  );
}

function ActionButton({
  label,
  className = "tinybtn",
  call,
}: {
  label: string;
  className?: string;
  call: () => Promise<{ error?: unknown }>;
}) {
  const { run, pending, error } = useApiAction();
  return (
    <>
      <button type="button" className={className} disabled={pending} onClick={() => run(call)}>
        {label}
      </button>
      <ErrorLine error={error} />
    </>
  );
}

/** New invoice with line items (prototype addInvoice / invAddItem). */
export function CreateInvoiceForm({
  clients,
  cases,
}: {
  clients: Option[];
  cases: Array<{ id: string; title: string; clientId: string | null }>;
}) {
  const [lines, setLines] = useState([0]);
  const [clientId, setClientId] = useState("");
  const next = Math.max(...lines) + 1;
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>{t("inv.new")}</h2>
      <ApiForm
        onDone={() => {
          setLines([0]);
          setClientId("");
        }}
        call={(fd) =>
          financeCreateInvoice({
            client: c,
            body: {
              clientId: str(fd, "clientId") ?? "",
              caseId: str(fd, "caseId"),
              basis: str(fd, "basis"),
              items: lines.map((i) => ({
                description: str(fd, `d${i}`) ?? "",
                quantity: Number(str(fd, `q${i}`) ?? 1),
                unitPrice: sar(fd, `p${i}`) ?? 0,
              })),
            },
          })
        }
      >
        {(pending) => (
          <>
            <div className="three">
              <div className="field">
                <label>{t("inv.client")}</label>
                <select
                  name="clientId"
                  required
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="" disabled>
                    {t("inv.selectClient")}
                  </option>
                  {clients.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{t("inv.case")}</label>
                <select name="caseId" defaultValue="">
                  <option value="">{t("inv.noCase")}</option>
                  {cases
                    .filter((k) => !clientId || k.clientId === clientId)
                    .map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.title}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label>{t("inv.basis")}</label>
                <input type="text" name="basis" />
              </div>
            </div>
            {lines.map((i) => (
              <div className="three" key={i} style={{ alignItems: "flex-end" }}>
                <div className="field">
                  <label>{t("inv.description")}</label>
                  <input type="text" name={`d${i}`} required />
                </div>
                <div className="field">
                  <label>{t("inv.quantity")}</label>
                  <input type="number" name={`q${i}`} min={1} step={1} defaultValue={1} required />
                </div>
                <div className="field" style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <label>{t("inv.unitPrice")}</label>
                    <input type="number" name={`p${i}`} min="0.01" step="0.01" required />
                  </div>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      className="tinybtn del"
                      onClick={() => setLines(lines.filter((x) => x !== i))}
                    >
                      {t("inv.removeItem")}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="actions">
              <button type="button" className="tinybtn" onClick={() => setLines([...lines, next])}>
                {t("inv.addItem")}
              </button>
              <button type="submit" className="act b-add" disabled={pending}>
                {t("inv.create")}
              </button>
            </div>
          </>
        )}
      </ApiForm>
    </div>
  );
}

/** Record a receipt on an invoice. */
export function PaymentForm({ invoiceId }: { invoiceId: string }) {
  return (
    <ApiForm
      style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}
      call={(fd) =>
        financeRecordPayment({
          client: c,
          path: { id: invoiceId },
          body: {
            amount: sar(fd, "amount") ?? 0,
            method: (str(fd, "method") ?? "BANK_TRANSFER") as (typeof PAYMENT_METHODS)[number],
            reference: str(fd, "reference"),
            ...(str(fd, "date") ? { date: str(fd, "date")! } : {}),
          },
        })
      }
    >
      {(pending) => (
        <>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{t("inv.amount")}</label>
            <input
              type="number"
              name="amount"
              min="0.01"
              step="0.01"
              required
              style={{ width: 160 }}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{t("inv.method")}</label>
            <select name="method" defaultValue="BANK_TRANSFER">
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(`payMethod.${m}` as MessageKey)}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{t("inv.reference")}</label>
            <input type="text" name="reference" style={{ width: 180 }} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{t("inv.date")}</label>
            <input type="date" name="date" />
          </div>
          <button type="submit" className="act b-add" disabled={pending}>
            {t("inv.pay")}
          </button>
        </>
      )}
    </ApiForm>
  );
}

/** Credit note (with an optional reason) and bad-debt write-off, full level only. */
export function CancelControls({ invoiceId }: { invoiceId: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 14,
        borderTop: "1px solid var(--line)",
        paddingTop: 14,
      }}
    >
      <ApiForm
        style={{ display: "flex", gap: 6 }}
        call={(fd) =>
          financeCreditNote({
            client: c,
            path: { id: invoiceId },
            body: { reason: str(fd, "reason") },
          })
        }
      >
        {(pending) => (
          <>
            <input
              type="text"
              name="reason"
              placeholder={t("inv.creditNoteReason")}
              style={{ width: 200 }}
            />
            <button type="submit" className="tinybtn del" disabled={pending}>
              {t("inv.creditNote")}
            </button>
          </>
        )}
      </ApiForm>
      <ActionButton
        label={t("inv.writeOff")}
        call={() => financeWriteOff({ client: c, path: { id: invoiceId } })}
      />
    </div>
  );
}

/** Deposit / withdraw / transfer-to-fees on a client's trust (legacy trust forms). */
export function TrustMoveForm({ clients, clientId }: { clients?: Option[]; clientId?: string }) {
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>{t("trust.newMovement")}</h2>
      <ApiForm
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 14,
          alignItems: "flex-end",
        }}
        call={(fd) =>
          financeTrustMove({
            client: c,
            path: { clientId: clientId ?? str(fd, "clientId") ?? "" },
            body: {
              // The pressed button names the movement (deposit / withdraw / transfer).
              type: (str(fd, "type") ?? "DEPOSIT") as (typeof TRUST_TXN_TYPES)[number],
              amount: sar(fd, "amount") ?? 0,
              note: str(fd, "note"),
              ...(str(fd, "date") ? { date: str(fd, "date")! } : {}),
            },
          })
        }
      >
        {(pending) => (
          <>
            {clients && (
              <div className="field">
                <label>{t("trust.client")}</label>
                <select name="clientId" defaultValue="" required>
                  <option value="" disabled>
                    {t("trust.selectClient")}
                  </option>
                  {clients.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label>{t("trust.amount")}</label>
              <input type="number" name="amount" min="0.01" step="0.01" required />
            </div>
            <div className="field">
              <label>{t("trust.date")}</label>
              <input type="date" name="date" />
            </div>
            <div className="field">
              <label>{t("trust.note")}</label>
              <input type="text" name="note" />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {TRUST_TXN_TYPES.map((type, i) => (
                <button
                  key={type}
                  type="submit"
                  name="type"
                  value={type}
                  className={i === 0 ? "act b-add" : "tinybtn"}
                  disabled={pending}
                >
                  {t(`trust.type.${type}` as MessageKey)}
                </button>
              ))}
            </div>
          </>
        )}
      </ApiForm>
    </div>
  );
}

type Fee = {
  type: (typeof FEE_TYPES)[number];
  feeValue: number | null;
  percentageBps: number | null;
  awarded: number | null;
} | null;

/** Add or edit the case fee agreement (legacy case finance tab). */
export function FeeAgreementForm({ caseId, fee }: { caseId: string; fee: Fee }) {
  return (
    <details style={{ marginTop: 12 }}>
      <summary
        style={{ cursor: "pointer", fontSize: 15.625, color: "var(--bench)", fontWeight: 600 }}
      >
        {fee ? t("cases.finance.editFee") : t("cases.finance.addFee")}
      </summary>
      <ApiForm
        style={{ marginTop: 10 }}
        call={(fd) => {
          const pct = str(fd, "percentage");
          return financeSaveFeeAgreement({
            client: c,
            path: { id: caseId },
            body: {
              type: (str(fd, "type") ?? "FLAT") as (typeof FEE_TYPES)[number],
              feeValue: sar(fd, "feeValue"),
              percentageBps: pct == null ? null : Math.round(Number(pct) * 100),
              awarded: sar(fd, "awarded"),
            },
          });
        }}
      >
        {(pending) => (
          <>
            <div className="two">
              <div className="field">
                <label>{t("cases.finance.feeType")}</label>
                <select name="type" defaultValue={fee?.type ?? "FLAT"}>
                  {FEE_TYPES.map((ft) => (
                    <option key={ft} value={ft}>
                      {t(`feeType.${ft}` as MessageKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{t("cases.finance.feeValue")}</label>
                <input
                  type="number"
                  name="feeValue"
                  min="0"
                  step="0.01"
                  defaultValue={fee?.feeValue ? halalasToRiyals(fee.feeValue) : ""}
                />
              </div>
              <div className="field">
                <label>{t("cases.finance.percentage")}</label>
                <input
                  type="number"
                  name="percentage"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={fee?.percentageBps ? fee.percentageBps / 100 : ""}
                />
              </div>
              <div className="field">
                <label>{t("cases.finance.awarded")}</label>
                <input
                  type="number"
                  name="awarded"
                  min="0"
                  step="0.01"
                  defaultValue={fee?.awarded ? halalasToRiyals(fee.awarded) : ""}
                />
              </div>
            </div>
            <div className="actions">
              <button type="submit" className="act b-add" disabled={pending}>
                {t("cases.finance.saveFee")}
              </button>
            </div>
          </>
        )}
      </ApiForm>
    </details>
  );
}

export function InvoiceFeeButton({ caseId }: { caseId: string }) {
  return (
    <ActionButton
      label={t("cases.finance.generateInvoice")}
      call={() => financeInvoiceFee({ client: c, path: { id: caseId } })}
    />
  );
}

/** Log time on the case (lawyer, minutes, hourly rate). */
export function TimeEntryForm({ caseId, lawyers }: { caseId: string; lawyers: Option[] }) {
  return (
    <details style={{ marginTop: 12 }}>
      <summary
        style={{ cursor: "pointer", fontSize: 15.625, color: "var(--bench)", fontWeight: 600 }}
      >
        {t("time.add")}
      </summary>
      <ApiForm
        className="three"
        style={{ marginTop: 10, alignItems: "flex-end" }}
        call={(fd) =>
          financeAddTime({
            client: c,
            body: {
              caseId,
              lawyerId: str(fd, "lawyerId") ?? "",
              minutes: Number(str(fd, "minutes") ?? 0),
              hourlyRate: sar(fd, "rate") ?? 0,
              description: str(fd, "description"),
              billable: fd.get("billable") === "on",
              ...(str(fd, "workDate") ? { workDate: str(fd, "workDate")! } : {}),
            },
          })
        }
      >
        {(pending) => (
          <>
            <div className="field">
              <label>{t("time.lawyer")}</label>
              <select name="lawyerId" defaultValue="" required>
                <option value="" disabled>
                  —
                </option>
                {lawyers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t("time.minutes")}</label>
              <input type="number" name="minutes" min={1} max={1440} step={1} required />
            </div>
            <div className="field">
              <label>{t("time.rate")}</label>
              <input type="number" name="rate" min="0.01" step="0.01" required />
            </div>
            <div className="field">
              <label>{t("time.description")}</label>
              <input type="text" name="description" />
            </div>
            <div className="field">
              <label>{t("time.workDate")}</label>
              <input type="date" name="workDate" />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" name="billable" defaultChecked />
              {t("time.billable")}
            </label>
            <button type="submit" className="act b-add" disabled={pending}>
              {t("time.add")}
            </button>
          </>
        )}
      </ApiForm>
    </details>
  );
}

export function InvoiceTimeButton({ id }: { id: string }) {
  return (
    <ActionButton
      label={t("time.invoice")}
      call={() => financeInvoiceTime({ client: c, path: { id } })}
    />
  );
}
