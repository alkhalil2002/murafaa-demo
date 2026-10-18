import { createApp } from "../src/app.factory.js";
import { loadEnv } from "../src/config/env.js";

/**
 * Demo case data for local development (legacy prisma/seed.ts cases block).
 * Boots the API in-process and goes through the real endpoints as the demo
 * partner, so conflict detection, timeline events, auto tasks and audit rows
 * come out exactly as they would for a user. Run `pnpm db:seed` first (office
 * and users). Skips when the office already has cases. Development only: it
 * signs in with the console OTP code.
 */
const env = loadEnv({ ...process.env, LOG_LEVEL: "warn" });
if (env.NODE_ENV === "production" || env.OTP_PROVIDER !== "console") {
  throw new Error("seed-demo runs only in development with OTP_PROVIDER=console");
}

const PARTNER = "0500000001";
const LAWYER_NAME = "منال المحامية";
const origin = env.CORS_ORIGINS[0] ?? "http://localhost:3000";

const DAY = 86_400_000;
/** A calendar date n days from today, as a date input sends it. */
const day = (n: number) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);

const app = await createApp(env);
await app.init();
await app.getHttpAdapter().getInstance().ready();

let cookie = "";
async function call<T = unknown>(
  method: "GET" | "POST" | "PUT",
  url: string,
  payload?: object,
): Promise<T> {
  const res = await app.inject({
    method,
    url: `/api/v1${url}`,
    headers: { origin, ...(cookie ? { cookie } : {}) },
    ...(payload ? { payload } : {}),
  });
  const body = res.json() as { data: T; error: unknown };
  if (res.statusCode >= 400)
    throw new Error(`${method} ${url} → ${res.statusCode} ${JSON.stringify(body.error)}`);
  return body.data;
}

try {
  const otp = await app.inject({
    method: "POST",
    url: "/api/v1/auth/otp",
    headers: { origin },
    payload: { phone: PARTNER, channel: "whatsapp" },
  });
  if (otp.statusCode === 429) throw new Error("OTP resend cooldown: wait 30 seconds and run again");
  const { devCode } = (otp.json() as { data: { devCode: string } }).data;
  const verify = await app.inject({
    method: "POST",
    url: "/api/v1/auth/verify",
    headers: { origin },
    payload: { phone: PARTNER, code: devCode },
  });
  const set = verify.headers["set-cookie"];
  cookie = String(Array.isArray(set) ? set[0] : set).split(";")[0]!;

  const existing = await call<unknown[]>("GET", "/cases");
  if (existing.length > 0) {
    console.log(`demo cases skipped: the office already has ${existing.length} case(s)`);
  } else {
    const users = await call<Array<{ id: string; name: string }>>("GET", "/cases/assignable-users");
    const lawyer = users.find((u) => u.name === LAWYER_NAME);
    if (!lawyer) throw new Error("run `pnpm db:seed` first");

    const imdad = await call<{ id: string }>("POST", "/clients", {
      name: "شركة الإمداد التجارية",
      city: "الرياض",
      type: "COMPANY",
    });
    await call("POST", "/clients", { name: "شركة النخبة", city: "جدة", type: "COMPANY" });
    const nukhba = (await call<Array<{ id: string; name: string }>>("GET", "/clients")).find(
      (c) => c.name === "شركة النخبة",
    )!;

    // خالد الفهد is a lead, so naming him as an opponent raises a MEDIUM conflict.
    for (const lead of [
      {
        name: "خالد الفهد",
        type: "INDIVIDUAL",
        source: "REFERRAL",
        expectedValue: 4_500_000,
        nextAction: "اتصال غداً",
      },
      {
        name: "شركة الأفق للتجارة",
        type: "COMPANY",
        source: "WEBSITE",
        expectedValue: 12_000_000,
        nextAction: "بانتظار رد",
        moves: 1,
      },
      {
        name: "مؤسسة التقنية",
        type: "ESTABLISHMENT",
        source: "LINKEDIN",
        expectedValue: 8_000_000,
        moves: 2,
      },
      {
        name: "مجموعة الواحة",
        type: "COMPANY",
        source: "EXHIBITION",
        expectedValue: 20_000_000,
        phone: "0500000099",
        moves: 3,
      },
    ]) {
      const { moves = 0, ...body } = lead;
      await call("POST", "/leads", body);
      const id = (await call<Array<{ id: string; name: string }>>("GET", "/leads")).find(
        (l) => l.name === lead.name,
      )!.id;
      for (let i = 0; i < moves; i++) await call("POST", `/leads/${id}/move`, { direction: 1 });
    }

    const newCase = async (body: object) => {
      const { id } = await call<{ id: string }>("POST", "/cases", body);
      await call("POST", `/cases/${id}/assignees`, { userId: lawyer.id });
      return id;
    };
    const caseA = await newCase({
      number: "1446/128",
      title: "مطالبة مالية تجارية",
      clientId: imdad.id,
      opposingParty: "مؤسسة الصقر للمقاولات",
      najizMainClass: "تجارية",
      najizSubClass: "العقود التجارية",
      najizCaseType: "مطالبة مالية تجارية",
      city: "الرياض",
    });
    await call("POST", `/cases/${caseA}/hearings`, {
      hearingDate: day(-20),
      kind: "PLEADING",
      stageIndex: 1,
      result: "تأجيل لتبادل المذكرات",
      nextHearingDate: day(6),
      actionReminderText: "متابعة تقديم المذكرة الجوابية",
      actionReminderDueOn: day(3),
    });
    await newCase({
      number: "1446/205",
      title: "نزاع عقاري",
      clientId: imdad.id,
      opposingParty: "خالد الفهد",
      najizMainClass: "حقوقية / عامة",
      najizSubClass: "عقارية",
      najizCaseType: "إخلاء عقار",
      city: "جدة",
    });
    // Our client sues شركة النخبة here, and represents it in caseD: a HIGH conflict both ways.
    await newCase({
      number: "1446/311",
      title: "مطالبة تعويض",
      clientId: imdad.id,
      opposingParty: "شركة النخبة",
      najizMainClass: "تجارية",
      najizSubClass: "العقود التجارية",
      najizCaseType: "الإخلال بالتزام تعاقدي",
      city: "الرياض",
    });
    const caseD = await newCase({
      number: "1446/415",
      title: "دفاع عن شركة النخبة",
      clientId: nukhba.id,
      opposingParty: "مؤسسة البادية",
      najizMainClass: "تجارية",
      najizSubClass: "الشركات",
      najizCaseType: "منازعة بين الشركاء",
      city: "جدة",
    });
    // A judgment 18 days ago leaves 12 days to object, with the urgent task.
    await call("POST", `/cases/${caseD}/hearings`, {
      hearingDate: day(-18),
      kind: "JUDGMENT_PRONOUNCEMENT",
      stageIndex: 1,
      result: "حكم ابتدائي",
    });

    for (const task of [
      {
        title: "مراجعة عقد العميل الجديد",
        assigneeId: lawyer.id,
        category: "CONTRACT_DOC_REVIEW",
        caseId: caseA,
        dueAt: day(2),
      },
      {
        title: "إعداد مذكرة جوابية",
        assigneeId: lawyer.id,
        priority: "URGENT",
        category: "MEMO_DRAFTING",
        caseId: caseA,
        dueAt: day(1),
        to: "IN_PROGRESS",
      },
      {
        title: "بحث في السوابق العقارية",
        assigneeId: lawyer.id,
        category: "LEGAL_RESEARCH",
        to: "DONE",
      },
    ]) {
      const { to, ...body } = task;
      const { id } = await call<{ id: string }>("POST", "/tasks", body);
      if (to) await call("PUT", `/tasks/${id}/status`, { status: to });
    }

    await call("POST", "/appointments", {
      contactName: "شركة الأفق للتجارة",
      scheduledOn: day(2),
      scheduledTime: "11:00",
      type: "FIRST_CONSULTATION",
    });
    await call("POST", "/appointments", {
      contactName: "مؤسسة التقنية",
      scheduledOn: day(4),
      scheduledTime: "13:00",
      type: "CONTRACT_REVIEW",
    });
    console.log(
      "seeded demo data: 2 clients, 4 leads, 4 cases (with conflicts), hearings, tasks, 2 appointments",
    );
  }
  await call("POST", "/auth/logout");
} finally {
  await app.close();
}
