"use client";

import { recycleRestore } from "@murafaa/sdk";
import { t } from "@murafaa/i18n";
import { browserApi } from "@/lib/browser-api";
import { useApiAction } from "@/lib/use-api-action";

export function RestoreButton({
  kind,
  id,
}: {
  kind: "case" | "lead" | "document" | "employee";
  id: string;
}) {
  const { run, pending, error } = useApiAction();
  return (
    <>
      <button
        type="button"
        className="tinybtn"
        disabled={pending}
        onClick={() => run(() => recycleRestore({ client: browserApi, path: { kind, id } }))}
      >
        {t("settings.recycle.restore")}
      </button>
      {error && <span className="lerr">{t(error)}</span>}
    </>
  );
}
