import { authLogout } from "@murafaa/sdk";
import { browserApi } from "./browser-api";

/** End the session on the API (clears the httpOnly cookie), then go to the login page. */
export async function signOut(router: {
  replace: (href: string) => void;
  refresh: () => void;
}): Promise<void> {
  await authLogout({ client: browserApi }).catch(() => undefined);
  router.replace("/login");
  router.refresh();
}
