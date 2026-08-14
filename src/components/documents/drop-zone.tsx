"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  uploadDroppedFileAction,
  type DropUploadError,
} from "@/app/documents/upload-actions";
import { t, type MessageKey } from "@/lib/i18n";

/**
 * Drag files onto a case to attach them.
 *
 * Uploads run one file at a time, on purpose. A lawyer dropping a scanned
 * bundle can easily drop twenty files, and firing twenty concurrent multipart
 * requests at a single Cloud Run instance is how you turn a convenience into an
 * outage. Sequential is also what makes per-file progress meaningful.
 *
 * The keyboard path is not optional: dragging is a mouse gesture, so the same
 * zone contains a real <input type="file">, and the visible control is a label
 * bound to it. Anything droppable must also be reachable by tab.
 */

const ERROR_KEY: Record<DropUploadError, MessageKey> = {
  UPLOAD_NO_FILE: "documents.drop.errEmpty",
  UPLOAD_MIME_REJECTED: "documents.drop.errType",
  UPLOAD_SIZE_REJECTED: "documents.drop.errSize",
  FORBIDDEN: "documents.drop.errForbidden",
  GENERIC: "auth.error.generic",
};

type Row = { name: string; state: "pending" | "done" | "failed"; code?: DropUploadError };

export function CaseDropZone({
  caseId,
  accept,
  maxBytes,
}: {
  caseId: string;
  /** Mirrors the server allowlist so the picker filters, and bad drops fail fast. */
  accept: string[];
  maxBytes: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  // dragenter/dragleave fire for every child element the pointer crosses, so a
  // plain boolean flickers as the cursor moves inside the zone. Counting
  // enters against leaves is what makes the highlight stable.
  const depth = useRef(0);

  const send = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setBusy(true);
      setRows(files.map((f) => ({ name: f.name, state: "pending" as const })));

      for (const [i, file] of files.entries()) {
        // Cheap local rejections first: no point uploading 25MB to be told no.
        // The server re-checks both — this only saves the round trip.
        const localCode: DropUploadError | null =
          file.size === 0
            ? "UPLOAD_NO_FILE"
            : file.size > maxBytes
              ? "UPLOAD_SIZE_REJECTED"
              : file.type && !accept.includes(file.type)
                ? "UPLOAD_MIME_REJECTED"
                : null;

        if (localCode) {
          setRows((p) => p.map((r, j) => (j === i ? { ...r, state: "failed", code: localCode } : r)));
          continue;
        }

        const fd = new FormData();
        fd.set("caseId", caseId);
        fd.set("file", file);
        try {
          const res = await uploadDroppedFileAction(fd);
          setRows((p) =>
            p.map((r, j) =>
              j === i
                ? res.ok
                  ? { ...r, state: "done" }
                  : { ...r, state: "failed", code: res.code }
                : r,
            ),
          );
        } catch {
          // A network drop or a rejected action still has to land on the row,
          // otherwise the file sits on "pending" forever and looks like a hang.
          setRows((p) =>
            p.map((r, j) => (j === i ? { ...r, state: "failed", code: "GENERIC" } : r)),
          );
        }
      }

      setBusy(false);
      router.refresh();
    },
    [accept, caseId, maxBytes, router],
  );

  return (
    <div
      className={`dropzone${over ? " over" : ""}${busy ? " busy" : ""}`}
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(e) => {
        // Without preventDefault the browser treats the drop as navigation and
        // replaces the page with the file. This one line is the whole feature.
        e.preventDefault();
      }}
      onDragLeave={() => {
        depth.current -= 1;
        if (depth.current <= 0) {
          depth.current = 0;
          setOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        void send(Array.from(e.dataTransfer.files));
      }}
    >
      <input
        ref={inputRef}
        id={`drop-${caseId}`}
        type="file"
        multiple
        accept={accept.join(",")}
        className="dropzone-input"
        onChange={(e) => {
          void send(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <label htmlFor={`drop-${caseId}`} className="dropzone-label">
        {busy ? t("common.loading") : t("documents.drop.prompt")}
      </label>
      <div className="dropzone-hint">{t("documents.drop.hint")}</div>

      {rows.length > 0 && (
        <ul className="dropzone-rows" aria-live="polite">
          {rows.map((r, i) => (
            <li key={`${r.name}-${i}`} className={`drop-row ${r.state}`}>
              <span className="drop-name">{r.name}</span>
              <span className="drop-state">
                {r.state === "pending" && t("common.loading")}
                {r.state === "done" && t("documents.drop.done")}
                {r.state === "failed" && t(ERROR_KEY[r.code ?? "GENERIC"])}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
