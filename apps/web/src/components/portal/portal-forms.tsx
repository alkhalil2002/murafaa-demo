"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  clientPortalDecide,
  clientPortalLogout,
  clientPortalSendMessage,
  clientPortalUpload,
  employeePortalLogout,
  employeePortalSubmit,
  platformLogout,
} from "@murafaa/sdk";
import type { ClientPortalUploadData, EmpPortalRequestBody } from "@murafaa/sdk";
import { MAX_PORTAL_UPLOAD_BYTES, UPLOAD_MIME_ALLOW } from "@murafaa/documents";
import { REQUEST_KINDS } from "@murafaa/rules";
import { t, type MessageKey } from "@murafaa/i18n";
import { browserApi } from "@/lib/browser-api";
import { useApiAction } from "@/lib/use-api-action";

const c = browserApi;
function ErrorLine({ error }: { error: MessageKey | null }) {
  return error ? <div className="lerr">{t(error)}</div> : null;
}

const SIGN_OUT = {
  CLIENT: { logout: clientPortalLogout, login: "/portal/login" },
  EMPLOYEE: { logout: employeePortalLogout, login: "/emp-portal/login" },
  PLATFORM: { logout: platformLogout, login: "/platform/login" },
} as const;

export function PortalLogoutButton({ kind }: { kind: keyof typeof SIGN_OUT }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="logout"
      onClick={async () => {
        await SIGN_OUT[kind].logout({ client: c });
        router.replace(SIGN_OUT[kind].login);
        router.refresh();
      }}
    >
      {t("auth.signout")}
    </button>
  );
}

export function PortalMessageForm({ caseId }: { caseId: string }) {
  const { run, pending, error } = useApiAction();
  const [key, setKey] = useState(0);
  return (
    <>
      <form
        key={key}
        style={{
          display: "flex",
          gap: 12,
          marginTop: 24,
          paddingTop: 20,
          borderTop: "1px solid var(--divider)",
        }}
        action={(fd) => {
          const body = String(fd.get("body") ?? "").trim();
          if (!body) return;
          run(
            () => clientPortalSendMessage({ client: c, path: { id: caseId }, body: { body } }),
            () => setKey((k) => k + 1),
          );
        }}
      >
        <input
          type="text"
          name="body"
          placeholder={t("cases.chat.placeholder")}
          required
          className="input"
          style={{ flex: 1 }}
        />
        <button type="submit" className="act b-primary" disabled={pending}>
          {t("cases.chat.send")}
        </button>
      </form>
      <ErrorLine error={error} />
    </>
  );
}

export function PortalDecideForm({ caseId, approvalId }: { caseId: string; approvalId: string }) {
  const { run, pending, error } = useApiAction();
  return (
    <>
      <form
        style={{ marginTop: 16 }}
        action={(fd) => {
          const note = String(fd.get("note") ?? "").trim() || null;
          const approve = fd.get("decision") === "approve";
          run(() =>
            clientPortalDecide({
              client: c,
              path: { id: caseId, approvalId },
              body: { approve, note },
            }),
          );
        }}
      >
        <div className="field">
          <label>
            {t("portal.approvals.decisionNote")}{" "}
            <span className="hint">{t("portal.approvals.optional")}</span>
          </label>
          <input
            type="text"
            name="note"
            className="input"
            placeholder={t("portal.approvals.decisionPlaceholder")}
          />
        </div>
        <div className="actions">
          <button
            type="submit"
            name="decision"
            value="approve"
            className="act b-primary"
            disabled={pending}
          >
            {t("portal.approvals.approve")}
          </button>
          <button
            type="submit"
            name="decision"
            value="reject"
            className="act b-danger"
            disabled={pending}
          >
            {t("portal.approvals.reject")}
          </button>
        </div>
      </form>
      <ErrorLine error={error} />
    </>
  );
}

type Mime = ClientPortalUploadData["query"]["mimeType"];

/** Client upload (legacy: 20 MB); type and size checked here first, the API checks again with the content. */
export function PortalUploadForm({
  caseId,
  cases,
}: {
  caseId?: string;
  /** Without a fixed caseId the client picks one of these. */
  cases?: Array<{ id: string; title: string }>;
}) {
  const { run, pending, error } = useApiAction();
  const [localError, setLocalError] = useState<MessageKey | null>(null);
  const [key, setKey] = useState(0);
  return (
    <>
      <form
        key={key}
        style={{ marginTop: 16 }}
        action={(fd) => {
          setLocalError(null);
          const target = caseId ?? String(fd.get("caseId") ?? "");
          const file = fd.get("file");
          if (!(file instanceof File) || file.size === 0)
            return setLocalError("errors.UPLOAD_EMPTY");
          if (!UPLOAD_MIME_ALLOW.has(file.type)) return setLocalError("errors.UPLOAD_TYPE");
          if (file.size > MAX_PORTAL_UPLOAD_BYTES) return setLocalError("errors.UPLOAD_TOO_LARGE");
          run(
            () =>
              clientPortalUpload({
                client: c,
                path: { id: target },
                query: { fileName: file.name, mimeType: file.type as Mime },
                body: file,
              }),
            () => setKey((k) => k + 1),
          );
        }}
      >
        {!caseId && cases && (
          <div className="field">
            <label>{t("portal.invoices.case")}</label>
            <select name="caseId" className="input" required>
              {cases.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.title}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label>{t("portal.upload.file")}</label>
          <input type="file" name="file" required className="input" />
        </div>
        <button type="submit" className="act b-primary" disabled={pending}>
          {t("portal.upload.submit")}
        </button>
      </form>
      <ErrorLine error={localError ?? error} />
    </>
  );
}

type Kind = EmpPortalRequestBody["kind"];

export function EmpRequestForm() {
  const { run, pending, error } = useApiAction();
  const [key, setKey] = useState(0);
  return (
    <>
      <form
        key={key}
        style={{ display: "flex", flexWrap: "wrap", columnGap: 16, alignItems: "flex-end" }}
        action={(fd) => {
          const days = String(fd.get("days") ?? "").trim();
          run(
            () =>
              employeePortalSubmit({
                client: c,
                body: {
                  kind: String(fd.get("kind")) as Kind,
                  detail: String(fd.get("detail") ?? "").trim() || null,
                  days: days ? Number(days) : null,
                },
              }),
            () => setKey((k) => k + 1),
          );
        }}
      >
        <div className="field" style={{ flex: "1 1 180px" }}>
          <label>{t("empPortal.form.kind")}</label>
          <select name="kind" defaultValue="LEAVE" className="input">
            {REQUEST_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`reqKind.${k}` as MessageKey)}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: "2 1 220px" }}>
          <label>{t("empPortal.form.detail")}</label>
          <input type="text" name="detail" className="input" />
        </div>
        <div className="field" style={{ flex: "0 1 140px" }}>
          <label>{t("empPortal.form.days")}</label>
          <input type="number" name="days" min={1} step={1} className="input" />
        </div>
        <button
          type="submit"
          className="act b-primary"
          disabled={pending}
          style={{ marginBottom: 20 }}
        >
          {t("empPortal.form.submit")}
        </button>
      </form>
      <ErrorLine error={error} />
    </>
  );
}
