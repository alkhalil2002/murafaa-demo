import type { Screen } from "@murafaa/auth";
import type { MessageKey } from "@murafaa/i18n";

export type NavIcon =
  | "today"
  | "dashboard"
  | "ai"
  | "clients"
  | "pulse"
  | "cases"
  | "leads"
  | "alerts"
  | "whatsapp"
  | "tasks"
  | "documents"
  | "deadlines"
  | "finance"
  | "hr"
  | "shield"
  | "bell"
  | "activity"
  | "kb"
  | "user";

export type NavDef = { screen: Screen; href: string; label: MessageKey; icon: NavIcon };
export type NavSectionDef = { id: string; title: MessageKey; collapsed?: boolean; items: NavDef[] };

/** Sidebar layout, in legacy/prototype order. Each item shows only when its screen is visible. */
export const NAV: NavSectionDef[] = [
  {
    id: "main",
    title: "nav.group.main",
    items: [
      { screen: "today", href: "/today", label: "nav.today", icon: "today" },
      { screen: "dashboard", href: "/dashboard", label: "nav.dashboard", icon: "dashboard" },
      { screen: "copilot", href: "/ai", label: "nav.ai", icon: "ai" },
      { screen: "journey", href: "/journey", label: "nav.journey", icon: "clients" },
      { screen: "pulse", href: "/pulse", label: "nav.pulse", icon: "pulse" },
    ],
  },
  {
    id: "daily",
    title: "nav.group.daily",
    items: [
      { screen: "cases", href: "/cases", label: "nav.cases", icon: "cases" },
      { screen: "clients", href: "/clients", label: "nav.clients", icon: "clients" },
      { screen: "leads", href: "/leads", label: "nav.leads", icon: "leads" },
      { screen: "alerts", href: "/alerts", label: "nav.alerts", icon: "alerts" },
      { screen: "whatsapp", href: "/whatsapp", label: "nav.whatsapp", icon: "whatsapp" },
      { screen: "tasks", href: "/tasks", label: "nav.tasks", icon: "tasks" },
      { screen: "documents", href: "/documents", label: "nav.documents", icon: "documents" },
      { screen: "deadlines", href: "/deadlines", label: "nav.deadlines", icon: "deadlines" },
    ],
  },
  {
    id: "admin",
    title: "nav.group.admin",
    collapsed: true,
    items: [
      { screen: "finance", href: "/finance", label: "nav.finance", icon: "finance" },
      { screen: "hr", href: "/hr", label: "nav.hr", icon: "hr" },
      { screen: "perms", href: "/perms", label: "nav.permissions", icon: "shield" },
    ],
  },
  {
    id: "system",
    title: "nav.group.system",
    collapsed: true,
    items: [
      { screen: "notifications", href: "/notifications", label: "nav.notifications", icon: "bell" },
      { screen: "activity", href: "/activity", label: "nav.activity", icon: "activity" },
      { screen: "kb", href: "/ai/kb", label: "nav.kb", icon: "kb" },
      { screen: "billing", href: "/billing", label: "nav.billing", icon: "finance" },
      { screen: "settings", href: "/settings", label: "nav.settings", icon: "user" },
    ],
  },
];
