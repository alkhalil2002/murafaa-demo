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
  console.info(
    `Seeded office ${office.id}: ${users.length} users, 2 clients, 4 leads, 4 cases, ${flags} conflict flags.`,
  );
}

async function seedNajiz() {
  const count = await prisma.najizClassification.count();
  if (count > 0) return;
  await prisma.najizClassification.createMany({ data: najizLeaves() });
  console.info(`Seeded ${najizLeaves().length} Najiz classification rows.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
