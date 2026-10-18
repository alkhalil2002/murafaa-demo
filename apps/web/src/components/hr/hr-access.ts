import "server-only";
import { authCurrent } from "@murafaa/sdk";
import { serverApi } from "@/lib/api";

/** The caller's HR level for showing controls; the API enforces it again. */
export async function hrAccess() {
  const api = await serverApi();
  const me = (await authCurrent({ client: api })).data?.data;
  const level = me?.modules.HR ?? "NONE";
  const writable = !me?.user.previewRole;
  return {
    api,
    canEdit: writable && (level === "EDIT" || level === "FULL"),
    canFull: writable && level === "FULL",
    isPartner: me?.user.role === "PARTNER",
  };
}
