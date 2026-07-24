import { redirect } from "next/navigation";
import { PermModule } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { signOut } from "@/lib/auth";
import { canModule } from "@/lib/permissions/engine";
import { loadOfficePolicy } from "@/lib/permissions/policy";
import { roleLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";
import { SideNav, type NavItem } from "./side-nav";

/**
 * Authenticated app shell: RTL sidebar whose links are filtered by the
 * session role's module access (the UI only hides — each page still enforces
 * server-side). Wrap every authenticated page in this.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const policy = await loadOfficePolicy(session.officeId);

  const can = (m: PermModule) => canModule(policy, session.role, m, "view");
  const items: NavItem[] = [
    { href: "/today", label: t("nav.today") },
    ...(can(PermModule.CASES) ? [{ href: "/cases", label: t("nav.cases") }] : []),
    ...(can(PermModule.AI) ? [{ href: "/ai", label: t("nav.ai") }] : []),
    ...(can(PermModule.CLIENTS)
      ? [
          { href: "/clients", label: t("nav.clients") },
          { href: "/leads", label: t("nav.leads") },
        ]
      : []),
    ...(can(PermModule.DOCUMENTS) ? [{ href: "/documents", label: t("nav.documents") }] : []),
    ...(can(PermModule.TASKS) ? [{ href: "/tasks", label: t("nav.tasks") }] : []),
    ...(can(PermModule.FINANCE) ? [{ href: "/finance", label: t("nav.finance") }] : []),
    ...(can(PermModule.HR) ? [{ href: "/hr", label: t("nav.hr") }] : []),
    ...(can(PermModule.APPOINTMENTS)
      ? [
          { href: "/deadlines", label: t("nav.deadlines") },
          { href: "/appointments", label: t("nav.appointments") },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col justify-between bg-bench-2 p-4">
        <div>
          <div className="mb-6 px-2">
            <div className="font-serif text-2xl text-gold">{t("app.name")}</div>
            <div className="mt-1 text-xs text-parch/60">
              {session.name} · {roleLabel(session.role)}
            </div>
          </div>
          <SideNav items={items} />
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-xl px-4 py-2 text-sm text-parch/70 hover:bg-white/10"
          >
            {t("auth.signout")}
          </button>
        </form>
      </aside>
      <main className="flex-1 overflow-x-auto bg-parch p-8">{children}</main>
    </div>
  );
}

/** Shared "not authorized" panel for pages a role cannot access. */
export function DeniedPanel() {
  return (
    <div className="rounded-2xl border border-line bg-white p-8 text-center text-ink-soft">
      {t("perm.denied.module")}
    </div>
  );
}
