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
import { getNotifications } from "@/server/notifications";
import { effectiveRole } from "@/lib/permissions/engine";
import { clearRolePreviewAction } from "@/app/perms/actions";
import { t } from "@/lib/i18n";
import { SideNav, type NavItem, type NavSection } from "./side-nav";
import { ShellFrame } from "./shell-frame";
import { IdleLogout } from "./idle-logout";
import { TrialBanner } from "./trial-banner";
import {
  BrandMark,
  IconActivity,
  IconAi,
  IconAlerts,
  IconBell,
  IconCases,
  IconClients,
  IconDashboard,
  IconDeadlines,
  IconDocuments,
  IconFinance,
  IconHr,
  IconKb,
  IconLeads,
  IconPulse,
  IconShield,
  IconTasks,
  IconToday,
  IconUser,
  IconWhatsapp,
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
  const notifications = await getNotifications(session);

  const viewerRole = effectiveRole(session);
  const can = (m: PermModule) => canModule(policy, viewerRole, m, "view");
  const only = (allowed: boolean, item: NavItem): NavItem[] => (allowed ? [item] : []);

  const sections: NavSection[] = [
    {
      id: "grp-main",
      title: t("nav.group.main"),
      items: [
        { href: "/today", label: t("nav.today"), icon: <IconToday /> },
        ...only(can(PermModule.REPORTS), {
          href: "/dashboard",
          label: t("nav.dashboard"),
          icon: <IconDashboard />,
        }),
        ...only(can(PermModule.AI), { href: "/ai", label: t("nav.ai"), icon: <IconAi /> }),
        ...only(can(PermModule.REPORTS), {
          href: "/journey",
          label: t("nav.journey"),
          icon: <IconClients />,
        }),
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
        ...only(can(PermModule.ALERTS), {
          href: "/alerts",
          label: t("nav.alerts"),
          icon: <IconAlerts />,
        }),
        ...only(can(PermModule.WHATSAPP), {
          href: "/whatsapp",
          label: t("nav.whatsapp"),
          icon: <IconWhatsapp />,
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
        ...only(viewerRole === "PARTNER", {
          href: "/perms",
          label: t("nav.permissions"),
          icon: <IconShield />,
        }),
      ],
    },
    {
      id: "grp-system",
      title: t("nav.group.system"),
      collapsed: true,
      items: [
        { href: "/notifications", label: t("nav.notifications"), icon: <IconBell /> },
        ...only(can(PermModule.REPORTS), {
          href: "/activity",
          label: t("nav.activity"),
          icon: <IconActivity />,
        }),
        ...only(can(PermModule.AI), { href: "/ai/kb", label: t("nav.kb"), icon: <IconKb /> }),
        ...only(viewerRole === "PARTNER", {
          href: "/billing",
          label: t("nav.billing"),
          icon: <IconFinance />,
        }),
        { href: "/settings", label: t("nav.settings"), icon: <IconUser /> },
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

      {!session.previewRole && canModule(policy, viewerRole, PermModule.CASES, "edit") && (
        <Link href="/cases/new" className="newbtn">
          {t("cases.new.button")}
        </Link>
      )}
      <Link href="/portal/login" className="newbtn" target="_blank">
        {t("nav.clientPortalLink")}
      </Link>
      <Link href="/emp-portal/login" className="newbtn" target="_blank">
        {t("nav.empPortalLink")}
      </Link>

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
      bellCount={notifications.length}
    >
      <IdleLogout />
      <TrialBanner officeId={session.officeId} />
      {session.previewRole && (
        <div className="panel" style={{ background: "var(--gold-10, #fdf5e6)", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="sub" style={{ marginBottom: 0 }}>
            {t("rolePreview.banner", { role: roleLabel(session.previewRole) })}
          </span>
          <form action={clearRolePreviewAction} style={{ marginInlineStart: "auto" }}>
            <button type="submit" className="tinybtn">
              {t("rolePreview.exit")}
            </button>
          </form>
        </div>
      )}
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
