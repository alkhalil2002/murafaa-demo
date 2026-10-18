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

export function PortalLogoutButton({ kind }: { kind: "CLIENT" | "EMPLOYEE" }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="mini"
      onClick={async () => {
        await (kind === "CLIENT" ? clientPortalLogout : employeePortalLogout)({ client: c });
        router.replace(kind === "CLIENT" ? "/portal/login" : "/emp-portal/login");
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
        style={{ display: "flex", gap: 6, marginTop: 10 }}
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
          style={{ flex: 1 }}
        />
        <button type="submit" className="act b-add" disabled={pending}>
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
        style={{ display: "flex", gap: 6, marginTop: 10 }}
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
        <input
          type="text"
          name="note"
          placeholder={t("portal.approvals.decisionPlaceholder")}
          style={{ flex: 1 }}
        />
        <button
          type="submit"
          name="decision"
          value="approve"
          className="act b-add"
          disabled={pending}
        >
          {t("portal.approvals.approve")}
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          className="tinybtn del"
          disabled={pending}
        >
          {t("portal.approvals.reject")}
        </button>
      </form>
      <ErrorLine error={error} />
    </>
  );
}

type Mime = ClientPortalUploadData["query"]["mimeType"];

/** Client upload (legacy: 20 MB); type and size checked here first, the API checks again with the content. */
export function PortalUploadForm({ caseId }: { caseId: string }) {
  const { run, pending, error } = useApiAction();
  const [localError, setLocalError] = useState<MessageKey | null>(null);
  const [key, setKey] = useState(0);
  return (
    <>
      <form
        key={key}
        style={{ display: "flex", gap: 6, marginTop: 10 }}
        action={(fd) => {
          setLocalError(null);
          const file = fd.get("file");
          if (!(file instanceof File) || file.size === 0)
            return setLocalError("errors.UPLOAD_EMPTY");
          if (!UPLOAD_MIME_ALLOW.has(file.type)) return setLocalError("errors.UPLOAD_TYPE");
          if (file.size > MAX_PORTAL_UPLOAD_BYTES) return setLocalError("errors.UPLOAD_TOO_LARGE");
          run(
            () =>
              clientPortalUpload({
                client: c,
                path: { id: caseId },
                query: { fileName: file.name, mimeType: file.type as Mime },
                body: file,
              }),
            () => setKey((k) => k + 1),
          );
        }}
      >
        <input type="file" name="file" required style={{ flex: 1 }} />
        <button type="submit" className="act b-add" disabled={pending}>
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
        style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}
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
        <label className="field" style={{ minWidth: 160 }}>
          <span>{t("empPortal.form.kind")}</span>
          <select name="kind" defaultValue="LEAVE">
            {REQUEST_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`reqKind.${k}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ width: 100 }}>
          <span>{t("empPortal.form.days")}</span>
          <input type="number" name="days" min={1} step={1} />
        </label>
        <label className="field" style={{ flex: 1, minWidth: 200 }}>
          <span>{t("empPortal.form.detail")}</span>
          <input type="text" name="detail" />
        </label>
        <button type="submit" className="act b-add" disabled={pending}>
          {t("empPortal.form.submit")}
        </button>
      </form>
      <ErrorLine error={error} />
    </>
  );
}
