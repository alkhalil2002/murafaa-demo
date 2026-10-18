import Link from "next/link";
import { redirect } from "next/navigation";
import { authCurrent } from "@murafaa/sdk";
import { roleLabel, t } from "@murafaa/i18n";
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
} from "@/components/icons";
import { EndPreviewButton } from "@/components/perms/preview-form";
import { serverApi } from "@/lib/api";
import { IdleLogout } from "./idle-logout";
import { NAV, type NavIcon } from "./nav";
import { ShellFrame } from "./shell-frame";
import { SideNav, type NavSection } from "./side-nav";
import { SignOutButton } from "./sign-out-button";

const ICONS: Record<NavIcon, React.ReactNode> = {
  today: <IconToday />,
  dashboard: <IconDashboard />,
  ai: <IconAi />,
  clients: <IconClients />,
  pulse: <IconPulse />,
  cases: <IconCases />,
  leads: <IconLeads />,
  alerts: <IconAlerts />,
  whatsapp: <IconWhatsapp />,
  tasks: <IconTasks />,
  documents: <IconDocuments />,
  deadlines: <IconDeadlines />,
  finance: <IconFinance />,
  hr: <IconHr />,
  shield: <IconShield />,
  bell: <IconBell />,
  activity: <IconActivity />,
  kb: <IconKb />,
  user: <IconUser />,
};

/**
 * Signed-in app chrome (legacy app-shell, prototype 1:1): gradient RTL
 * sidebar with grouped navigation and the top bar. Navigation shows only the
 * screens the API says this session may open; the API still enforces.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const res = await authCurrent({ client: await serverApi() });
  const me = res.data?.data;
  if (!me) {
    const code = (res.error as { error?: { code?: string } } | undefined)?.error?.code;
    redirect(code === "IP_NOT_ALLOWED" ? "/auth/expired?reason=ip" : "/auth/expired");
  }

  const visible = new Set(me.screens);
  const sections: NavSection[] = NAV.map((s) => ({
    id: s.id,
    title: t(s.title),
    collapsed: s.collapsed,
    items: s.items
      .filter((i) => visible.has(i.screen))
      .map((i) => ({ href: i.href, label: t(i.label), icon: ICONS[i.icon] })),
  })).filter((s) => s.items.length > 0);

  const canCreateCase =
    (me.modules.CASES === "EDIT" || me.modules.CASES === "FULL") && !me.user.previewRole;

  const sidebar = (
    <>
      <div className="sbrand">
        <div className="s">
          <BrandMark />
        </div>
        <div>
          <h1>{t("app.name")}</h1>
          <p>{me.office.name}</p>
        </div>
      </div>

      <SideNav sections={sections} />

      {canCreateCase && (
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
            {me.user.name} · {roleLabel(me.user.role)}
          </span>
        </Link>
        <SignOutButton label={t("auth.signout")} />
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
      bellCount={0}
    >
      <IdleLogout />
      {me.user.previewRole && (
        <div className="panel" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="sub" style={{ marginBottom: 0 }}>
            {t("rolePreview.banner", { role: roleLabel(me.user.previewRole) })}
          </span>
          <EndPreviewButton />
        </div>
      )}
      {children}
    </ShellFrame>
  );
}
