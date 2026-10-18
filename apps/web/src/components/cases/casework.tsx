"use client";

import { useState } from "react";
import {
  caseworkAddCommunication,
  caseworkAddContract,
  caseworkAddExecutionProcedure,
  caseworkAdvanceApproval,
  caseworkCreateApproval,
  caseworkCycleExecutionProcedure,
  caseworkOpenExecution,
  caseworkRecordCollection,
  caseworkRejectApproval,
  caseworkRemoveApproval,
  caseworkRemoveCommunication,
  caseworkRemoveContract,
  caseworkRemoveExecutionProcedure,
  caseworkRequestClientApproval,
  caseworkSendMessage,
  caseworkSetExecutionStatus,
  caseworkToggleContract,
  caseworkUpdateExecution,
  caseworkUpdateExecutionProcedure,
} from "@murafaa/sdk";
import {
  CLIENT_APPROVAL_KINDS,
  CLIENT_COMMUNICATION_TYPES,
  DOC_PARTIES,
  EXEC_FILE_STATUSES,
  EXEC_PROC_TYPES,
  halalasToRiyals,
  riyalsToHalalas,
} from "@murafaa/rules";
import { t, type MessageKey } from "@murafaa/i18n";
import { browserApi } from "@/lib/browser-api";
import { fmtDate } from "@/lib/dates-ui";
import { useApiAction } from "@/lib/use-api-action";

const c = browserApi;
type Party = (typeof DOC_PARTIES)[number];
type ProcType = (typeof EXEC_PROC_TYPES)[number];

function ErrorLine({ error }: { error: MessageKey | null }) {
  return error ? <div className="lerr">{t(error)}</div> : null;
}

/** FormData text, trimmed; empty → null. */
function str(fd: FormData, name: string): string | null {
  const v = fd.get(name);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
/** Riyal text from a number input → integer halalas, or null when empty (money is never a float). */
function halalas(fd: FormData, name: string): number | null {
  const v = str(fd, name);
  return v == null ? null : riyalsToHalalas(Number(v));
}

/** One button that calls the API and refreshes the page. */
export function ActionButton({
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

/** A form whose submit calls the API, then resets itself. */
function ApiForm({
  call,
  children,
  className,
  style,
}: {
  call: (fd: FormData) => Promise<{ error?: unknown }>;
  children: (pending: boolean) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { run, pending, error } = useApiAction();
  const [formKey, setFormKey] = useState(0);
  return (
    <>
      <form
        key={formKey}
        className={className}
        style={style}
        action={(fd) =>
          run(
            () => call(fd),
            () => setFormKey((k) => k + 1),
          )
        }
      >
        {children(pending)}
      </form>
      <ErrorLine error={error} />
    </>
  );
}

// ── Contact log (parties tab) ──

export function CommunicationForm({ caseId }: { caseId: string }) {
  return (
    <ApiForm
      style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}
      call={(fd) =>
        caseworkAddCommunication({
          client: c,
          path: { id: caseId },
          body: {
            type: (str(fd, "type") ?? "CALL") as (typeof CLIENT_COMMUNICATION_TYPES)[number],
            note: str(fd, "note") ?? "",
          },
        })
      }
    >
      {(pending) => (
        <>
          <select name="type" defaultValue="CALL">
            {CLIENT_COMMUNICATION_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`clientCommunicationType.${ty}` as MessageKey)}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="note"
            placeholder={t("cases.comms.notePlaceholder")}
            required
            style={{ flex: 1, minWidth: 200 }}
          />
          <button type="submit" className="tinybtn" disabled={pending}>
            {t("cases.comms.add")}
          </button>
        </>
      )}
    </ApiForm>
  );
}

export function RemoveCommunicationButton({ caseId, id }: { caseId: string; id: string }) {
  return (
    <ActionButton
      label={t("cases.hearings.delete")}
      className="tinybtn del"
      call={() =>
        caseworkRemoveCommunication({ client: c, path: { id: caseId, communicationId: id } })
      }
    />
  );
}

// ── Chat ──

export function ChatForm({ caseId }: { caseId: string }) {
  return (
    <ApiForm
      style={{ display: "flex", gap: 6, marginTop: 10 }}
      call={(fd) =>
        caseworkSendMessage({
          client: c,
          path: { id: caseId },
          body: { body: str(fd, "body") ?? "" },
        })
      }
    >
      {(pending) => (
        <>
          <input
            type="text"
            name="body"
            placeholder={t("cases.chat.placeholder")}
            required
            style={{ flex: 1 }}
          />
          <button type="submit" className="act b-add" disabled={pending}>
            {t("cases.chat.send")}
          </button>
        </>
      )}
    </ApiForm>
  );
}

// ── Contracts ──

export function ContractForm({ caseId }: { caseId: string }) {
  return (
    <ApiForm
      style={{ display: "flex", gap: 6, marginTop: 10 }}
      call={(fd) =>
        caseworkAddContract({
          client: c,
          path: { id: caseId },
          body: { title: str(fd, "title") ?? "" },
        })
      }
    >
      {(pending) => (
        <>
          <input
            type="text"
            name="title"
            placeholder={t("cases.contracts.namePlaceholder")}
            required
            style={{ flex: 1 }}
          />
          <button type="submit" className="tinybtn" disabled={pending}>
            {t("cases.contracts.add")}
          </button>
        </>
      )}
    </ApiForm>
  );
}

export function ContractControls({ caseId, id }: { caseId: string; id: string }) {
  const path = { id: caseId, contractId: id };
  return (
    <>
      <ActionButton
        label={t("cases.contracts.toggleSign")}
        call={() => caseworkToggleContract({ client: c, path })}
      />
      <ActionButton
        label={t("cases.hearings.delete")}
        className="tinybtn del"
        call={() => caseworkRemoveContract({ client: c, path })}
      />
    </>
  );
}

// ── Internal approvals ──

export function ApprovalCreateForm({
  caseId,
  hearings,
}: {
  caseId: string;
  hearings: Array<{ id: string; sequenceNo: number | null }>;
}) {
  return (
    <ApiForm
      className="two"
      call={(fd) =>
        caseworkCreateApproval({
          client: c,
          path: { id: caseId },
          body: { title: str(fd, "title") ?? "", hearingId: str(fd, "hearingId") },
        })
      }
    >
      {(pending) => (
        <>
          <input
            type="text"
            name="title"
            placeholder={t("cases.approvals.titlePlaceholder")}
            required
          />
          {hearings.length > 0 && (
            <select name="hearingId" defaultValue="" title={t("cases.approvals.linkHearing")}>
              <option value="">{t("cases.approvals.noHearingLink")}</option>
              {hearings.map((h) => (
                <option key={h.id} value={h.id}>
                  {t("cases.hearings.sessionNo", {
                    no: (h.sequenceNo ?? 0).toLocaleString("ar-SA"),
                  })}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className="act b-add" disabled={pending}>
            {t("cases.approvals.new")}
          </button>
        </>
      )}
    </ApiForm>
  );
}

export function ApprovalControls({
  caseId,
  id,
  stage,
  canDelete,
}: {
  caseId: string;
  id: string;
  stage: string;
  canDelete: boolean;
}) {
  const path = { id: caseId, approvalId: id };
  return (
    <>
      {stage !== "APPROVED" && (
        <ActionButton
          label={t("cases.approvals.advance")}
          call={() => caseworkAdvanceApproval({ client: c, path })}
        />
      )}
      {stage !== "DRAFT" && (
        <ApiForm
          style={{ display: "inline-flex", gap: 4 }}
          call={(fd) =>
            caseworkRejectApproval({ client: c, path, body: { note: str(fd, "note") } })
          }
        >
          {(pending) => (
            <>
              <input
                type="text"
                name="note"
                placeholder={t("cases.approvals.rejectNotePlaceholder")}
                style={{ fontSize: 14.375, width: 140 }}
              />
              <button type="submit" className="tinybtn del" disabled={pending}>
                {t("cases.approvals.reject")}
              </button>
            </>
          )}
        </ApiForm>
      )}
      {canDelete && (
        <ActionButton
          label={t("cases.hearings.delete")}
          className="tinybtn del"
          call={() => caseworkRemoveApproval({ client: c, path })}
        />
      )}
    </>
  );
}

// ── Client approval requests ──

export function ClientApprovalForm({ caseId }: { caseId: string }) {
  return (
    <ApiForm
      className="two"
      style={{ marginBottom: 12 }}
      call={(fd) =>
        caseworkRequestClientApproval({
          client: c,
          path: { id: caseId },
          body: {
            title: str(fd, "title") ?? "",
            kind: (str(fd, "kind") ?? "MEMO") as (typeof CLIENT_APPROVAL_KINDS)[number],
            amount: halalas(fd, "amount"),
            note: str(fd, "note"),
          },
        })
      }
    >
      {(pending) => (
        <>
          <input
            type="text"
            name="title"
            placeholder={t("caseWorkspace.clientApprovals.titleLabel")}
            required
          />
          <select name="kind" defaultValue="MEMO">
            {CLIENT_APPROVAL_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`clientApprovalKind.${k}` as MessageKey)}
              </option>
            ))}
          </select>
          <input
            type="number"
            name="amount"
            min={0}
            step="0.01"
            placeholder={t("caseWorkspace.clientApprovals.amountLabel")}
          />
          <input
            type="text"
            name="note"
            placeholder={t("caseWorkspace.clientApprovals.noteLabel")}
          />
          <button type="submit" className="act b-add" disabled={pending}>
            {t("caseWorkspace.clientApprovals.submit")}
          </button>
        </>
      )}
    </ApiForm>
  );
}

// ── Execution ──

type ExecFile = {
  court: string | null;
  requestNo: string | null;
  amount: number | null;
  debtor: string | null;
  basis: string | null;
};

function ExecFields({ ex }: { ex?: ExecFile }) {
  return (
    <>
      <div className="two">
        <div className="field">
          <label>{t("cases.execution.court")}</label>
          <input type="text" name="court" defaultValue={ex?.court ?? ""} />
        </div>
        <div className="field">
          <label>{t("cases.execution.requestNo")}</label>
          <input type="text" name="requestNo" defaultValue={ex?.requestNo ?? ""} />
        </div>
      </div>
      <div className="two">
        <div className="field">
          <label>{t("cases.execution.amount")}</label>
          <input
            type="number"
            step="0.01"
            min="0"
            name="amount"
            defaultValue={ex?.amount != null ? halalasToRiyals(ex.amount) : ""}
          />
        </div>
        <div className="field">
          <label>{t("cases.execution.debtor")}</label>
          <input type="text" name="debtor" defaultValue={ex?.debtor ?? ""} />
        </div>
      </div>
      <div className="field">
        <label>{t("cases.execution.basis")}</label>
        <input type="text" name="basis" defaultValue={ex?.basis ?? ""} />
      </div>
    </>
  );
}

const execBody = (fd: FormData) => ({
  court: str(fd, "court"),
  requestNo: str(fd, "requestNo"),
  amount: halalas(fd, "amount"),
  debtor: str(fd, "debtor"),
  basis: str(fd, "basis"),
});

export function OpenExecutionForm({ caseId }: { caseId: string }) {
  return (
    <ApiForm
      call={(fd) => caseworkOpenExecution({ client: c, path: { id: caseId }, body: execBody(fd) })}
    >
      {(pending) => (
        <>
          <ExecFields />
          <div className="actions">
            <button type="submit" className="act b-add" disabled={pending}>
              {t("cases.execution.open")}
            </button>
          </div>
        </>
      )}
    </ApiForm>
  );
}

export function EditExecutionForm({ caseId, ex }: { caseId: string; ex: ExecFile }) {
  return (
    <details style={{ marginBottom: 12 }}>
      <summary
        style={{ cursor: "pointer", fontSize: 15.625, color: "var(--bench)", fontWeight: 600 }}
      >
        {t("cases.execution.editFile")}
      </summary>
      <ApiForm
        style={{ marginTop: 10 }}
        call={(fd) =>
          caseworkUpdateExecution({ client: c, path: { id: caseId }, body: execBody(fd) })
        }
      >
        {(pending) => (
          <>
            <ExecFields ex={ex} />
            <div className="actions">
              <button type="submit" className="act b-add" disabled={pending}>
                {t("common.save")}
              </button>
            </div>
          </>
        )}
      </ApiForm>
    </details>
  );
}

export function ExecutionStatusControls({ caseId, status }: { caseId: string; status: string }) {
  const set = (s: (typeof EXEC_FILE_STATUSES)[number]) =>
    caseworkSetExecutionStatus({ client: c, path: { id: caseId }, body: { status: s } });
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
      <ApiForm
        style={{ display: "flex", gap: 8 }}
        call={(fd) => set((str(fd, "status") ?? status) as (typeof EXEC_FILE_STATUSES)[number])}
      >
        {(pending) => (
          <>
            <select name="status" defaultValue={status}>
              {EXEC_FILE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`execFileStatus.${s}` as MessageKey)}
                </option>
              ))}
            </select>
            <button type="submit" className="tinybtn" disabled={pending}>
              {t("common.save")}
            </button>
          </>
        )}
      </ApiForm>
      {status !== "CLOSED" && (
        <ActionButton
          label={t("cases.execution.close")}
          className="tinybtn del"
          call={() => set("CLOSED")}
        />
      )}
    </div>
  );
}

export function CollectionForm({ caseId }: { caseId: string }) {
  return (
    <ApiForm
      style={{ display: "flex", gap: 8, alignItems: "flex-end" }}
      call={(fd) =>
        caseworkRecordCollection({
          client: c,
          path: { id: caseId },
          body: { amount: halalas(fd, "amount") ?? 0 },
        })
      }
    >
      {(pending) => (
        <>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>{t("cases.execution.collectionAmount")}</label>
            <input type="number" step="0.01" min="0.01" name="amount" required />
          </div>
          <button type="submit" className="tinybtn" disabled={pending}>
            {t("cases.execution.recordCollection")}
          </button>
        </>
      )}
    </ApiForm>
  );
}

function PartyOptions() {
  return (
    <>
      <option value="">{t("cases.execution.procedureParty")}</option>
      {DOC_PARTIES.map((p) => (
        <option key={p} value={p}>
          {t(`docParty.${p}` as MessageKey)}
        </option>
      ))}
    </>
  );
}

export function ProcedureForm({
  caseId,
  users,
}: {
  caseId: string;
  users: Array<{ id: string; name: string }>;
}) {
  return (
    <ApiForm
      className="two"
      style={{ marginBottom: 12 }}
      call={(fd) =>
        caseworkAddExecutionProcedure({
          client: c,
          path: { id: caseId },
          body: {
            type: (str(fd, "type") ?? "") as ProcType,
            party: str(fd, "party") as Party | null,
            date: str(fd, "date"),
            note: str(fd, "note"),
            followUpDate: str(fd, "followUpDate"),
            followUpAssigneeId: str(fd, "followUpAssigneeId"),
          },
        })
      }
    >
      {(pending) => (
        <>
          <select name="type" defaultValue="" required>
            <option value="" disabled>
              {t("cases.execution.procedureType")}
            </option>
            {EXEC_PROC_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {ty}
              </option>
            ))}
          </select>
          <select name="party" defaultValue="">
            <PartyOptions />
          </select>
          <input type="date" name="date" title={t("cases.execution.procedureDate")} />
          <input type="text" name="note" placeholder={t("cases.execution.procedureNote")} />
          <input type="date" name="followUpDate" title={t("cases.execution.followUpDate")} />
          <select
            name="followUpAssigneeId"
            defaultValue=""
            title={t("cases.execution.followUpAssignee")}
          >
            <option value="">{t("cases.execution.followUpAssignee")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="act b-add"
            style={{ gridColumn: "span 2" }}
            disabled={pending}
          >
            {t("cases.execution.addProcedure")}
          </button>
        </>
      )}
    </ApiForm>
  );
}

export function ProcedureControls({
  caseId,
  proc,
  canDelete,
}: {
  caseId: string;
  proc: {
    id: string;
    type: string;
    party: string | null;
    date: string | null;
    note: string | null;
  };
  canDelete: boolean;
}) {
  const path = { id: caseId, procedureId: proc.id };
  return (
    <>
      <ActionButton
        label={t("cases.execution.cycleStatus")}
        call={() => caseworkCycleExecutionProcedure({ client: c, path })}
      />
      {canDelete && (
        <ActionButton
          label={t("cases.execution.deleteProcedure")}
          className="tinybtn del"
          call={() => caseworkRemoveExecutionProcedure({ client: c, path })}
        />
      )}
      <details style={{ width: "100%" }}>
        <summary style={{ cursor: "pointer", fontSize: 14.375, color: "var(--bench)" }}>
          {t("cases.execution.editProcedure")}
        </summary>
        <ApiForm
          className="two"
          style={{ marginTop: 8 }}
          call={(fd) =>
            caseworkUpdateExecutionProcedure({
              client: c,
              path,
              body: {
                type: (str(fd, "type") ?? proc.type) as ProcType,
                party: str(fd, "party") as Party | null,
                date: str(fd, "date"),
                note: str(fd, "note"),
              },
            })
          }
        >
          {(pending) => (
            <>
              <select name="type" defaultValue={proc.type} required>
                {EXEC_PROC_TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {ty}
                  </option>
                ))}
              </select>
              <select name="party" defaultValue={proc.party ?? ""}>
                <PartyOptions />
              </select>
              <input type="date" name="date" defaultValue={proc.date ? fmtDate(proc.date) : ""} />
              <input
                type="text"
                name="note"
                defaultValue={proc.note ?? ""}
                placeholder={t("cases.execution.procedureNote")}
              />
              <button
                type="submit"
                className="tinybtn"
                style={{ gridColumn: "span 2" }}
                disabled={pending}
              >
                {t("common.save")}
              </button>
            </>
          )}
        </ApiForm>
      </details>
    </>
  );
}
