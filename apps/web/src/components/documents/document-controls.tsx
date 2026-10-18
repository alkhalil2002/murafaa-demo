"use client";

import { useState } from "react";
import {
  documentsClearOpening,
  documentsRemove,
  documentsShare,
  documentsUpload,
} from "@murafaa/sdk";
import type { DocumentsUploadData } from "@murafaa/sdk";
import { MAX_UPLOAD_BYTES, STAFF_UPLOAD_SOURCES, UPLOAD_MIME_ALLOW } from "@murafaa/documents";
import { DOC_PARTIES } from "@murafaa/rules";
import { t, type MessageKey } from "@murafaa/i18n";
import { browserApi } from "@/lib/browser-api";
import { useApiAction } from "@/lib/use-api-action";

type Query = DocumentsUploadData["query"];
type Party = (typeof DOC_PARTIES)[number];
type Source = (typeof STAFF_UPLOAD_SOURCES)[number];

function ErrorLine({ error }: { error: MessageKey | null }) {
  return error ? <div className="lerr">{t(error)}</div> : null;
}

const val = (fd: FormData, name: string) => {
  const v = fd.get(name);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

/**
 * Upload one file to a case. The bytes go as the request body; the fixed
 * metadata (source, hearing, request role…) comes from the caller, the rest
 * from the visible fields. Type and size are checked here for a quick
 * answer; the API checks them again, plus the file content.
 */
export function UploadForm({
  caseId,
  fixed = {},
  fields = [],
  hearings = [],
  defaultParty = "",
  submitLabel,
  className,
  style,
}: {
  caseId: string;
  fixed?: Partial<Omit<Query, "fileName" | "mimeType">>;
  fields?: Array<"party" | "docType" | "source" | "hearing">;
  hearings?: Array<{ id: string; label: string }>;
  defaultParty?: Party | "";
  submitLabel: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { run, pending, error } = useApiAction();
  const [localError, setLocalError] = useState<MessageKey | null>(null);
  const [formKey, setFormKey] = useState(0);

  const submit = (fd: FormData) => {
    setLocalError(null);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return setLocalError("errors.UPLOAD_EMPTY");
    if (!UPLOAD_MIME_ALLOW.has(file.type)) return setLocalError("errors.UPLOAD_TYPE");
    if (file.size > MAX_UPLOAD_BYTES) return setLocalError("errors.UPLOAD_TOO_LARGE");
    const query: Query = {
      ...fixed,
      fileName: file.name,
      mimeType: file.type as Query["mimeType"],
      ...(val(fd, "party") ? { party: val(fd, "party") as Party } : {}),
      ...(val(fd, "docType") ? { docType: val(fd, "docType") } : {}),
      ...(val(fd, "source") ? { source: val(fd, "source") as Source } : {}),
      ...(val(fd, "hearingId") ? { hearingId: val(fd, "hearingId") } : {}),
    };
    run(
      () => documentsUpload({ client: browserApi, path: { id: caseId }, query, body: file }),
      () => setFormKey((k) => k + 1),
    );
  };

  const fileInput = (
    <input type="file" name="file" required style={{ fontSize: 13.75, maxWidth: 220 }} />
  );
  const partySelect = (
    <select name="party" defaultValue={defaultParty}>
      <option value="">—</option>
      {DOC_PARTIES.map((p) => (
        <option key={p} value={p}>
          {t(`docParty.${p}` as MessageKey)}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <form key={formKey} action={submit} className={className} style={style}>
        {fields.includes("party") ||
        fields.includes("docType") ||
        fields.includes("source") ||
        fields.includes("hearing") ? (
          <>
            <div className="three">
              <div className="field">
                <label>{t("documents.file")}</label>
                {fileInput}
              </div>
              {fields.includes("party") && (
                <div className="field">
                  <label>{t("documents.party")}</label>
                  {partySelect}
                </div>
              )}
              {fields.includes("docType") && (
                <div className="field">
                  <label>{t("documents.docType")}</label>
                  <input type="text" name="docType" />
                </div>
              )}
            </div>
            {(fields.includes("source") || fields.includes("hearing")) && (
              <div className="two">
                {fields.includes("source") && (
                  <div className="field">
                    <label>{t("documents.source")}</label>
                    <select name="source" defaultValue="UPLOAD">
                      {STAFF_UPLOAD_SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {t(`docSource.${s}` as MessageKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {fields.includes("hearing") && (
                  <div className="field">
                    <label>{t("documents.linkHearing")}</label>
                    <select name="hearingId" defaultValue="">
                      <option value="">{t("documents.noHearingLink")}</option>
                      {hearings.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
            <div className="actions">
              <button type="submit" className="act b-add" disabled={pending}>
                {submitLabel}
              </button>
            </div>
          </>
        ) : (
          <>
            {fileInput}
            <button type="submit" className="tinybtn" disabled={pending}>
              {submitLabel}
            </button>
          </>
        )}
      </form>
      <ErrorLine error={localError ?? error} />
    </>
  );
}

/** Compact opening-package upload: party, type and file on one line (legacy). */
export function OpeningUploadForm({ caseId }: { caseId: string }) {
  const { run, pending, error } = useApiAction();
  const [localError, setLocalError] = useState<MessageKey | null>(null);
  const [formKey, setFormKey] = useState(0);
  return (
    <>
      <form
        key={formKey}
        style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}
        action={(fd) => {
          setLocalError(null);
          const file = fd.get("file");
          if (!(file instanceof File) || file.size === 0)
            return setLocalError("errors.UPLOAD_EMPTY");
          if (!UPLOAD_MIME_ALLOW.has(file.type)) return setLocalError("errors.UPLOAD_TYPE");
          if (file.size > MAX_UPLOAD_BYTES) return setLocalError("errors.UPLOAD_TOO_LARGE");
          run(
            () =>
              documentsUpload({
                client: browserApi,
                path: { id: caseId },
                query: {
                  fileName: file.name,
                  mimeType: file.type as Query["mimeType"],
                  source: "OPENING",
                  party: (val(fd, "party") ?? "OPPONENT") as Party,
                  ...(val(fd, "docType") ? { docType: val(fd, "docType") } : {}),
                },
                body: file,
              }),
            () => setFormKey((k) => k + 1),
          );
        }}
      >
        <select name="party" defaultValue="OPPONENT">
          {DOC_PARTIES.map((p) => (
            <option key={p} value={p}>
              {t(`docParty.${p}` as MessageKey)}
            </option>
          ))}
        </select>
        <input type="text" name="docType" placeholder={t("documents.docType")} />
        <input type="file" name="file" required />
        <button type="submit" className="tinybtn" disabled={pending}>
          {t("cases.openingPackage.add")}
        </button>
      </form>
      <ErrorLine error={localError ?? error} />
    </>
  );
}

/** Download link + share toggle + delete for one document row. */
export function DocumentControls({
  id,
  shared,
  canEdit,
  canDelete,
}: {
  id: string;
  shared: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const { run, pending, error } = useApiAction();
  return (
    <>
      <a href={`/api/v1/documents/${id}/download`} className="tinybtn">
        {t("documents.download")}
      </a>
      {canEdit && (
        <button
          type="button"
          className="tinybtn"
          disabled={pending}
          onClick={() => run(() => documentsShare({ client: browserApi, path: { id } }))}
        >
          {shared ? t("documents.unshare") : t("documents.share")}
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          className="tinybtn del"
          disabled={pending}
          onClick={() => run(() => documentsRemove({ client: browserApi, path: { id } }))}
        >
          {t("documents.delete")}
        </button>
      )}
      <ErrorLine error={error} />
    </>
  );
}

export function ClearOpeningButton({ caseId }: { caseId: string }) {
  const { run, pending, error } = useApiAction();
  return (
    <>
      <button
        type="button"
        className="tinybtn del"
        disabled={pending}
        onClick={() =>
          run(() => documentsClearOpening({ client: browserApi, path: { id: caseId } }))
        }
      >
        {t("cases.openingPackage.clearAll")}
      </button>
      <ErrorLine error={error} />
    </>
  );
}
