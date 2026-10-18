import {
  AppointmentType,
  ClientStatus,
  ClientType,
  HearingKind,
  HearingStatus,
  LeadSource,
  LeadStage,
  PrismaClient,
  ProcStage,
  ReminderSource,
  Role,
  TaskCategory,
  TaskColumn,
  TaskPriority,
  TaskSource,
} from "@prisma/client";
import {
  ALL_MODULES,
  ALL_ROLES,
  SEED_CASE_SCOPE,
  SEED_FIELD_DENY,
  seedLevel,
} from "../src/lib/permissions/matrix";
import { najizLeaves } from "../src/lib/najiz";
import { dateInDays } from "../src/lib/dates";
import { recomputeCaseConflicts } from "../src/lib/conflict/service";
import { TEMPLATE_DEFS } from "../src/lib/documents/template-defs";
import { KB_SEED } from "../src/lib/ai/kb-seed";
import { getEmbedder } from "../src/lib/ai/embed";
import { AccountType, FeeType, PaymentMethod, ExpenseCategory } from "@prisma/client";
import { createInvoice, recordPayment } from "../src/server/invoices";
import { saveFeeAgreement, generateInvoiceFromFee } from "../src/server/fees";
import { createExpense } from "../src/server/expenses";
import { trustDeposit } from "../src/server/trust";
import { createEmployee, createAdvance } from "../src/server/hr";
import { riyalsToHalalas } from "../src/lib/money";
import type { AppSession } from "../src/lib/auth/types";

const COA_SEED: Array<{ code: string; name: string; type: AccountType }> = [
  { code: "1000", name: "النقد والبنك", type: AccountType.ASSET },
  { code: "1100", name: "الذمم المدينة", type: AccountType.ASSET },
  { code: "1200", name: "حسابات عهدة العملاء", type: AccountType.ASSET },
  { code: "1300", name: "سُلف الموظفين", type: AccountType.ASSET },
  { code: "1500", name: "الأصول الثابتة", type: AccountType.ASSET },
  { code: "2000", name: "الذمم الدائنة", type: AccountType.LIABILITY },
  { code: "2100", name: "أمانات العملاء (عهدة)", type: AccountType.LIABILITY },
  { code: "2200", name: "ضريبة القيمة المضافة المستحقة", type: AccountType.LIABILITY },
  { code: "2300", name: "التأمينات الاجتماعية المستحقة (GOSI)", type: AccountType.LIABILITY },
  { code: "3000", name: "رأس المال", type: AccountType.EQUITY },
  { code: "4000", name: "إيرادات الأتعاب", type: AccountType.REVENUE },
  { code: "5000", name: "تكلفة الخدمات المباشرة", type: AccountType.EXPENSE },
  { code: "5100", name: "المصروفات التشغيلية", type: AccountType.EXPENSE },
  { code: "5200", name: "الرواتب والأجور", type: AccountType.EXPENSE },
];

const prisma = new PrismaClient();

/**
 * Dev seed. Idempotent: reuses the demo office if present. Seeds the global
 * Najiz taxonomy, one office with the permission matrix, one user per role, a
 * CRM pipeline, cases with hearings/reminders/timeline, tasks, appointments,
 * and a deliberate conflict-of-interest scenario — then runs real conflict
 * detection so the flags + badges are populated.
 */
async function main() {
  await seedNajiz();
  await seedDocumentTemplates();
  await seedKnowledgeBase();

  const OFFICE_NAME = "مكتب مُرافعة التجريبي";
  const existing = await prisma.office.findFirst({ where: { name: OFFICE_NAME } });
  if (existing) {
    console.info(`Office already seeded (${existing.id}); nothing to do.`);
    return;
  }

  const office = await prisma.office.create({ data: { name: OFFICE_NAME } });

  // ── RBAC matrix ──
  await prisma.permission.createMany({
    data: ALL_ROLES.flatMap((role) =>
      ALL_MODULES.map((module) => ({
        officeId: office.id,
        role,
        module,
        level: seedLevel(role, module),
      })),
    ),
  });
  await prisma.fieldPermission.createMany({
    data: SEED_FIELD_DENY.map((f) => ({ officeId: office.id, ...f })),
  });
  await prisma.roleCaseScope.createMany({
    data: ALL_ROLES.map((role) => ({ officeId: office.id, role, scope: SEED_CASE_SCOPE[role] })),
  });

  // ── Users (one per role) ──
  const roleUsers: Array<{ name: string; phone: string; role: Role }> = [
    { name: "عبدالله الشريك", phone: "+966500000001", role: Role.PARTNER },
    { name: "منال المحامية", phone: "+966500000002", role: Role.LAWYER },
    { name: "سالم المساعد", phone: "+966500000003", role: Role.ASSISTANT },
    { name: "هند المحاسبة", phone: "+966500000004", role: Role.ACCOUNTANT },
    { name: "ماجد الإداري", phone: "+966500000005", role: Role.ADMIN },
    { name: "نورة الاستقبال", phone: "+966500000006", role: Role.RECEPTION },
  ];
  const users = await Promise.all(
    roleUsers.map((u) => prisma.user.create({ data: { officeId: office.id, ...u } })),
  );
  const partner = users.find((u) => u.role === Role.PARTNER)!;
  const lawyer = users.find((u) => u.role === Role.LAWYER)!;

  // ── Clients (شركة النخبة is registered → drives a HIGH conflict) ──
  const imdad = await prisma.client.create({
    data: {
      officeId: office.id,
      name: "شركة الإمداد التجارية",
      city: "الرياض",
      type: ClientType.COMPANY,
      status: ClientStatus.ACTIVE,
    },
  });
  const nukhba = await prisma.client.create({
    data: {
      officeId: office.id,
      name: "شركة النخبة",
      city: "جدة",
      type: ClientType.COMPANY,
      status: ClientStatus.ACTIVE,
    },
  });

  // ── Leads (خالد الفهد is a lead → drives a MEDIUM conflict) ──
  await prisma.lead.createMany({
    data: [
      { officeId: office.id, name: "خالد الفهد", type: ClientType.INDIVIDUAL, source: LeadSource.REFERRAL, stage: LeadStage.PROSPECT, expectedValue: 4_500_000, nextAction: "اتصال غداً" },
      { officeId: office.id, name: "شركة الأفق للتجارة", type: ClientType.COMPANY, source: LeadSource.WEBSITE, stage: LeadStage.FIRST_CONSULTATION, expectedValue: 12_000_000, nextAction: "بانتظار رد" },
      { officeId: office.id, name: "مؤسسة التقنية", type: ClientType.ESTABLISHMENT, source: LeadSource.LINKEDIN, stage: LeadStage.FEE_PROPOSAL_SENT, expectedValue: 8_000_000 },
      { officeId: office.id, name: "مجموعة الواحة", type: ClientType.COMPANY, source: LeadSource.EXHIBITION, stage: LeadStage.CONTRACTED, expectedValue: 20_000_000, phone: "+966500000099" },
    ],
  });

  // ── Cases ──
  // caseA: normal case, assigned to the lawyer, with hearings + reminder.
  const caseA = await prisma.case.create({
    data: {
      officeId: office.id,
      number: "1446/128",
      title: "مطالبة مالية تجارية",
      clientId: imdad.id,
      opposingParty: "مؤسسة الصقر للمقاولات",
      najizMainClass: "تجارية",
      najizSubClass: "العقود التجارية",
      najizCaseType: "مطالبة مالية تجارية",
      city: "الرياض",
      stage: ProcStage.FIRST_INSTANCE,
      poaExpiresAt: dateInDays(80),
      objectionDueAt: dateInDays(12),
    },
  });
  await prisma.caseAssignee.create({
    data: { officeId: office.id, caseId: caseA.id, userId: lawyer.id },
  });
  await prisma.hearing.createMany({
    data: [
      { officeId: office.id, caseId: caseA.id, sequenceNo: 1, hearingDate: dateInDays(-20), status: HearingStatus.HELD, stageIndex: 1, kind: HearingKind.PLEADING, result: "تأجيل لتبادل المذكرات" },
      { officeId: office.id, caseId: caseA.id, hearingDate: dateInDays(6), status: HearingStatus.UPCOMING, stageIndex: 1 },
    ],
  });
  await prisma.caseReminder.create({
    data: { officeId: office.id, caseId: caseA.id, text: "متابعة تقديم المذكرة الجوابية", dueOn: dateInDays(3), source: ReminderSource.MANUAL },
  });

  // caseB: opponent is a LEAD (خالد الفهد) → MEDIUM conflict.
  const caseB = await prisma.case.create({
    data: {
      officeId: office.id,
      number: "1446/205",
      title: "نزاع عقاري",
      clientId: imdad.id,
      opposingParty: "خالد الفهد",
      najizMainClass: "حقوقية / عامة",
      najizSubClass: "عقارية",
      najizCaseType: "إخلاء عقار",
      city: "جدة",
      stage: ProcStage.FIRST_INSTANCE,
    },
  });
  await prisma.caseAssignee.create({
    data: { officeId: office.id, caseId: caseB.id, userId: lawyer.id },
  });

  // caseC: opponent is a registered CLIENT (شركة النخبة) → HIGH conflict.
  const caseC = await prisma.case.create({
    data: {
      officeId: office.id,
      number: "1446/311",
      title: "مطالبة تعويض",
      clientId: imdad.id,
      opposingParty: "شركة النخبة",
      najizMainClass: "تجارية",
      najizSubClass: "العقود التجارية",
      najizCaseType: "الإخلال بالتزام تعاقدي",
      city: "الرياض",
      stage: ProcStage.FIRST_INSTANCE,
    },
  });

  // caseD: our client IS شركة النخبة → makes caseC also match rule 3.
  const caseD = await prisma.case.create({
    data: {
      officeId: office.id,
      number: "1446/415",
      title: "دفاع عن شركة النخبة",
      clientId: nukhba.id,
      opposingParty: "مؤسسة البادية",
      najizMainClass: "تجارية",
      najizSubClass: "الشركات",
      najizCaseType: "منازعة بين الشركاء",
      city: "جدة",
      stage: ProcStage.APPEAL,
    },
  });

  // ── Tasks (kanban) ──
  await prisma.task.createMany({
    data: [
      { officeId: office.id, title: "مراجعة عقد العميل الجديد", assigneeId: lawyer.id, priority: TaskPriority.NORMAL, status: TaskColumn.NEW, category: TaskCategory.CONTRACT_DOC_REVIEW, caseId: caseA.id, origin: TaskSource.MANUAL, dueAt: dateInDays(2) },
      { officeId: office.id, title: "إعداد مذكرة جوابية", assigneeId: lawyer.id, priority: TaskPriority.URGENT, status: TaskColumn.IN_PROGRESS, category: TaskCategory.MEMO_DRAFTING, caseId: caseA.id, origin: TaskSource.MANUAL, dueAt: dateInDays(1) },
      { officeId: office.id, title: "بحث في السوابق العقارية", assigneeId: lawyer.id, priority: TaskPriority.NORMAL, status: TaskColumn.DONE, category: TaskCategory.LEGAL_RESEARCH, caseId: caseB.id, origin: TaskSource.MANUAL, completedAt: dateInDays(-1) },
    ],
  });

  // ── Appointments ──
  await prisma.appointment.createMany({
    data: [
      { officeId: office.id, contactName: "شركة الأفق للتجارة", scheduledOn: dateInDays(2), scheduledTime: "١١:٠٠ ص", type: AppointmentType.FIRST_CONSULTATION },
      { officeId: office.id, contactName: "مؤسسة التقنية", scheduledOn: dateInDays(4), scheduledTime: "١:٠٠ م", type: AppointmentType.CONTRACT_REVIEW },
    ],
  });

  // ── Run real conflict detection over every case ──
  const session = { officeId: office.id, userId: partner.id };
  for (const c of [caseA, caseB, caseC, caseD]) {
    await recomputeCaseConflicts(session, c.id);
  }

  const flags = await prisma.conflictFlag.count({ where: { officeId: office.id } });

  // ── Finance: chart of accounts + sample invoice/payment/expense/trust ──
  await prisma.chartOfAccount.createMany({
    data: COA_SEED.map((a) => ({ officeId: office.id, ...a })),
  });
  const finSession: AppSession = {
    userId: partner.id,
    officeId: office.id,
    name: partner.name,
    phone: partner.phone,
    role: partner.role,
  };
  // Fee agreement on caseA (flat 15,000 SAR) → generate its invoice.
  await saveFeeAgreement(finSession, caseA.id, {
    type: FeeType.FLAT,
    feeValueMinor: riyalsToHalalas(15000),
  });
  await generateInvoiceFromFee(finSession, caseA.id);
  // A manual invoice + partial payment.
  const inv = await createInvoice(finSession, {
    clientId: imdad.id,
    caseId: caseA.id,
    items: [{ description: "أتعاب مرافعة", quantity: 1, unitPrice: riyalsToHalalas(6000) }],
    basis: "أتعاب المرحلة الأولى",
  });
  await recordPayment(finSession, inv.id, {
    amountMinor: riyalsToHalalas(3000),
    method: PaymentMethod.BANK_TRANSFER,
  });
  // A billable expense + a client trust deposit.
  await createExpense(finSession, {
    grossAmount: riyalsToHalalas(1150),
    category: ExpenseCategory.COURT_FEES,
    vendor: "وزارة العدل",
    billable: true,
    clientId: imdad.id,
    caseId: caseA.id,
  });
  await trustDeposit(finSession, { clientId: imdad.id, amountMinor: riyalsToHalalas(20000), note: "عهدة رسوم ومصاريف" });

  // ── HR: staff (mixed nationalities → Saudization band), + a salary advance ──
  const SAR = riyalsToHalalas;
  const staff: Array<Parameters<typeof createEmployee>[1]> = [
    { name: "عبدالرحمن التنفيذي", department: "الإدارة", jobTitle: "المدير التنفيذي", nationality: "سعودي", nationalId: "1012345678", iban: "SA0380000000608010167519", hireDate: new Date("2018-03-01"), basicSalary: SAR(20000), allowances: SAR(5000), gosiContribution: SAR(2000), leaveBalanceDays: 24 },
    { name: "منى المحاسِبة", department: "المالية", jobTitle: "محاسبة", nationality: "سعودي", nationalId: "1023456789", iban: "SA4420000001234567891234", hireDate: new Date("2021-06-15"), basicSalary: SAR(12000), allowances: SAR(2000), gosiContribution: SAR(1200), leaveBalanceDays: 21 },
    { name: "خالد المحامي", department: "القانوني", jobTitle: "محامٍ", nationality: "سعودي", nationalId: "1034567890", iban: "SA1140000009876543210987", hireDate: new Date("2020-01-10"), basicSalary: SAR(15000), allowances: SAR(3000), gosiContribution: SAR(1500), leaveBalanceDays: 18 },
    { name: "سارة القحطاني", department: "الاستقبال", jobTitle: "موظفة استقبال", nationality: "سعودي", nationalId: "1045678901", iban: "SA6980000000111122223333", hireDate: new Date("2024-09-01"), basicSalary: SAR(7000), allowances: SAR(1000), gosiContribution: SAR(700), leaveBalanceDays: 21 },
    { name: "راج كومار", department: "التقنية", jobTitle: "مطوّر", nationality: "هندي", nationalId: "2456789012", iban: "SA2230400108054011300020", hireDate: new Date("2022-04-01"), basicSalary: SAR(10000), allowances: SAR(2000), gosiContribution: 0, leaveBalanceDays: 15 },
    { name: "أحمد مصطفى", department: "الإداري", jobTitle: "كاتب", nationality: "مصري", nationalId: "2567890123", iban: "SA5510000044445555666677", hireDate: new Date("2023-11-20"), basicSalary: SAR(6000), allowances: SAR(1000), gosiContribution: 0, leaveBalanceDays: 12 },
  ];
  const employees = [];
  for (const s of staff) employees.push(await createEmployee(finSession, s));
  // A 6,000 SAR advance over 3 months to the accountant (installment 2,000).
  const mona = employees.find((e) => e.name === "منى المحاسِبة")!;
  await createAdvance(finSession, { employeeId: mona.id, amount: SAR(6000), months: 3, note: "سلفة شخصية" });

  const invCount = await prisma.invoice.count({ where: { officeId: office.id } });
  console.info(
    `Seeded office ${office.id}: ${users.length} users, 2 clients, 4 leads, 4 cases, ${flags} conflict flags, ${COA_SEED.length} accounts, ${invCount} invoices, ${employees.length} employees.`,
  );
}

async function seedNajiz() {
  const count = await prisma.najizClassification.count();
  if (count > 0) return;
  await prisma.najizClassification.createMany({ data: najizLeaves() });
  console.info(`Seeded ${najizLeaves().length} Najiz classification rows.`);
}

/** Seed the closed legal knowledge base (global) with embedded chunks. */
async function seedKnowledgeBase() {
  const count = await prisma.knowledgeSource.count();
  if (count > 0) return;
  const embedder = getEmbedder();
  for (const src of KB_SEED) {
    await prisma.knowledgeSource.create({
      data: {
        type: src.type,
        title: src.title,
        citationKey: src.citationKey,
        officialRef: src.officialRef ?? null,
        chunks: {
          create: await Promise.all(
            src.chunks.map(async (ch, i) => ({
              articleNumber: ch.articleNumber ?? null,
              content: ch.content,
              ord: i,
              embedding: await embedder.embed(`${src.title} ${ch.articleNumber ?? ""} ${ch.content}`),
            })),
          ),
        },
      },
    });
  }
  const chunks = KB_SEED.reduce((n, s) => n + s.chunks.length, 0);
  console.info(`Seeded ${KB_SEED.length} KB sources (${chunks} chunks).`);
}

/** Seed the 8 global system document templates (officeId null, isSystem). */
async function seedDocumentTemplates() {
  const count = await prisma.documentTemplate.count({ where: { isSystem: true } });
  if (count > 0) return;
  await prisma.documentTemplate.createMany({
    data: TEMPLATE_DEFS.map((tpl) => ({
      officeId: null,
      key: tpl.key,
      title: tpl.title,
      category: tpl.category,
      bodyTemplate: tpl.bodyTemplate,
      fields: tpl.fields as object,
      isSystem: true,
      isActive: true,
    })),
  });
  console.info(`Seeded ${TEMPLATE_DEFS.length} system document templates.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
