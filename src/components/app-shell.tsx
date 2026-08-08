import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { PermModule } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { signOut } from "@/lib/auth";
import { canModule } from "@/lib/permissions/engine";
import { loadOfficePolicy } from "@/lib/permissions/policy";
import { roleLabel } from "@/lib/labels";
import { isIpAllowed, clientIpFromHeaders } from "@/lib/security/ip";
import { t } from "@/lib/i18n";
import { SideNav, type NavItem, type NavSection } from "./side-nav";
import { ShellFrame } from "./shell-frame";
import { IdleLogout } from "./idle-logout";
import {
  BrandMark,
  IconAi,
  IconCases,
  IconClients,
  IconDeadlines,
  IconDocuments,
  IconFinance,
  IconHr,
  IconLeads,
  IconPulse,
  IconTasks,
  IconToday,
  IconUser,
} from "./icons";

/**
 * Authenticated app shell, reproducing the prototype's chrome: gradient RTL
 * sidebar with brand mark, grouped icon navigation, and the topbar above the
 * page. Nav links are filtered by the session role's module access (the UI
 * only hides — each page still enforces server-side).
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const office = await prisma.office.findUnique({
    where: { id: session.officeId },
    select: { ipAllowlist: true },
  });
  if (office && office.ipAllowlist.length > 0) {
    const ip = clientIpFromHeaders(await headers());
    if (!isIpAllowed(ip, office.ipAllowlist)) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div className="panel" style={{ maxWidth: 420, textAlign: "center" }}>
            <h2 style={{ marginTop: 0, color: "var(--advocate)" }}>{t("security.ip.blockedTitle")}</h2>
            <p className="sub" style={{ marginBottom: 0 }}>{t("security.ip.blockedHint")}</p>
          </div>
        </div>
      );
    }
  }

  const policy = await loadOfficePolicy(session.officeId);

  const can = (m: PermModule) => canModule(policy, session.role, m, "view");
  const only = (allowed: boolean, item: NavItem): NavItem[] => (allowed ? [item] : []);

  const sections: NavSection[] = [
    {
      id: "grp-main",
      title: t("nav.group.main"),
      items: [
        { href: "/today", label: t("nav.today"), icon: <IconToday /> },
        ...only(can(PermModule.AI), { href: "/ai", label: t("nav.ai"), icon: <IconAi /> }),
        ...only(can(PermModule.PULSE), { href: "/pulse", label: t("nav.pulse"), icon: <IconPulse /> }),
      ],
    },
    {
      id: "grp-daily",
      title: t("nav.group.daily"),
      items: [
        ...only(can(PermModule.CASES), {
          href: "/cases",
          label: t("nav.cases"),
          icon: <IconCases />,
        }),
        ...only(can(PermModule.CLIENTS), {
          href: "/clients",
          label: t("nav.clients"),
          icon: <IconClients />,
        }),
        ...only(can(PermModule.CLIENTS), {
          href: "/leads",
          label: t("nav.leads"),
          icon: <IconLeads />,
        }),
        ...only(can(PermModule.TASKS), {
          href: "/tasks",
          label: t("nav.tasks"),
          icon: <IconTasks />,
        }),
        ...only(can(PermModule.DOCUMENTS), {
          href: "/documents",
          label: t("nav.documents"),
          icon: <IconDocuments />,
        }),
        ...only(can(PermModule.APPOINTMENTS), {
          href: "/deadlines",
          label: t("nav.deadlines"),
          icon: <IconDeadlines />,
        }),
      ],
    },
    {
      id: "grp-admin",
      title: t("nav.group.admin"),
      collapsed: true,
      items: [
        ...only(can(PermModule.FINANCE), {
          href: "/finance",
          label: t("nav.finance"),
          icon: <IconFinance />,
        }),
        ...only(can(PermModule.HR), { href: "/hr", label: t("nav.hr"), icon: <IconHr /> }),
      ],
    },
  ].filter((s) => s.items.length > 0);

  const sidebar = (
    <>
      <div className="sbrand">
        <div className="s">
          <BrandMark />
        </div>
        <div>
          <h1>{t("app.name")}</h1>
          <p>{t("app.tagline")}</p>
        </div>
      </div>

      <SideNav sections={sections} />

      {canModule(policy, session.role, PermModule.CASES, "edit") && (
        <Link href="/cases/new" className="newbtn">
          {t("cases.new.button")}
        </Link>
      )}

      <div className="suser">
        <Link href="/account/security" className="u">
          <IconUser />
          <span>
            {session.name} · {roleLabel(session.role)}
          </span>
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="logout">
            {t("auth.signout")}
          </button>
        </form>
      </div>
    </>
  );

  return (
    <ShellFrame
      sidebar={sidebar}
      searchPlaceholder={t("search.placeholder")}
      searchLabel={t("search.action")}
      menuLabel={t("nav.menu")}
      bellLabel={t("notif.title")}
    >
      <IdleLogout />
      {children}
    </ShellFrame>
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
