import { PermModule } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { canAction } from "@/lib/permissions/guard";
import { caseScopeWhere } from "@/lib/permissions/scope";

/**
 * Global search (topbar "بحث: قضية، عميل، مستند، فاتورة، مهمة…", docs/05
 * cross-cutting observation — was a decorative input with no backend). Each
 * category is gated by its own module's view permission and, for
 * case-linked rows, the caller's case row-scope — same enforcement every
 * other list page in the app already applies, just fanned out across
 * entities in one query.
 */

export type SearchResult = { id: string; label: string; sub: string | null; href: string };
export type SearchResults = {
  cases: SearchResult[];
  clients: SearchResult[];
  leads: SearchResult[];
  documents: SearchResult[];
  invoices: SearchResult[];
  tasks: SearchResult[];
  employees: SearchResult[];
};

const TAKE = 8;

export async function globalSearch(session: AppSession, rawQuery: string): Promise<SearchResults> {
  const q = rawQuery.trim();
  const empty: SearchResults = { cases: [], clients: [], leads: [], documents: [], invoices: [], tasks: [], employees: [] };
  if (q.length < 2) return empty;

  const [canCases, canClients, canDocuments, canFinance, canTasks, canHr] = await Promise.all([
    canAction(session, PermModule.CASES, "view"),
    canAction(session, PermModule.CLIENTS, "view"),
    canAction(session, PermModule.DOCUMENTS, "view"),
    canAction(session, PermModule.FINANCE, "view"),
    canAction(session, PermModule.TASKS, "view"),
    canAction(session, PermModule.HR, "view"),
  ]);

  const caseWhere = canCases || canDocuments || canTasks ? await caseScopeWhere(session) : null;

  const [cases, clients, leads, documents, invoices, tasks, employees] = await Promise.all([
    canCases
      ? prisma.case.findMany({
          where: { ...caseWhere!, OR: [{ title: { contains: q, mode: "insensitive" } }, { number: { contains: q, mode: "insensitive" } }] },
          select: { id: true, title: true, number: true },
          take: TAKE,
        })
      : Promise.resolve([]),
    canClients
      ? prisma.client.findMany({
          where: {
            officeId: session.officeId,
            deletedAt: null,
            OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q, mode: "insensitive" } }],
          },
          select: { id: true, name: true, phone: true },
          take: TAKE,
        })
      : Promise.resolve([]),
    canClients
      ? prisma.lead.findMany({
          where: {
            officeId: session.officeId,
            deletedAt: null,
            convertedClientId: null,
            OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q, mode: "insensitive" } }],
          },
          select: { id: true, name: true, phone: true },
          take: TAKE,
        })
      : Promise.resolve([]),
    canDocuments
      ? prisma.document.findMany({
          where: {
            officeId: session.officeId,
            deletedAt: null,
            fileName: { contains: q, mode: "insensitive" },
            OR: [{ caseId: null }, { case: caseWhere! }],
          },
          select: { id: true, fileName: true, caseId: true },
          take: TAKE,
        })
      : Promise.resolve([]),
    canFinance
      ? prisma.invoice.findMany({
          where: { officeId: session.officeId, deletedAt: null, number: { contains: q, mode: "insensitive" } },
          select: { id: true, number: true, client: { select: { name: true } } },
          take: TAKE,
        })
      : Promise.resolve([]),
    canTasks
      ? prisma.task.findMany({
          where: {
            officeId: session.officeId,
            deletedAt: null,
            title: { contains: q, mode: "insensitive" },
            OR: [{ caseId: null }, { case: caseWhere! }],
          },
          select: { id: true, title: true, caseId: true },
          take: TAKE,
        })
      : Promise.resolve([]),
    canHr
      ? prisma.employee.findMany({
          where: {
            officeId: session.officeId,
            deletedAt: null,
            OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q, mode: "insensitive" } }],
          },
          select: { id: true, name: true, jobTitle: true },
          take: TAKE,
        })
      : Promise.resolve([]),
  ]);

  return {
    cases: cases.map((c) => ({ id: c.id, label: c.title, sub: c.number, href: `/cases/${c.id}` })),
    clients: clients.map((c) => ({ id: c.id, label: c.name, sub: c.phone, href: `/clients` })),
    leads: leads.map((l) => ({ id: l.id, label: l.name, sub: l.phone, href: `/leads` })),
    documents: documents.map((d) => ({
      id: d.id,
      label: d.fileName,
      sub: null,
      href: d.caseId ? `/cases/${d.caseId}?tab=documents` : `/documents`,
    })),
    invoices: invoices.map((i) => ({ id: i.id, label: i.number, sub: i.client.name, href: `/finance/${i.id}` })),
    tasks: tasks.map((t) => ({ id: t.id, label: t.title, sub: null, href: `/tasks` })),
    employees: employees.map((e) => ({ id: e.id, label: e.name, sub: e.jobTitle, href: `/hr/${e.id}` })),
  };
}
