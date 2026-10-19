import {
  createDb,
  platformAdmins,
  runMigrations,
  seedOfficePolicy,
  withPlatform,
  withTenant,
} from "@murafaa/database";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { mkdtempSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { dateInDays, endOfServiceAward, riyadhCalendarDate, serviceYears } from "@murafaa/rules";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp, mountDocs } from "../src/app.factory.js";
import { loadEnv } from "../src/config/env.js";
import { encryptSecret } from "../src/modules/auth/auth-crypto.js";
import { totpCode } from "../src/modules/auth/totp.js";

/**
 * Full HTTP pipeline against a real Postgres: OTP login → session cookie or
 * bearer → session hook → guard → tenant context → TenantDb → RLS.
 */

const OWNER_URL =
  process.env.TEST_MIGRATION_DATABASE_URL ??
  "postgres://murafaa:murafaa@localhost:5440/murafaa_test";
const APP_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://murafaa_api:murafaa_api@localhost:5440/murafaa_test";

const ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
const TOTP_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

const OFFICE_A = "aaaaaaaa-0000-4000-8000-00000000000a";
const OFFICE_B = "bbbbbbbb-0000-4000-8000-00000000000b";
const OFFICE_LOCKED = "cccccccc-0000-4000-8000-00000000000c";
const OFFICE_D = "dddddddd-0000-4000-8000-00000000000d";
const OFFICE_E = "eeeeeeee-0000-4000-8000-00000000000e";
const OFFICE_F = "ffffffff-0000-4000-8000-00000000000f";
const OFFICE_G = "99999999-0000-4000-8000-000000000009";
const OFFICE_H = "88888888-0000-4000-8000-000000000008";
const OFFICE_I = "77777777-0000-4000-8000-000000000007";
const OFFICE_J = "66666666-0000-4000-8000-000000000006";
const OFFICE_K = "55555555-0000-4000-8000-000000000005";
const OFFICE_L = "44444444-0000-4000-8000-000000000004";
const OFFICE_M = "33333333-0000-4000-8000-000000000003";
const OFFICE_N = "22222222-0000-4000-8000-000000000002";
const OFFICE_O = "11111111-0000-4000-8000-000000000001";
const OFFICE_P = "12121212-0000-4000-8000-000000000012";
const OFFICE_Q = "13131313-0000-4000-8000-000000000013";
const OFFICE_R = "14141414-0000-4000-8000-000000000014";

// Local digits; the API normalizes to +9665XXXXXXXX.
const PARTNER_A = "0500000101";
const LAWYER_B = "0500000102";
const SHARED = "0500000103"; // registered in two offices → ambiguous
const TOTP_USER = "0500000104";
const LOCKED_USER = "0500000105";
const BRUTE = "0500000106";
const RESEND = "0500000107";
// One user per login: the 30-second resend cooldown applies per number.
const FORGER_B = "0500000108";
const ORIGIN_A = "0500000109";
const LOGOUT_A = "0500000110";
// Office D: one partner and one lawyer, for permissions administration.
const PARTNER_D = "0500000201";
const LAWYER_D = "0500000202";
// Office E: account security and settings.
const PARTNER_E = "0500000301";
const LAWYER_E = "0500000302";
// Office F: CRM with four roles.
const PARTNER_F = "0500000401";
const RECEPTION_F = "0500000402";
const ACCOUNTANT_F = "0500000403";
// Office G: cases, conflicts and row scope.
const PARTNER_G = "0500000501";
const LAWYER_G1 = "0500000502";
const LAWYER_G2 = "0500000503";

const PARTNER_H = "0500000601";
const LAWYER_H1 = "0500000602";
const LAWYER_H2 = "0500000603";

const PARTNER_I = "0500000701";
const LAWYER_I1 = "0500000702";
const LAWYER_I2 = "0500000703";
const RECEPTION_I = "0500000704";

const PARTNER_J = "0500000801";
const LAWYER_J1 = "0500000802";
const LAWYER_J2 = "0500000803";

const PARTNER_K = "0500000901";
const LAWYER_K1 = "0500000902";
const LAWYER_K2 = "0500000903";
const RECEPTION_K = "0500000904";

const PARTNER_L = "0500001001";
const LAWYER_L1 = "0500001002";
const LAWYER_L2 = "0500001003";
const ASSISTANT_L = "0500001004";

const PARTNER_M = "0500001101";
const ACCOUNTANT_M = "0500001102";
const LAWYER_M = "0500001103";

const PARTNER_N = "0500001201";
const ACCOUNTANT_N = "0500001202";

const PARTNER_R = "0500001601";
const PARTNER_Q = "0500001501";
const ACCOUNTANT_Q = "0500001502";
const LAWYER_Q1 = "0500001503";
const LAWYER_Q2 = "0500001504";
const RECEPTION_Q = "0500001505";
const PARTNER_P = "0500001401";
const ADMIN_P = "0500001402";
const LAWYER_P = "0500001403";
const PARTNER_O = "0500001301";
const LAWYER_O1 = "0500001302";
const LAWYER_O2 = "0500001303";
const ASSISTANT_O = "0500001304";

let app: NestFastifyApplication;

/**
 * Stand-in for the PDF service (apps/pdf has its own test against real
 * Chrome): checks the token, records the HTML, answers a tiny PDF, or fails
 * on demand.
 */
const PDF_TOKEN = "e2e-pdf-token-0123456789-0123456789-abcd";
const pdfStub = { html: [] as string[], fail: false, server: null as Server | null };
const STUB_PDF = Buffer.from("%PDF-1.4\n%stub\n%%EOF\n");

/** Test-only model: answers with whatever the test sets and records each prompt. */
const fakeLlm = {
  name: "test",
  connected: true,
  region: "test",
  prompts: [] as Array<{ system: string; prompt: string }>,
  reply: (_req: { system: string; prompt: string }) => "",
  generate(req: { system: string; prompt: string }) {
    this.prompts.push(req);
    return Promise.resolve({ text: this.reply(req), model: "test-model" });
  },
};

const e164 = (local: string) => `+966${local.slice(1)}`;

async function post(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  remoteAddress?: string,
) {
  return app.inject({
    method: "POST",
    url,
    payload: body as object,
    headers,
    ...(remoteAddress ? { remoteAddress } : {}),
  });
}

/** Request a code (console provider returns it) and verify it; returns the response. */
async function login(
  phone: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  const sent = await post("/api/v1/auth/otp", { phone });
  const code = sent.json().data.devCode as string;
  return post("/api/v1/auth/verify", { phone, code, ...extra }, headers);
}

const cookieOf = (res: { headers: Record<string, unknown> }) =>
  String(res.headers["set-cookie"]).split(";")[0] ?? "";

beforeAll(async () => {
  pdfStub.server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.headers.authorization !== `Bearer ${PDF_TOKEN}`) return void res.writeHead(401).end();
      if (pdfStub.fail) return void res.writeHead(500).end();
      pdfStub.html.push((JSON.parse(body) as { html: string }).html);
      res.writeHead(200, { "content-type": "application/pdf" }).end(STUB_PDF);
    });
  });
  await new Promise<void>((r) => pdfStub.server!.listen(0, "127.0.0.1", r));
  const pdfPort = (pdfStub.server.address() as { port: number }).port;
  await runMigrations(OWNER_URL);
  const owner = postgres(OWNER_URL, { max: 1 });
  await owner`truncate platform_sessions, platform_otp_challenges, platform_audit_log, platform_admins, portal_sessions, portal_otp_challenges, performance_events, office_performance_weights, candidates, payroll_lines, payroll_runs, employee_requests, attendance, leaves, advances, employees, ai_citations, ai_interactions, knowledge_chunks, knowledge_sources, expenses, trust_transactions, trust_accounts, time_entries, credit_notes, payments, invoice_items, invoices, case_fee_agreements, journal_lines, journal_entries, doc_counters, accounting_periods, chart_of_accounts, documents, client_approval_requests, execution_procedures, case_executions, case_messages, client_communications, contracts, case_approvals, appointments, procedure_requests, case_reminders, tasks, hearings, conflict_flags, case_events, case_assignees, cases, leads, clients, permissions, field_permissions, role_case_scopes, sessions, otp_challenges, audit_log, outbox, users, offices cascade`;
  const seed: Array<
    [office: string, name: string, allowlist: string[], users: Array<[string, string, string?]>]
  > = [
    [
      OFFICE_A,
      "Office A",
      [],
      [
        [PARTNER_A, "PARTNER"],
        [SHARED, "LAWYER"],
        [TOTP_USER, "PARTNER", TOTP_SECRET],
        [BRUTE, "LAWYER"],
        [RESEND, "LAWYER"],
        [ORIGIN_A, "LAWYER"],
        [LOGOUT_A, "LAWYER"],
      ],
    ],
    [
      OFFICE_B,
      "Office B",
      [],
      [
        [LAWYER_B, "LAWYER"],
        [SHARED, "LAWYER"],
        [FORGER_B, "LAWYER"],
      ],
    ],
    [OFFICE_LOCKED, "Locked office", ["10.0.0.0/8"], [[LOCKED_USER, "PARTNER"]]],
    [
      OFFICE_D,
      "Office D",
      [],
      [
        [PARTNER_D, "PARTNER"],
        [LAWYER_D, "LAWYER"],
      ],
    ],
    [
      OFFICE_G,
      "Office G",
      [],
      [
        [PARTNER_G, "PARTNER"],
        [LAWYER_G1, "LAWYER"],
        [LAWYER_G2, "LAWYER"],
      ],
    ],
    [OFFICE_R, "Office R", [], [[PARTNER_R, "PARTNER"]]],
    [
      OFFICE_Q,
      "Office Q",
      [],
      [
        [PARTNER_Q, "PARTNER"],
        [ACCOUNTANT_Q, "ACCOUNTANT"],
        [LAWYER_Q1, "LAWYER"],
        [LAWYER_Q2, "LAWYER"],
        [RECEPTION_Q, "RECEPTION"],
      ],
    ],
    [
      OFFICE_P,
      "Office P",
      [],
      [
        [PARTNER_P, "PARTNER"],
        [ADMIN_P, "ADMIN"],
        [LAWYER_P, "LAWYER"],
      ],
    ],
    [
      OFFICE_O,
      "Office O",
      [],
      [
        [PARTNER_O, "PARTNER"],
        [LAWYER_O1, "LAWYER"],
        [LAWYER_O2, "LAWYER"],
        [ASSISTANT_O, "ASSISTANT"],
      ],
    ],
    [
      OFFICE_N,
      "Office N",
      [],
      [
        [PARTNER_N, "PARTNER"],
        [ACCOUNTANT_N, "ACCOUNTANT"],
      ],
    ],
    [
      OFFICE_M,
      "Office M",
      [],
      [
        [PARTNER_M, "PARTNER"],
        [ACCOUNTANT_M, "ACCOUNTANT"],
        [LAWYER_M, "LAWYER"],
      ],
    ],
    [
      OFFICE_L,
      "Office L",
      [],
      [
        [PARTNER_L, "PARTNER"],
        [LAWYER_L1, "LAWYER"],
        [LAWYER_L2, "LAWYER"],
        [ASSISTANT_L, "ASSISTANT"],
      ],
    ],
    [
      OFFICE_K,
      "Office K",
      [],
      [
        [PARTNER_K, "PARTNER"],
        [LAWYER_K1, "LAWYER"],
        [LAWYER_K2, "LAWYER"],
        [RECEPTION_K, "RECEPTION"],
      ],
    ],
    [
      OFFICE_J,
      "Office J",
      [],
      [
        [PARTNER_J, "PARTNER"],
        [LAWYER_J1, "LAWYER"],
        [LAWYER_J2, "LAWYER"],
      ],
    ],
    [
      OFFICE_I,
      "Office I",
      [],
      [
        [PARTNER_I, "PARTNER"],
        [LAWYER_I1, "LAWYER"],
        [LAWYER_I2, "LAWYER"],
        [RECEPTION_I, "RECEPTION"],
      ],
    ],
    [
      OFFICE_H,
      "Office H",
      [],
      [
        [PARTNER_H, "PARTNER"],
        [LAWYER_H1, "LAWYER"],
        [LAWYER_H2, "LAWYER"],
      ],
    ],
    [
      OFFICE_F,
      "Office F",
      [],
      [
        [PARTNER_F, "PARTNER"],
        [RECEPTION_F, "RECEPTION"],
        [ACCOUNTANT_F, "ACCOUNTANT"],
      ],
    ],
    [
      OFFICE_E,
      "Office E",
      [],
      [
        [PARTNER_E, "PARTNER"],
        [LAWYER_E, "LAWYER"],
      ],
    ],
  ];
  for (const [office, name, allowlist, people] of seed) {
    await owner.begin(async (tx) => {
      await tx`select set_config('app.office_id', ${office}, true)`;
      await tx`insert into offices (id, name, ip_allowlist) values (${office}, ${name}, ${allowlist})`;
      for (const [phone, role, totp] of people) {
        await tx`insert into users (office_id, name, phone, role, totp_enabled, totp_secret_enc)
                 values (${office}, ${"user " + phone}, ${e164(phone)}, ${role}, ${Boolean(totp)},
                         ${totp ? encryptSecret(ENCRYPTION_KEY, totp) : null})`;
      }
    });
  }
  await owner.end();

  // Every office starts from the docs/04 default policy, as a new office would.
  const seeder = createDb(OWNER_URL, { max: 1 });
  for (const office of [
    OFFICE_A,
    OFFICE_B,
    OFFICE_LOCKED,
    OFFICE_D,
    OFFICE_E,
    OFFICE_F,
    OFFICE_G,
    OFFICE_H,
    OFFICE_I,
    OFFICE_J,
    OFFICE_K,
    OFFICE_L,
    OFFICE_M,
    OFFICE_N,
    OFFICE_O,
    OFFICE_P,
    OFFICE_Q,
    OFFICE_R,
  ]) {
    await withTenant(seeder.db, office, (tx) => seedOfficePolicy(tx, office));
  }
  await seeder.close();

  const env = loadEnv({
    DATABASE_URL: APP_URL,
    NODE_ENV: "test",
    LOG_LEVEL: "fatal",
    RBAC_ENFORCEMENT: "strict",
    CORS_ORIGINS: "http://localhost:3000",
    AUTH_SECRET: "e2e-auth-secret-0123456789abcdefghijkl",
    ENCRYPTION_KEY,
    OTP_PROVIDER: "console",
    STORAGE_DRIVER: "local",
    PDF_SERVICE_URL: `http://127.0.0.1:${pdfPort}`,
    PDF_SERVICE_TOKEN: PDF_TOKEN,
    STORAGE_LOCAL_DIR: mkdtempSync(join(tmpdir(), "murafaa-e2e-storage-")),
  });
  app = await createApp(env, { llm: fakeLlm });
  mountDocs(app, env);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app?.close();
  pdfStub.server?.close();
});

describe("API basics", () => {
  it("reports health inside the envelope", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(res.json()).toEqual({ data: { status: "ok", db: "up", version: "0.0.0" }, error: null });
  });

  it("rejects a missing session with an error envelope", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/offices/current" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ data: null, error: { code: "UNAUTHENTICATED" } });
    expect(res.json().error.requestId).toBeTruthy();
  });

  it("renders unknown routes as an error envelope", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/nope" });
    expect(res.json()).toMatchObject({ data: null, error: { code: "NOT_FOUND" } });
  });

  it("serves the zod-derived OpenAPI document", async () => {
    const doc = (await app.inject({ method: "GET", url: "/api/docs-json" })).json();
    expect(doc.paths).toHaveProperty(["/api/v1/auth/verify"]);
    expect(doc.paths["/api/v1/auth/verify"].post.responses).toHaveProperty("200");
    expect(doc.components.schemas).toHaveProperty("Me");
  });
});

describe("OTP login", () => {
  it("answers the same for unknown and ambiguous numbers, and sends nothing", async () => {
    for (const phone of ["0599999999", SHARED]) {
      const res = await post("/api/v1/auth/otp", { phone });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual({ sent: true });
    }
  });

  it("rejects an invalid phone with a field error", async () => {
    const res = await post("/api/v1/auth/otp", { phone: "0112345678" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.details[0]).toEqual({
      path: "phone",
      message: "auth.error.phoneInvalid",
    });
  });

  it("signs in with an httpOnly cookie and scopes everything to the user's office", async () => {
    const res = await login(PARTNER_A);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.user).toMatchObject({
      officeId: OFFICE_A,
      role: "PARTNER",
      previewRole: null,
    });
    expect(res.json().data.token).toBeUndefined();
    expect(String(res.headers["set-cookie"])).toMatch(/murafaa_session=.*HttpOnly.*SameSite=Lax/);

    const cookie = cookieOf(res);
    const me = (
      await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie } })
    ).json().data;
    expect(me.office).toEqual({ id: OFFICE_A, name: "Office A", readOnly: false });
    expect(me.isPartner).toBe(true);
    expect(me.screens).toEqual(expect.arrayContaining(["today", "cases", "finance", "perms"]));
    expect(me.modules.FINANCE).toBe("FULL");

    const office = await app.inject({
      method: "GET",
      url: "/api/v1/offices/current",
      headers: { cookie },
    });
    expect(office.json().data.id).toBe(OFFICE_A);
  });

  it("gives mobile clients a bearer token that works the same way", async () => {
    const res = await login(LAWYER_B, {}, { "x-client-type": "mobile" });
    const token = res.json().data.token as string;
    expect(token).toMatch(new RegExp(`^${OFFICE_B}\\.`));
    const me = (
      await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${token}` },
      })
    ).json().data;
    expect(me.office.id).toBe(OFFICE_B);
    expect(me.screens).not.toContain("finance");
    expect(me.modules.FINANCE).toBe("NONE");
  });

  it("rejects a token whose office id was swapped", async () => {
    const res = await login(FORGER_B, {}, { "x-client-type": "mobile" });
    const forged = String(res.json().data.token).replace(OFFICE_B, OFFICE_A);
    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${forged}` },
    });
    expect(me.statusCode).toBe(401);
  });

  it("enforces the 30-second resend cooldown", async () => {
    expect((await post("/api/v1/auth/otp", { phone: RESEND })).statusCode).toBe(200);
    const again = await post("/api/v1/auth/otp", { phone: RESEND });
    expect(again.statusCode).toBe(429);
    expect(again.json().error.code).toBe("RATE_LIMITED");
  });

  it("locks the code after 5 wrong attempts, even for the right code", async () => {
    const code = (await post("/api/v1/auth/otp", { phone: BRUTE })).json().data.devCode as string;
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      const r = await post("/api/v1/auth/verify", { phone: BRUTE, code: wrong });
      expect(r.json().error.code).toBe("OTP_INVALID");
    }
    const locked = await post("/api/v1/auth/verify", { phone: BRUTE, code });
    expect(locked.json().error.code).toBe("OTP_TOO_MANY_ATTEMPTS");
  });

  it("asks for TOTP when 2FA is on, then accepts the same OTP with a valid TOTP", async () => {
    const code = (await post("/api/v1/auth/otp", { phone: TOTP_USER })).json().data
      .devCode as string;
    const first = await post("/api/v1/auth/verify", { phone: TOTP_USER, code });
    expect(first.statusCode).toBe(401);
    expect(first.json().error.code).toBe("TOTP_REQUIRED");
    const bad = await post("/api/v1/auth/verify", { phone: TOTP_USER, code, totp: "000000" });
    expect(bad.json().error.code).toBe("TOTP_INVALID");
    const ok = await post("/api/v1/auth/verify", {
      phone: TOTP_USER,
      code,
      totp: totpCode(TOTP_SECRET),
    });
    expect(ok.statusCode).toBe(200);
  });

  it("refuses login from outside the office IP allowlist", async () => {
    const code = (await post("/api/v1/auth/otp", { phone: LOCKED_USER })).json().data
      .devCode as string;
    const outside = await post(
      "/api/v1/auth/verify",
      { phone: LOCKED_USER, code },
      {},
      "203.0.113.9",
    );
    expect(outside.statusCode).toBe(403);
    expect(outside.json().error.code).toBe("IP_NOT_ALLOWED");
    const inside = await post("/api/v1/auth/verify", { phone: LOCKED_USER, code }, {}, "10.1.2.3");
    expect(inside.statusCode).toBe(200);
    // The same session is refused when used from outside the allowlist.
    const cookie = cookieOf(inside);
    const away = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie },
      remoteAddress: "203.0.113.9",
    });
    expect(away.json().error.code).toBe("IP_NOT_ALLOWED");
  });

  it("rejects cookie-authenticated writes from a foreign origin", async () => {
    const cookie = cookieOf(await login(ORIGIN_A));
    const res = await post("/api/v1/auth/logout", {}, { cookie, origin: "https://evil.example" });
    expect(res.statusCode).toBe(403);
  });

  it("logs out: the session stops working and the cookie is cleared", async () => {
    const cookie = cookieOf(await login(LOGOUT_A));
    const out = await post("/api/v1/auth/logout", {}, { cookie, origin: "http://localhost:3000" });
    expect(out.statusCode).toBe(200);
    expect(String(out.headers["set-cookie"])).toContain("Max-Age=0");
    const me = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });

  it("audits OTP sends, logins, IP denials and logouts", async () => {
    const owner = postgres(OWNER_URL, { max: 1 });
    const actions = new Set<string>();
    for (const office of [OFFICE_A, OFFICE_LOCKED]) {
      const rows = await owner.begin(async (tx) => {
        await tx`select set_config('app.office_id', ${office}, true)`;
        return tx<{ action: string }[]>`select distinct action from audit_log`;
      });
      rows.forEach((r) => actions.add(r.action));
    }
    await owner.end();
    expect([...actions]).toEqual(
      expect.arrayContaining(["auth.otp.sent", "auth.login", "auth.login.ipDenied", "auth.logout"]),
    );
  });
});

describe("permissions administration (partner only)", () => {
  const WEB = { origin: "http://localhost:3000" };
  let partner = "";
  let lawyer = "";

  const as = (
    cookie: string,
    method: "GET" | "PUT" | "POST" | "DELETE",
    url: string,
    payload?: object,
  ) => app.inject({ method, url, headers: { cookie, ...WEB }, ...(payload ? { payload } : {}) });

  beforeAll(async () => {
    partner = cookieOf(await login(PARTNER_D));
    lawyer = cookieOf(await login(LAWYER_D));
  });

  it("refuses everyone but partners", async () => {
    const res = await as(lawyer, "GET", "/api/v1/permissions/matrix");
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("shows the office matrix seeded from docs/04", async () => {
    const rows = (await as(partner, "GET", "/api/v1/permissions/matrix")).json().data;
    expect(rows).toHaveLength(6);
    const lawyerRow = rows.find((r: { role: string }) => r.role === "LAWYER");
    expect(lawyerRow).toMatchObject({
      caseScope: "ASSIGNED",
      levels: { CASES: "EDIT", FINANCE: "NONE" },
    });
  });

  it("applies a level change on the very next request (no cache)", async () => {
    const res = await as(partner, "PUT", "/api/v1/permissions/matrix/level", {
      role: "LAWYER",
      module: "FINANCE",
      level: "VIEW",
    });
    expect(res.statusCode).toBe(200);
    const me = (await as(lawyer, "GET", "/api/v1/auth/me")).json().data;
    expect(me.modules.FINANCE).toBe("VIEW");
    expect(me.screens).toContain("finance");
  });

  it("changes a role's case scope", async () => {
    const rows = (
      await as(partner, "PUT", "/api/v1/permissions/matrix/scope", { role: "LAWYER", scope: "ALL" })
    ).json().data;
    expect(rows.find((r: { role: string }) => r.role === "LAWYER").caseScope).toBe("ALL");
  });

  it("never leaves the office without a partner", async () => {
    const people = (await as(partner, "GET", "/api/v1/permissions/users")).json().data as Array<{
      id: string;
      role: string;
    }>;
    const self = people.find((u) => u.role === "PARTNER")!;
    const res = await as(partner, "PUT", `/api/v1/permissions/users/${self.id}/role`, {
      role: "LAWYER",
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatchObject({ code: "CONFLICT", messageKey: "errors.LAST_PARTNER" });
  });

  it("changes another user's role, effective immediately", async () => {
    const people = (await as(partner, "GET", "/api/v1/permissions/users")).json().data as Array<{
      id: string;
      role: string;
    }>;
    const other = people.find((u) => u.role === "LAWYER")!;
    const updated = (
      await as(partner, "PUT", `/api/v1/permissions/users/${other.id}/role`, { role: "ASSISTANT" })
    ).json().data;
    expect(updated.find((u: { id: string }) => u.id === other.id).role).toBe("ASSISTANT");
    expect((await as(lawyer, "GET", "/api/v1/auth/me")).json().data.user.role).toBe("ASSISTANT");
  });

  it("previews another role view-only, and can always end the preview", async () => {
    expect(
      (await as(partner, "POST", "/api/v1/permissions/preview", { role: "RECEPTION" })).statusCode,
    ).toBe(200);
    const me = (await as(partner, "GET", "/api/v1/auth/me")).json().data;
    expect(me.user).toMatchObject({ role: "PARTNER", previewRole: "RECEPTION" });
    expect(me.isPartner).toBe(true);
    expect(me.screens).not.toContain("perms");
    // Partner powers are gone while previewing, and writes are blocked outright.
    expect((await as(partner, "GET", "/api/v1/permissions/matrix")).statusCode).toBe(403);
    const write = await as(partner, "PUT", "/api/v1/permissions/matrix/level", {
      role: "LAWYER",
      module: "HR",
      level: "FULL",
    });
    expect(write.statusCode).toBe(403);

    expect((await as(partner, "DELETE", "/api/v1/permissions/preview")).statusCode).toBe(200);
    expect((await as(partner, "GET", "/api/v1/auth/me")).json().data.user.previewRole).toBeNull();
    expect((await as(partner, "GET", "/api/v1/permissions/matrix")).statusCode).toBe(200);
  });

  it("lists logins and permission changes in the security log", async () => {
    const entries = (await as(partner, "GET", "/api/v1/permissions/audit")).json().data as Array<{
      action: string;
      detail: string | null;
    }>;
    const actions = entries.map((e) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "auth.login",
        "permission.setLevel",
        "permission.setCaseScope",
        "permission.setUserRole",
        "permission.preview.start",
      ]),
    );
    expect(entries.find((e) => e.action === "permission.setLevel")?.detail).toBe(
      "role=LAWYER · module=FINANCE · level=VIEW",
    );
  });
});

describe("account security and office settings", () => {
  const WEB = { origin: "http://localhost:3000" };
  let partner = "";
  let lawyer = "";
  const as = (cookie: string, method: "GET" | "PUT" | "POST", url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie, ...WEB }, ...(payload ? { payload } : {}) });
  const notCode = (secret: string) => (totpCode(secret) === "000000" ? "111111" : "000000");

  beforeAll(async () => {
    partner = cookieOf(await login(PARTNER_E));
    lawyer = cookieOf(await login(LAWYER_E));
  });

  it("returns the caller's phone in /auth/me", async () => {
    expect((await as(lawyer, "GET", "/api/v1/auth/me")).json().data.phone).toBe(e164(LAWYER_E));
  });

  it("enrols TOTP only after a valid code, and disabling needs a code too", async () => {
    const { secret, uri } = (await as(lawyer, "POST", "/api/v1/security/totp/begin")).json().data;
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    const wrong = await as(lawyer, "POST", "/api/v1/security/totp/confirm", {
      code: notCode(secret),
    });
    expect(wrong.json().error).toMatchObject({
      code: "TOTP_INVALID",
      messageKey: "security.totp.invalidCode",
    });
    expect((await as(lawyer, "GET", "/api/v1/security/status")).json().data.totpEnabled).toBe(
      false,
    );

    expect(
      (await as(lawyer, "POST", "/api/v1/security/totp/confirm", { code: totpCode(secret) }))
        .statusCode,
    ).toBe(200);
    expect((await as(lawyer, "GET", "/api/v1/security/status")).json().data.totpEnabled).toBe(true);

    expect(
      (await as(lawyer, "POST", "/api/v1/security/totp/disable", { code: notCode(secret) }))
        .statusCode,
    ).toBe(401);
    expect(
      (await as(lawyer, "POST", "/api/v1/security/totp/disable", { code: totpCode(secret) }))
        .statusCode,
    ).toBe(200);
    expect((await as(lawyer, "GET", "/api/v1/security/status")).json().data.totpEnabled).toBe(
      false,
    );
  });

  it("expires an unconfirmed enrollment", async () => {
    const { secret } = (await as(partner, "POST", "/api/v1/security/totp/begin")).json().data;
    const owner = postgres(OWNER_URL, { max: 1 });
    await owner.begin(async (tx) => {
      await tx`select set_config('app.office_id', ${OFFICE_E}, true)`;
      await tx`update users set totp_pending_expires_at = now() - interval '1 minute' where phone = ${e164(PARTNER_E)}`;
    });
    await owner.end();
    const res = await as(partner, "POST", "/api/v1/security/totp/confirm", {
      code: totpCode(secret),
    });
    expect(res.json().error.messageKey).toBe("security.totp.expired");
  });

  it("validates the IP allowlist and refuses one that would lock the partner out", async () => {
    expect((await as(lawyer, "GET", "/api/v1/security/ip-allowlist")).statusCode).toBe(403);

    const bad = await as(partner, "PUT", "/api/v1/security/ip-allowlist", {
      entries: ["10.0.0.0/8", "not-an-ip"],
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.details).toEqual([
      { path: "entries.1", message: "security.ip.invalidEntry" },
    ]);

    const lockout = await as(partner, "PUT", "/api/v1/security/ip-allowlist", {
      entries: ["10.0.0.0/8"],
    });
    expect(lockout.json().error).toMatchObject({
      code: "CONFLICT",
      messageKey: "errors.IP_LOCKOUT",
    });

    const ok = await as(partner, "PUT", "/api/v1/security/ip-allowlist", {
      entries: ["127.0.0.1", " 127.0.0.1 ", "10.0.0.0/8"],
    });
    expect(ok.json().data.entries).toEqual(["127.0.0.1", "10.0.0.0/8"]);
    expect(
      (await as(partner, "PUT", "/api/v1/security/ip-allowlist", { entries: [] })).json().data
        .entries,
    ).toEqual([]);
  });

  it("lets everyone read the branding and only partners change it", async () => {
    const read = (await as(lawyer, "GET", "/api/v1/offices/branding")).json().data;
    expect(read).toMatchObject({ name: "Office E", primaryColor: "#0E3A30" });

    expect(
      (await as(lawyer, "PUT", "/api/v1/offices/branding", { ...read, name: "x" })).statusCode,
    ).toBe(403);
    expect(
      (await as(partner, "PUT", "/api/v1/offices/branding", { ...read, primaryColor: "red" }))
        .statusCode,
    ).toBe(400);

    const saved = (
      await as(partner, "PUT", "/api/v1/offices/branding", {
        ...read,
        name: "مكتب هـ",
        accentColor: "#112233",
      })
    ).json().data;
    expect(saved).toMatchObject({ name: "مكتب هـ", accentColor: "#112233" });
    expect((await as(lawyer, "GET", "/api/v1/offices/current")).json().data.name).toBe("مكتب هـ");
  });

  it("shows the billing usage summary to partners only", async () => {
    expect((await as(lawyer, "GET", "/api/v1/billing/usage")).statusCode).toBe(403);
    const usage = (await as(partner, "GET", "/api/v1/billing/usage")).json().data;
    expect(usage).toMatchObject({ seats: 2, cases: 0, clients: 0, documents: 0 });
    expect(Date.parse(usage.memberSince)).not.toBeNaN();
  });

  it("shows an empty recycle bin until modules register their records", async () => {
    expect((await as(lawyer, "GET", "/api/v1/recycle")).json()).toEqual({ data: [], error: null });
  });

  it("audits security and branding changes", async () => {
    const owner = postgres(OWNER_URL, { max: 1 });
    const rows = await owner.begin(async (tx) => {
      await tx`select set_config('app.office_id', ${OFFICE_E}, true)`;
      return tx<{ action: string }[]>`select distinct action from audit_log`;
    });
    await owner.end();
    expect(rows.map((r) => r.action)).toEqual(
      expect.arrayContaining([
        "security.totp.enable",
        "security.totp.disable",
        "security.ipAllowlist.update",
        "office.branding.update",
      ]),
    );
  });
});

describe("clients and leads (CRM)", () => {
  const WEB = { origin: "http://localhost:3000" };
  let partner = "";
  let reception = "";
  let accountant = "";
  const as = (
    cookie: string,
    method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE",
    url: string,
    payload?: object,
  ) => app.inject({ method, url, headers: { cookie, ...WEB }, ...(payload ? { payload } : {}) });

  beforeAll(async () => {
    partner = cookieOf(await login(PARTNER_F));
    reception = cookieOf(await login(RECEPTION_F));
    accountant = cookieOf(await login(ACCOUNTANT_F));
  });

  it("is closed to roles without the clients module", async () => {
    expect((await as(accountant, "GET", "/api/v1/clients")).statusCode).toBe(403);
    expect((await as(accountant, "GET", "/api/v1/leads")).statusCode).toBe(403);
  });

  it("creates clients with a normalized phone and rejects bad or taken numbers", async () => {
    const created = await as(reception, "POST", "/api/v1/clients", {
      name: "شركة الإمداد",
      phone: "0555000111",
      city: "الرياض",
      type: "COMPANY",
    });
    expect(created.json().data).toMatchObject({
      name: "شركة الإمداد",
      phone: "+966555000111",
      type: "COMPANY",
      status: "ACTIVE",
      casesCount: 0,
    });

    const taken = await as(reception, "POST", "/api/v1/clients", {
      name: "آخر",
      phone: "+966555000111",
    });
    expect(taken.json().error).toMatchObject({
      code: "CONFLICT",
      messageKey: "errors.CLIENT_PHONE_TAKEN",
    });

    const bad = await as(reception, "POST", "/api/v1/clients", {
      name: "خطأ",
      phone: "0112345678",
    });
    expect(bad.json().error.details[0]).toEqual({
      path: "phone",
      message: "auth.error.phoneInvalid",
    });

    expect(
      (await as(reception, "POST", "/api/v1/clients", { name: "بلا جوال", phone: "" })).json().data
        .phone,
    ).toBeNull();
  });

  it("updates a client and 404s on another office's id", async () => {
    const list = (await as(reception, "GET", "/api/v1/clients")).json().data as Array<{
      id: string;
      name: string;
    }>;
    const target = list.find((c) => c.name === "شركة الإمداد")!;
    expect(
      (
        await as(reception, "PATCH", `/api/v1/clients/${target.id}`, {
          status: "INACTIVE",
          city: "",
        })
      ).statusCode,
    ).toBe(200);
    const after = (await as(reception, "GET", "/api/v1/clients"))
      .json()
      .data.find((c: { id: string }) => c.id === target.id);
    expect(after).toMatchObject({ status: "INACTIVE", city: null });
    expect(
      (await as(reception, "PATCH", `/api/v1/clients/${OFFICE_A}`, { name: "x" })).statusCode,
    ).toBe(404);
  });

  it("runs the leads pipeline with bounded moves and KPIs", async () => {
    await as(reception, "POST", "/api/v1/leads", {
      name: "مؤسسة النخبة",
      source: "WEBSITE",
      expectedValue: 500000,
      nextAction: "اتصال",
    });
    await as(reception, "POST", "/api/v1/leads", { name: "عميل ثانٍ", expectedValue: 150000 });
    const leads = (await as(reception, "GET", "/api/v1/leads")).json().data as Array<{
      id: string;
      name: string;
      stage: string;
    }>;
    const lead = leads.find((l) => l.name === "مؤسسة النخبة")!;
    expect(lead).toMatchObject({ stage: "PROSPECT", source: "WEBSITE", expectedValue: 500000 });

    await as(reception, "POST", `/api/v1/leads/${lead.id}/move`, { direction: -1 });
    await as(reception, "POST", `/api/v1/leads/${lead.id}/move`, { direction: 1 });
    await as(reception, "POST", `/api/v1/leads/${lead.id}/move`, { direction: 1 });
    const moved = (await as(reception, "GET", "/api/v1/leads"))
      .json()
      .data.find((l: { id: string }) => l.id === lead.id);
    expect(moved.stage).toBe("FEE_PROPOSAL_SENT");

    await as(reception, "PUT", `/api/v1/leads/${lead.id}`, {
      name: "مؤسسة النخبة",
      expectedValue: 600000,
      nextAction: "",
      phone: "0500000777",
    });
    const edited = (await as(reception, "GET", "/api/v1/leads"))
      .json()
      .data.find((l: { id: string }) => l.id === lead.id);
    expect(edited).toMatchObject({
      expectedValue: 600000,
      nextAction: null,
      phone: "+966500000777",
    });

    const kpis = (await as(reception, "GET", "/api/v1/leads/kpis")).json().data;
    expect(kpis).toEqual({ activeCount: 2, pipelineValue: 750000, conversionRatePct: 0 });
  });

  it("deletes leads (full access only) into the recycle bin, restorable with edit access", async () => {
    const lead = (
      (await as(reception, "GET", "/api/v1/leads")).json().data as Array<{
        id: string;
        name: string;
      }>
    ).find((l) => l.name === "عميل ثانٍ")!;
    expect((await as(reception, "DELETE", `/api/v1/leads/${lead.id}`)).statusCode).toBe(403);
    expect((await as(partner, "DELETE", `/api/v1/leads/${lead.id}`)).statusCode).toBe(200);
    expect(
      (await as(reception, "GET", "/api/v1/leads"))
        .json()
        .data.some((l: { id: string }) => l.id === lead.id),
    ).toBe(false);

    const bin = (await as(reception, "GET", "/api/v1/recycle")).json().data;
    expect(bin).toEqual([
      expect.objectContaining({ kind: "lead", id: lead.id, label: "عميل ثانٍ" }),
    ]);
    expect((await as(accountant, "GET", "/api/v1/recycle")).json().data).toEqual([]);

    expect(
      (await as(accountant, "POST", `/api/v1/recycle/lead/${lead.id}/restore`)).statusCode,
    ).toBe(403);
    expect(
      (await as(reception, "POST", `/api/v1/recycle/lead/${lead.id}/restore`)).statusCode,
    ).toBe(200);
    expect(
      (await as(reception, "GET", "/api/v1/leads"))
        .json()
        .data.some((l: { id: string }) => l.id === lead.id),
    ).toBe(true);
  });
});

describe("cases, conflicts and row scope", () => {
  const WEB = { origin: "http://localhost:3000" };
  let partner = "";
  let lawyer1 = "";
  let lawyer2 = "";
  const as = (
    cookie: string,
    method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE",
    url: string,
    payload?: object,
  ) => app.inject({ method, url, headers: { cookie, ...WEB }, ...(payload ? { payload } : {}) });
  const detail = async (cookie: string, id: string) =>
    (await as(cookie, "GET", `/api/v1/cases/${id}`)).json().data;
  const clientId = async (name: string) =>
    (
      (await as(partner, "GET", "/api/v1/clients")).json().data as Array<{
        id: string;
        name: string;
      }>
    ).find((c) => c.name === name)!.id;
  const newCase = async (cookie: string, body: object) =>
    (await as(cookie, "POST", "/api/v1/cases", { number: "1447/1", ...body })).json().data
      .id as string;

  beforeAll(async () => {
    partner = cookieOf(await login(PARTNER_G));
    lawyer1 = cookieOf(await login(LAWYER_G1));
    lawyer2 = cookieOf(await login(LAWYER_G2));
    await as(partner, "POST", "/api/v1/clients", { name: "شركة الأمل" });
    await as(partner, "POST", "/api/v1/clients", { name: "أحمد سالم" });
    await as(partner, "POST", "/api/v1/leads", { name: "مؤسسة الندى" });
  });

  it("creates a case, assigns the creator and writes the timeline", async () => {
    const id = await newCase(lawyer1, {
      title: "مطالبة مالية",
      clientId: await clientId("شركة الأمل"),
      opposingParty: "شركة بعيدة",
    });
    const c = await detail(lawyer1, id);
    expect(c).toMatchObject({
      title: "مطالبة مالية",
      stage: "FIRST_INSTANCE",
      effectiveStage: "FIRST_INSTANCE",
      status: "ACTIVE",
      client: { name: "شركة الأمل" },
    });
    expect(c.assignees.map((a: { name: string }) => a.name)).toEqual([`user ${LAWYER_G1}`]);
    expect(c.events[0]).toMatchObject({
      type: "SYSTEM",
      message: { messageKey: "event.caseCreated" },
      actorName: `user ${LAWYER_G1}`,
    });
    expect(c.conflicts).toEqual([]);
  });

  it("hides cases outside an ASSIGNED role's scope (and audits the attempt)", async () => {
    const id = await newCase(lawyer1, { title: "قضية خاصة" });
    expect(
      (await as(lawyer2, "GET", "/api/v1/cases"))
        .json()
        .data.some((c: { id: string }) => c.id === id),
    ).toBe(false);
    expect((await as(lawyer2, "GET", `/api/v1/cases/${id}`)).statusCode).toBe(404);
    expect((await as(lawyer2, "POST", `/api/v1/cases/${id}/stage/promote`)).statusCode).toBe(404);
    expect(
      (await as(partner, "GET", "/api/v1/cases"))
        .json()
        .data.some((c: { id: string }) => c.id === id),
    ).toBe(true);
    const log = (await as(partner, "GET", "/api/v1/permissions/audit")).json().data as Array<{
      action: string;
    }>;
    expect(log.some((e) => e.action === "access.case.scope")).toBe(true);
  });

  it("flags an opponent who is our client (HIGH) and a lead (MEDIUM), with Arabic-aware matching", async () => {
    const high = await newCase(lawyer1, { title: "ضد عميل", opposingParty: "احمد سالم" }); // أحمد vs احمد
    const c1 = await detail(lawyer1, high);
    expect(c1.conflicts).toEqual([
      expect.objectContaining({
        severity: "HIGH",
        status: "ACTIVE",
        message: { messageKey: "conflict.opponentIsClient", params: { opponent: "احمد سالم" } },
      }),
    ]);
    const medium = await newCase(lawyer1, { title: "ضد عميل محتمل", opposingParty: "مؤسسة الندى" });
    expect((await detail(lawyer1, medium)).conflicts[0]).toMatchObject({
      severity: "MEDIUM",
      message: { messageKey: "conflict.opponentIsLead" },
    });
    const list = (await as(lawyer1, "GET", "/api/v1/cases")).json().data as Array<{
      id: string;
      conflictSeverity: string | null;
    }>;
    expect(list.find((c) => c.id === high)?.conflictSeverity).toBe("HIGH");
  });

  it("re-scans existing cases when a matching client is added later (reverse trigger)", async () => {
    const id = await newCase(lawyer1, { title: "خصم جديد", opposingParty: "شركة الغد" });
    expect((await detail(lawyer1, id)).conflicts).toEqual([]);
    await as(partner, "POST", "/api/v1/clients", { name: "شركة الغد" });
    expect((await detail(lawyer1, id)).conflicts[0]).toMatchObject({
      severity: "HIGH",
      message: { messageKey: "conflict.opponentIsClient" },
    });
  });

  it("names other cases only to viewers who can see them", async () => {
    const zaid = await (async () => {
      await as(partner, "POST", "/api/v1/clients", { name: "زيد" });
      return clientId("زيد");
    })();
    // Lawyer 1's case for client زيد; a partner-only case where زيد is the opponent.
    const mine = await newCase(lawyer1, { title: "قضية زيد", clientId: zaid });
    await newCase(partner, { title: "سرّية", opposingParty: "زيد" });
    const forLawyer = (await detail(lawyer1, mine)).conflicts.find(
      (f: { message: { messageKey: string } }) =>
        f.message.messageKey.startsWith("conflict.ourClientIsOpponent"),
    );
    expect(forLawyer.message).toEqual({
      messageKey: "conflict.ourClientIsOpponentOtherCaseGeneric",
      params: { client: "زيد", count: 1 },
    });
    const forPartner = (await detail(partner, mine)).conflicts.find(
      (f: { message: { messageKey: string } }) =>
        f.message.messageKey.startsWith("conflict.ourClientIsOpponent"),
    );
    expect(forPartner.message).toEqual({
      messageKey: "conflict.ourClientIsOpponentOtherCase",
      params: { client: "زيد", cases: "سرّية" },
    });
  });

  it("lets only partners waive; a waiver survives re-scans and a cleared conflict resolves", async () => {
    const id = await newCase(lawyer1, { title: "تنازل", opposingParty: "شركة الأمل" });
    // The opponent is both a client (rule 1) and our client in another case (rule 3).
    const flags = (await detail(lawyer1, id)).conflicts as Array<{
      id: string;
      message: { messageKey: string };
    }>;
    expect(flags.map((f) => f.message.messageKey).sort()).toEqual([
      "conflict.opponentIsClient",
      "conflict.opponentIsOurClientOtherCase",
    ]);
    const flag = flags.find((f) => f.message.messageKey === "conflict.opponentIsClient")!;
    expect(
      (await as(lawyer1, "POST", `/api/v1/cases/${id}/conflicts/${flag.id}/waive`, { note: "x" }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await as(partner, "POST", `/api/v1/cases/${id}/conflicts/${flag.id}/waive`, {
          note: "موافقة كتابية من العميلين",
        })
      ).statusCode,
    ).toBe(200);
    await as(partner, "PATCH", `/api/v1/clients/${await clientId("شركة الأمل")}`, { city: "جدة" }); // not a rename: no change
    await as(lawyer1, "PATCH", `/api/v1/cases/${id}`, { entity: "المحكمة التجارية" }); // not a party change
    let c = await detail(lawyer1, id);
    expect(c.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: flag.id,
          status: "WAIVED",
          waiverNote: "موافقة كتابية من العميلين",
        }),
        expect.objectContaining({
          status: "ACTIVE",
          message: expect.objectContaining({ messageKey: "conflict.opponentIsOurClientOtherCase" }),
        }),
      ]),
    );

    const other = await newCase(lawyer1, { title: "يزول", opposingParty: "أحمد سالم" });
    await as(lawyer1, "PATCH", `/api/v1/cases/${other}`, { opposingParty: "طرف آخر" });
    c = await detail(lawyer1, other);
    expect(c.conflicts).toEqual([]);
    expect(
      (
        (await as(lawyer1, "GET", "/api/v1/cases")).json().data as Array<{
          id: string;
          conflictSeverity: string | null;
        }>
      ).find((x) => x.id === other)?.conflictSeverity,
    ).toBeNull();
  });

  it("tracks stage, procedure, outcome, assignees and closing", async () => {
    const id = await newCase(lawyer1, { title: "مراحل" });
    await as(lawyer1, "POST", `/api/v1/cases/${id}/stage/promote`);
    await as(lawyer1, "POST", `/api/v1/cases/${id}/stage/remand`);
    await as(lawyer1, "POST", `/api/v1/cases/${id}/stage/remand`);
    await as(lawyer1, "POST", `/api/v1/cases/${id}/stage/remand`); // already first: no-op
    await as(lawyer1, "POST", `/api/v1/cases/${id}/procedure/end`, { result: "صلح" });
    await as(lawyer1, "PUT", `/api/v1/cases/${id}/outcome`, { outcome: "SETTLED" });
    await as(lawyer1, "POST", `/api/v1/cases/${id}/closing/checklist`, { key: "archiveFile" });
    await as(lawyer1, "PUT", `/api/v1/cases/${id}/satisfaction`, { score: 5 });
    await as(lawyer1, "POST", `/api/v1/cases/${id}/referral`);

    const users = (await as(lawyer1, "GET", "/api/v1/cases/assignable-users")).json()
      .data as Array<{ id: string; name: string }>;
    const l2 = users.find((u) => u.name === `user ${LAWYER_G2}`)!;
    await as(lawyer1, "POST", `/api/v1/cases/${id}/assignees`, { userId: l2.id });
    expect((await as(lawyer2, "GET", `/api/v1/cases/${id}`)).statusCode).toBe(200);
    await as(lawyer1, "DELETE", `/api/v1/cases/${id}/assignees/${l2.id}`);
    expect((await as(lawyer2, "GET", `/api/v1/cases/${id}`)).statusCode).toBe(404);

    await as(lawyer1, "POST", `/api/v1/cases/${id}/archive`);
    const c = await detail(lawyer1, id);
    expect(c).toMatchObject({
      stage: "RECONCILIATION",
      procEnded: true,
      procResult: "صلح",
      outcome: "SETTLED",
      closingChecklist: { archiveFile: true },
      clientSatisfactionScore: 5,
      referralRequested: true,
      isArchived: true,
      status: "CLOSED",
    });
    const keys = c.events.map(
      (e: { message: { messageKey: string } | null }) => e.message?.messageKey,
    );
    expect(keys).toEqual(
      expect.arrayContaining([
        "event.stagePromoted",
        "event.stageRemanded",
        "event.procEnded",
        "event.outcomeSet",
        "event.assigneeAdded",
        "event.assigneeRemoved",
        "event.caseArchived",
      ]),
    );
    expect(
      c.events.find(
        (e: { message: { messageKey: string } | null }) =>
          e.message?.messageKey === "event.stagePromoted",
      ).message.params,
    ).toEqual({ stage: "@case.stage.APPEAL" });
    expect(
      c.events.find(
        (e: { message: { messageKey: string } | null }) =>
          e.message?.messageKey === "event.assigneeRemoved",
      ).message.params,
    ).toEqual({ name: `user ${LAWYER_G2}` });
  });

  it("refuses a client from another office", async () => {
    const res = await as(lawyer1, "POST", "/api/v1/cases", {
      number: "1",
      title: "x",
      clientId: OFFICE_A,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.details[0].path).toBe("clientId");
  });

  it("converts a contracted lead into a client and a case, exactly once", async () => {
    await as(lawyer1, "POST", "/api/v1/leads", { name: "مؤسسة الريان", phone: "0555777000" });
    const lead = (
      (await as(lawyer1, "GET", "/api/v1/leads")).json().data as Array<{ id: string; name: string }>
    ).find((l) => l.name === "مؤسسة الريان")!;
    const early = await as(lawyer1, "POST", `/api/v1/leads/${lead.id}/convert`);
    expect(early.json().error).toMatchObject({
      code: "CONFLICT",
      messageKey: "errors.LEAD_NOT_CONTRACTED",
    });

    for (let i = 0; i < 3; i++)
      await as(lawyer1, "POST", `/api/v1/leads/${lead.id}/move`, { direction: 1 });
    const converted = (await as(lawyer1, "POST", `/api/v1/leads/${lead.id}/convert`)).json().data;
    const again = await as(lawyer1, "POST", `/api/v1/leads/${lead.id}/convert`);
    expect(again.json().error.messageKey).toBe("errors.LEAD_ALREADY_CONVERTED");

    const c = await detail(lawyer1, converted.caseId); // the converter can see it
    expect(c).toMatchObject({
      title: "قضية مؤسسة الريان",
      client: { name: "مؤسسة الريان", phone: "+966555777000" },
    });
    expect(c.events[0].message).toEqual({
      messageKey: "event.leadConverted",
      params: { name: "مؤسسة الريان" },
    });

    const clientsList = (await as(lawyer1, "GET", "/api/v1/clients")).json().data as Array<{
      id: string;
      casesCount: number;
    }>;
    expect(clientsList.find((x) => x.id === converted.clientId)?.casesCount).toBe(1);
    expect(
      (await as(lawyer1, "GET", "/api/v1/leads"))
        .json()
        .data.some((l: { id: string }) => l.id === lead.id),
    ).toBe(false);
    expect(
      (await as(partner, "GET", "/api/v1/recycle"))
        .json()
        .data.some((i: { id: string }) => i.id === lead.id),
    ).toBe(false);
  });
});

describe("hearings, tasks and procedural requests", () => {
  const WEB = { origin: "http://localhost:3000" };
  let partner = "";
  let lawyer1 = "";
  let lawyer2 = "";
  const as = (
    cookie: string,
    method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE",
    url: string,
    payload?: object,
  ) => app.inject({ method, url, headers: { cookie, ...WEB }, ...(payload ? { payload } : {}) });
  const detail = async (cookie: string, id: string) =>
    (await as(cookie, "GET", `/api/v1/cases/${id}`)).json().data;
  const newCase = async (cookie: string, title: string) =>
    (await as(cookie, "POST", "/api/v1/cases", { number: "1447/9", title })).json().data
      .id as string;
  const board = async (cookie: string) =>
    (await as(cookie, "GET", "/api/v1/tasks")).json().data as Array<{
      id: string;
      title: string;
      origin: string;
      priority: string;
      dueAt: string | null;
      caseId: string | null;
      status: string;
    }>;
  const keys = (c: { events: Array<{ message: { messageKey: string } | null }> }) =>
    c.events.map((e) => e.message?.messageKey);

  beforeAll(async () => {
    partner = cookieOf(await login(PARTNER_H));
    lawyer1 = cookieOf(await login(LAWYER_H1));
    lawyer2 = cookieOf(await login(LAWYER_H2));
  });

  it("records a judgment: objection deadline (+30 days) and one urgent task due 5 days earlier", async () => {
    const id = await newCase(lawyer1, "حكم ابتدائي");
    const res = await as(lawyer1, "POST", `/api/v1/cases/${id}/hearings`, {
      hearingDate: "2026-03-01",
      kind: "JUDGMENT_PRONOUNCEMENT",
      stageIndex: 2,
      result: "حكم لصالح موكلنا",
    });
    expect(res.statusCode).toBe(201);
    const c = await detail(lawyer1, id);
    expect(c.judgmentDate).toBe("2026-03-01T00:00:00.000Z");
    expect(c.objectionDueAt).toBe("2026-03-31T00:00:00.000Z");
    expect(c.effectiveStage).toBe("APPEAL");
    expect(c.stage).toBe("FIRST_INSTANCE");
    expect(c.hearings).toHaveLength(1);
    expect(c.hearings[0]).toMatchObject({
      sequenceNo: 1,
      status: "HELD",
      kind: "JUDGMENT_PRONOUNCEMENT",
    });
    expect(keys(c)).toEqual(
      expect.arrayContaining(["event.hearingRecorded", "event.objectionDeadline"]),
    );

    // Recording a second judgment for the same deadline must not duplicate the task.
    await as(lawyer1, "POST", `/api/v1/cases/${id}/hearings`, {
      hearingDate: "2026-03-01",
      kind: "JUDGMENT_PRONOUNCEMENT",
    });
    const auto = (await board(lawyer1)).filter(
      (t) => t.caseId === id && t.origin === "AUTO_OBJECTION",
    );
    expect(auto).toHaveLength(1);
    expect(auto[0]).toMatchObject({ priority: "URGENT", dueAt: "2026-03-26T00:00:00.000Z" });
  });

  it("keeps a single upcoming hearing with a prep task, and flags an assignee's clash", async () => {
    const id = await newCase(lawyer1, "جلسات قادمة");
    const other = await newCase(lawyer1, "قضية أخرى");
    await as(lawyer1, "PUT", `/api/v1/cases/${other}/hearings/next`, { date: "2026-12-10" });
    await as(lawyer1, "PUT", `/api/v1/cases/${id}/hearings/next`, { date: "2026-12-01" });
    await as(lawyer1, "PUT", `/api/v1/cases/${id}/hearings/next`, { date: "2026-12-10" });
    let c = await detail(lawyer1, id);
    expect(c.upcomingHearing).toMatchObject({
      status: "UPCOMING",
      hearingDate: "2026-12-10T00:00:00.000Z",
    });
    expect(c.hearings).toEqual([]);
    const clash = c.events.find(
      (e: { message: { messageKey: string } | null }) =>
        e.message?.messageKey === "event.hearingClashGeneric",
    );
    expect(clash.message.params).toEqual({ name: `user ${LAWYER_H1}`, count: 1 });
    const prep = (await board(lawyer1)).filter(
      (t) => t.caseId === id && t.origin === "AUTO_HEARING_PREP",
    );
    expect(prep).toHaveLength(2); // one per scheduled date

    // Holding the hearing retires the upcoming one.
    await as(lawyer1, "POST", `/api/v1/cases/${id}/hearings`, {
      hearingDate: "2026-12-10",
      minutes: "تأجيل",
    });
    c = await detail(lawyer1, id);
    expect(c.upcomingHearing).toBeNull();
    expect(c.hearings).toHaveLength(1);
    expect(c.objectionDueAt).toBeNull();
  });

  it("captures follow-up actions and manages reminders and tasks on a hearing", async () => {
    const id = await newCase(lawyer1, "متابعة");
    const users = (await as(lawyer1, "GET", "/api/v1/cases/assignable-users")).json()
      .data as Array<{ id: string; name: string }>;
    const l1 = users.find((u) => u.name === `user ${LAWYER_H1}`)!;
    const foreign = await as(lawyer1, "POST", `/api/v1/cases/${id}/hearings`, {
      hearingDate: "2026-04-01",
      actionTaskTitle: "x",
      actionTaskAssigneeId: OFFICE_A,
    });
    expect(foreign.statusCode).toBe(400);
    expect(foreign.json().error.details[0].path).toBe("actionTaskAssigneeId");

    await as(lawyer1, "POST", `/api/v1/cases/${id}/hearings`, {
      hearingDate: "2026-04-01",
      actionReminderText: "إحضار الأصل",
      actionReminderDueOn: "2026-04-05",
      actionTaskTitle: "مذكرة رد",
      actionTaskAssigneeId: l1.id,
      actionRequestParty: "OURS",
      actionRequestType: null,
      actionRequestText: "طلب إدخال طرف",
    });
    let h = (await detail(lawyer1, id)).hearings[0];
    expect(h.actions.reminders).toMatchObject([
      { text: "إحضار الأصل", dueOn: "2026-04-05T00:00:00.000Z" },
    ]);
    expect(h.actions.tasks).toMatchObject([
      { title: "مذكرة رد", assigneeName: `user ${LAWYER_H1}`, done: false },
    ]);

    const base = `/api/v1/cases/${id}/hearings/${h.id}`;
    await as(lawyer1, "POST", `${base}/reminders`, { text: "متابعة", dueOn: "2026-04-10" });
    const rid = h.actions.reminders[0].id;
    await as(lawyer1, "PATCH", `${base}/reminders/${rid}`, {
      text: "إحضار الأصل والصورة",
      dueOn: "2026-04-06",
    });
    expect(
      (await as(lawyer1, "POST", `${base}/reminders/${rid}/escalate`, { assigneeId: l1.id }))
        .statusCode,
    ).toBe(200);
    const tid = h.actions.tasks[0].id;
    await as(lawyer1, "PATCH", `${base}/tasks/${tid}`, { title: "مذكرة رد", done: true });
    await as(lawyer1, "POST", `${base}/tasks`, { title: "مراجعة" });
    h = (await detail(lawyer1, id)).hearings[0];
    expect(h.actions.reminders.map((r: { text: string }) => r.text)).toEqual([
      "إحضار الأصل والصورة",
      "متابعة",
    ]);
    expect(h.actions.reminders[0].isTaskLinked).toBe(true);
    expect(h.actions.tasks.find((t: { id: string }) => t.id === tid).done).toBe(true);
    await as(lawyer1, "DELETE", `${base}/reminders/${rid}`);
    expect((await detail(lawyer1, id)).hearings[0].actions.reminders).toHaveLength(1);

    // The request captured in the wizard, then cycled through its statuses.
    let reqs = (await detail(lawyer1, id)).procedureRequests;
    expect(reqs).toMatchObject([{ text: "طلب إدخال طرف", status: "SUBMITTED", hearingId: h.id }]);
    await as(lawyer1, "POST", `/api/v1/cases/${id}/procedure-requests/${reqs[0].id}/cycle`);
    await as(lawyer1, "POST", `/api/v1/cases/${id}/procedure-requests`, {
      stageIndex: 1,
      party: "OPPONENT",
      text: "طلب الخصم",
    });
    reqs = (await detail(lawyer1, id)).procedureRequests;
    expect(reqs.map((r: { status: string }) => r.status)).toEqual(["PENDING", "SUBMITTED"]);
    expect(reqs[0].log[0].message).toEqual({
      messageKey: "event.procedureRequestStatusChanged",
      params: { type: "طلب إدخال طرف", status: "@procedureRequestStatus.PENDING" },
    });
    // Deleting a request needs the delete level (lawyers have edit).
    expect(
      (await as(lawyer1, "DELETE", `/api/v1/cases/${id}/procedure-requests/${reqs[0].id}`))
        .statusCode,
    ).toBe(403);
    expect(
      (await as(partner, "DELETE", `/api/v1/cases/${id}/procedure-requests/${reqs[0].id}`))
        .statusCode,
    ).toBe(200);
    expect((await detail(lawyer1, id)).procedureRequests).toHaveLength(1);
  });

  it("keeps one recurring reminder while a hearing is pending", async () => {
    const id = await newCase(lawyer1, "جلسة معلقة");
    await as(lawyer1, "POST", `/api/v1/cases/${id}/hearings`, {
      hearingDate: "2026-06-01",
      isPending: true,
      pendingItems: ["minutes", "nextHearing"],
      reminderRecurDays: 3,
    });
    let c = await detail(lawyer1, id);
    const h = c.hearings[0];
    expect(h.actions.reminders).toHaveLength(1);
    expect(h.actions.reminders[0].text).toBe("إكمال الجلسة ١: ضبط الجلسة، تاريخ الجلسة القادمة");
    expect(keys(c)).toContain("event.hearingSavedPending");
    await as(lawyer1, "PATCH", `/api/v1/cases/${id}/hearings/${h.id}`, { reminderRecurDays: 5 });
    c = await detail(lawyer1, id);
    expect(c.hearings[0].actions.reminders).toHaveLength(1); // replaced, not added
    await as(lawyer1, "PATCH", `/api/v1/cases/${id}/hearings/${h.id}`, { isPending: false });
    c = await detail(lawyer1, id);
    expect(c.hearings[0]).toMatchObject({ isPending: false, pendingItems: [] });
    expect(c.hearings[0].actions.reminders).toHaveLength(0);
  });

  it("routes the client report through approval; only the full level decides", async () => {
    const id = await newCase(lawyer1, "تقرير العميل");
    await as(lawyer1, "POST", `/api/v1/cases/${id}/hearings`, { hearingDate: "2026-05-01" });
    let h = (await detail(lawyer1, id)).hearings[0];
    const base = `/api/v1/cases/${id}/hearings/${h.id}`;
    expect((await as(lawyer1, "POST", `${base}/report/request`)).json().error.messageKey).toBe(
      "errors.HEARING_HAS_NO_REPORT",
    );
    await as(lawyer1, "PATCH", base, { clientReport: "تم تأجيل الجلسة للاطلاع" });
    expect(
      (await as(partner, "POST", `${base}/report/decide`, { approve: true })).json().error
        .messageKey,
    ).toBe("errors.REPORT_APPROVAL_NOT_REQUESTED");
    await as(lawyer1, "POST", `${base}/report/request`);
    expect((await as(lawyer1, "POST", `${base}/report/decide`, { approve: true })).statusCode).toBe(
      403,
    );
    expect((await as(partner, "POST", `${base}/report/decide`, { approve: true })).statusCode).toBe(
      200,
    );
    h = (await detail(lawyer1, id)).hearings[0];
    expect(h).toMatchObject({
      reportApproved: true,
      reportApprovalRequested: false,
      reportSentToClient: false,
    });
    expect((await as(lawyer1, "POST", `${base}/report/request`)).json().error.messageKey).toBe(
      "errors.REPORT_ALREADY_APPROVED",
    );
    expect(keys(await detail(lawyer1, id))).toEqual(
      expect.arrayContaining([
        "event.hearingReportApprovalRequested",
        "event.hearingReportApproved",
      ]),
    );
  });

  it("applies the case row scope to hearings and to the tasks board", async () => {
    const id = await newCase(lawyer1, "سرية");
    await as(lawyer1, "PUT", `/api/v1/cases/${id}/hearings/next`, { date: "2026-11-20" });
    expect(
      (await as(lawyer2, "POST", `/api/v1/cases/${id}/hearings`, { hearingDate: "2026-11-20" }))
        .statusCode,
    ).toBe(404);
    expect((await board(lawyer2)).some((t) => t.caseId === id)).toBe(false);
    expect((await board(partner)).some((t) => t.caseId === id)).toBe(true);
  });

  it("runs the tasks board: create, move (done stamps completion), delete needs full", async () => {
    const created = await as(lawyer2, "POST", "/api/v1/tasks", {
      title: "مهمة عامة",
      priority: "URGENT",
    });
    expect(created.statusCode).toBe(201);
    const tid = created.json().data.id as string;
    expect(
      (await as(lawyer2, "PUT", `/api/v1/tasks/${tid}/status`, { status: "DONE" })).statusCode,
    ).toBe(200);
    expect((await board(lawyer2)).find((t) => t.id === tid)?.status).toBe("DONE");
    expect((await as(lawyer2, "DELETE", `/api/v1/tasks/${tid}`)).statusCode).toBe(403);
    expect((await as(partner, "DELETE", `/api/v1/tasks/${tid}`)).statusCode).toBe(200);
    expect((await board(partner)).some((t) => t.id === tid)).toBe(false);
    const hidden = await as(lawyer2, "POST", "/api/v1/tasks", {
      title: "x",
      caseId: await newCase(lawyer1, "y"),
    });
    expect(hidden.statusCode).toBe(400);
  });
});

describe("office overview: deadlines, alerts, notifications, search, today, reports", () => {
  const WEB = { origin: "http://localhost:3000" };
  let partner = "";
  let lawyer1 = "";
  let lawyer2 = "";
  let reception = "";
  let mine = "";
  let other = "";
  const as = (
    cookie: string,
    method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE",
    url: string,
    payload?: object,
  ) => app.inject({ method, url, headers: { cookie, ...WEB }, ...(payload ? { payload } : {}) });
  const get = async (cookie: string, url: string) => (await as(cookie, "GET", url)).json().data;
  /** A calendar date n days from today (Riyadh), as a date input sends it. */
  const day = (n: number) => dateInDays(n).toISOString().slice(0, 10);

  beforeAll(async () => {
    partner = cookieOf(await login(PARTNER_I));
    lawyer1 = cookieOf(await login(LAWYER_I1));
    lawyer2 = cookieOf(await login(LAWYER_I2));
    reception = cookieOf(await login(RECEPTION_I));
    await as(partner, "POST", "/api/v1/clients", {
      name: "شركة 100% للتجارة",
      phone: "0555123456",
    });
    mine = (
      await as(lawyer1, "POST", "/api/v1/cases", { number: "1447/50", title: "قضية الموعد" })
    ).json().data.id;
    other = (
      await as(lawyer2, "POST", "/api/v1/cases", { number: "1447/51", title: "قضية زميل" })
    ).json().data.id;
    await as(lawyer1, "PUT", `/api/v1/cases/${mine}/hearings/next`, { date: day(3) });
    await as(lawyer2, "PUT", `/api/v1/cases/${other}/hearings/next`, { date: day(1) });
  });

  it("books, lists and cancels appointments; a foreign client is refused", async () => {
    const created = await as(reception, "POST", "/api/v1/appointments", {
      contactName: "خالد",
      scheduledOn: day(2),
      scheduledTime: "10:30",
      type: "FOLLOW_UP",
    });
    expect(created.statusCode).toBe(201);
    const bad = await as(reception, "POST", "/api/v1/appointments", {
      contactName: "x",
      scheduledOn: day(2),
      clientId: OFFICE_A,
    });
    expect(bad.json().error.details[0].path).toBe("clientId");
    expect(
      (
        await as(reception, "POST", "/api/v1/appointments", {
          contactName: "x",
          scheduledOn: day(2),
          scheduledTime: "25:00",
        })
      ).statusCode,
    ).toBe(400);
    let list = (await get(reception, "/api/v1/appointments")) as Array<{
      id: string;
      scheduledTime: string;
    }>;
    expect(list).toHaveLength(1);
    expect(list[0]!.scheduledTime).toBe("10:30");
    await as(reception, "POST", `/api/v1/appointments/${created.json().data.id}/cancel`);
    list = await get(reception, "/api/v1/appointments");
    expect(list).toHaveLength(0);
    expect(
      (await as(lawyer1, "POST", "/api/v1/appointments", { contactName: "y", scheduledOn: day(5) }))
        .statusCode,
    ).toBe(201);
  });

  it("lists deadlines inside the row scope, soonest first", async () => {
    await as(lawyer1, "POST", `/api/v1/cases/${mine}/hearings`, {
      hearingDate: day(-28),
      kind: "JUDGMENT_PRONOUNCEMENT",
    }); // objection due in 2 days; this also retires the upcoming hearing
    await as(lawyer1, "PUT", `/api/v1/cases/${mine}/hearings/next`, { date: day(3) });
    const h = (await get(lawyer1, `/api/v1/cases/${mine}`)).hearings[0];
    await as(lawyer1, "POST", `/api/v1/cases/${mine}/hearings/${h.id}/reminders`, {
      text: "إحضار الأصل",
      dueOn: day(-1),
    });

    const items = (await get(lawyer1, "/api/v1/deadlines")) as Array<{
      kind: string;
      caseId: string;
      daysLeft: number;
      urgency: string;
      label: string | null;
    }>;
    expect(items.map((d) => d.kind)).toEqual(["reminder", "objection", "nextHearing"]);
    expect(items[0]).toMatchObject({ daysLeft: -1, urgency: "overdue", label: "إحضار الأصل" });
    expect(items.every((d) => d.caseId === mine)).toBe(true);
    const all = (await get(partner, "/api/v1/deadlines")) as Array<{ caseId: string }>;
    expect(all.some((d) => d.caseId === other)).toBe(true);
    expect((await as(lawyer1, "GET", "/api/v1/deadlines")).statusCode).toBe(200);
  });

  it("raises tiered alerts from the caller's own cases only", async () => {
    const alerts = (await get(lawyer1, "/api/v1/alerts")) as Array<{
      tier: string;
      message: { messageKey: string; params: { title: string } };
    }>;
    expect(alerts[0]!.tier).toBe("critical");
    expect(alerts.map((a) => a.message.messageKey)).toEqual(
      expect.arrayContaining(["alerts.deadlineOverdue", "alerts.deadlineSoon"]),
    );
    expect(alerts.every((a) => a.message.params.title === "قضية الموعد")).toBe(true);
    const tiers = alerts.map((a) => a.tier);
    expect(
      [...tiers].sort(
        (a, b) =>
          ["critical", "important", "info"].indexOf(a) -
          ["critical", "important", "info"].indexOf(b),
      ),
    ).toEqual(tiers);
    const bare = (
      await as(partner, "POST", "/api/v1/cases", { number: "1447/52", title: "ملف جديد" })
    ).json().data.id;
    const empty = (await get(partner, "/api/v1/alerts")) as Array<{ id: string; tier: string }>;
    expect(empty.find((a) => a.id === `empty:${bare}`)?.tier).toBe("info");
    expect(empty.some((a) => a.id === `empty:${other}`)).toBe(false); // it has an upcoming hearing
  });

  it("notifies of hearings within a week and newly assigned tasks", async () => {
    const users = (await get(partner, "/api/v1/cases/assignable-users")) as Array<{
      id: string;
      name: string;
    }>;
    const l1 = users.find((u) => u.name === `user ${LAWYER_I1}`)!;
    await as(partner, "POST", "/api/v1/tasks", { title: "راجع العقد", assigneeId: l1.id });
    const feed = (await get(lawyer1, "/api/v1/notifications")) as Array<{
      message: { messageKey: string };
    }>;
    expect(feed.map((n) => n.message.messageKey)).toEqual(
      expect.arrayContaining(["notif.hearingSoon", "notif.taskAssigned"]),
    );
    expect((await get(lawyer1, "/api/v1/notifications/count")).count).toBe(feed.length);
    // Reception has no tasks module: no task items, and no error.
    const rec = (await get(reception, "/api/v1/notifications")) as Array<{
      message: { messageKey: string };
    }>;
    expect(rec.some((n) => n.message.messageKey === "notif.taskAssigned")).toBe(false);
  });

  it("searches each category within module and row scope, taking % literally", async () => {
    const r1 = await get(lawyer1, `/api/v1/search?q=${encodeURIComponent("قضية")}`);
    expect(r1.cases.map((c: { id: string }) => c.id)).toEqual([mine]);
    const r2 = await get(partner, `/api/v1/search?q=${encodeURIComponent("قضية")}`);
    expect(r2.cases).toHaveLength(2);
    const pct = await get(partner, `/api/v1/search?q=${encodeURIComponent("100%")}`);
    expect(pct.clients.map((c: { label: string }) => c.label)).toEqual(["شركة 100% للتجارة"]);
    expect(
      (await get(partner, `/api/v1/search?q=${encodeURIComponent("0%")}`)).clients,
    ).toHaveLength(1);
    expect(
      (await get(partner, `/api/v1/search?q=${encodeURIComponent("%%")}`)).clients,
    ).toHaveLength(0);
    const byPhone = await get(reception, "/api/v1/search?q=555123");
    expect(byPhone.clients).toHaveLength(1);
    expect(byPhone.cases).toEqual([]); // reception has no cases module
    expect((await as(partner, "GET", "/api/v1/search?q=a")).statusCode).toBe(400);
  });

  it("shapes today by module: reception sees dates, not tasks or win rate", async () => {
    const lw = await get(lawyer1, "/api/v1/today");
    expect(lw.hearings).toMatchObject({ visible: true, totalWithin7: 1 });
    expect(lw.deadlines.items.map((d: { kind: string }) => d.kind)).toEqual([
      "reminder",
      "objection",
    ]);
    expect(lw.tasks.visible).toBe(true);
    expect(lw.tasks.items[0]).toMatchObject({ urgent: true }); // the objection task comes first
    expect(lw.winRate.visible).toBe(true);
    const rc = await get(reception, "/api/v1/today");
    expect(rc).toMatchObject({ tasks: { visible: false, items: [] }, winRate: { visible: false } });
    expect(rc.hearings.items.length).toBe(2); // reception's case scope is ALL
  });

  it("serves dashboard, journey and activity to report viewers only", async () => {
    expect((await as(reception, "GET", "/api/v1/dashboard")).statusCode).toBe(403);
    expect((await as(reception, "GET", "/api/v1/activity")).statusCode).toBe(403);
    const dash = await get(lawyer1, "/api/v1/dashboard");
    expect(dash).toMatchObject({ activeCases: 3, clients: 1 });
    expect(dash.criticalAlerts).toBeGreaterThanOrEqual(2);

    await as(partner, "POST", "/api/v1/leads", { name: "مؤسسة الفجر" });
    const lead = (
      (await get(partner, "/api/v1/leads")) as Array<{ id: string; name: string }>
    ).find((l) => l.name === "مؤسسة الفجر")!;
    for (let i = 0; i < 3; i++)
      await as(partner, "POST", `/api/v1/leads/${lead.id}/move`, { direction: 1 });
    await as(partner, "POST", `/api/v1/leads/${lead.id}/convert`);
    const j = await get(partner, "/api/v1/journey");
    expect(j).toMatchObject({
      contracted: 1,
      firstContact: 1,
      inPipeline: 0,
      appointments: 2,
      followUps: 1,
      activeCases: 4,
    });

    const feed = await get(partner, "/api/v1/activity?type=case");
    expect(feed.rows.length).toBeGreaterThan(0);
    expect(feed.rows.every((r: { category: string }) => r.category === "case")).toBe(true);
    expect(feed.counts.client).toBeGreaterThan(0);
    const users = (await get(partner, "/api/v1/cases/assignable-users")) as Array<{
      id: string;
      name: string;
    }>;
    const rid = users.find((u) => u.name === `user ${RECEPTION_I}`)!.id;
    const byRec = await get(partner, `/api/v1/activity?actor=${rid}`);
    expect(
      byRec.rows.every((r: { actorName: string }) => r.actorName === `user ${RECEPTION_I}`),
    ).toBe(true);
    expect(byRec.rows.map((r: { action: string }) => r.action)).toContain("appointment.cancel");
  });
});

describe("case work: approvals, contracts, contact log, chat, client approvals, execution", () => {
  const WEB = { origin: "http://localhost:3000" };
  let partner = "";
  let lawyer1 = "";
  let lawyer2 = "";
  let id = "";
  const as = (
    cookie: string,
    method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE",
    url: string,
    payload?: object,
  ) => app.inject({ method, url, headers: { cookie, ...WEB }, ...(payload ? { payload } : {}) });
  const get = async (cookie: string, url: string) => (await as(cookie, "GET", url)).json().data;
  const base = () => `/api/v1/cases/${id}`;
  const keys = async () =>
    ((await get(lawyer1, base())).events as Array<{ message: { messageKey: string } | null }>).map(
      (e) => e.message?.messageKey,
    );

  beforeAll(async () => {
    partner = cookieOf(await login(PARTNER_J));
    lawyer1 = cookieOf(await login(LAWYER_J1));
    lawyer2 = cookieOf(await login(LAWYER_J2));
    id = (
      await as(lawyer1, "POST", "/api/v1/cases", { number: "1447/60", title: "ملف التنفيذ" })
    ).json().data.id;
  });

  it("walks the review pipeline; only the full level gives the partner approval", async () => {
    await as(lawyer1, "POST", `${base()}/hearings`, {
      hearingDate: "2026-05-01",
      clientReport: "تقرير",
    });
    const h = (await get(lawyer1, base())).hearings[0];
    await as(lawyer1, "POST", `${base()}/hearings/${h.id}/report/request`);
    const aid = (
      await as(lawyer1, "POST", `${base()}/approvals`, { title: "مذكرة الرد", hearingId: h.id })
    ).json().data.id;
    for (let i = 0; i < 4; i++) await as(lawyer1, "POST", `${base()}/approvals/${aid}/advance`);
    let list = await get(lawyer1, `${base()}/approvals`);
    expect(list[0].stage).toBe("PARTNER");

    const today = await get(lawyer1, "/api/v1/today");
    expect(today.approvals.items.map((a: { id: string }) => a.id)).toContain(aid);
    expect((await get(lawyer2, "/api/v1/today")).approvals.items).toEqual([]); // out of scope
    const notif = await get(lawyer1, "/api/v1/notifications");
    expect(notif.some((n: { id: string }) => n.id === `approval:${aid}`)).toBe(true);

    const denied = await as(lawyer1, "POST", `${base()}/approvals/${aid}/advance`);
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.messageKey).toBe("errors.APPROVAL_NEEDS_PARTNER");
    expect((await as(partner, "POST", `${base()}/approvals/${aid}/advance`)).statusCode).toBe(200);
    list = await get(lawyer1, `${base()}/approvals`);
    expect(list[0].stage).toBe("APPROVED");
    expect(list[0].log[0].message).toEqual({
      messageKey: "event.approvalAdvanced",
      params: { title: "مذكرة الرد", stage: "@approvalStage.APPROVED" },
    });
    expect((await get(lawyer1, base())).hearings[0]).toMatchObject({
      reportApproved: true,
      reportApprovalRequested: false,
    });

    await as(lawyer1, "POST", `${base()}/approvals/${aid}/reject`, { note: "إعادة صياغة" });
    list = await get(lawyer1, `${base()}/approvals`);
    expect(list[0].stage).toBe("DRAFT");
    expect(list[0].log[0].message.messageKey).toBe("event.approvalRejectedWithNote");
    expect((await as(lawyer1, "DELETE", `${base()}/approvals/${aid}`)).statusCode).toBe(403);
    expect((await as(partner, "DELETE", `${base()}/approvals/${aid}`)).statusCode).toBe(200);
    expect(await get(lawyer1, `${base()}/approvals`)).toEqual([]);
    expect((await as(lawyer2, "GET", `${base()}/approvals`)).statusCode).toBe(404);
  });

  it("tracks contracts, the contact log, chat and client approval requests", async () => {
    const cid = (await as(lawyer1, "POST", `${base()}/contracts`, { title: "عقد الأتعاب" })).json()
      .data.id;
    await as(lawyer1, "POST", `${base()}/contracts/${cid}/toggle`);
    let contracts = await get(lawyer1, `${base()}/contracts`);
    expect(contracts[0]).toMatchObject({ title: "عقد الأتعاب", isSigned: true });
    expect(contracts[0].signedAt).not.toBeNull();
    await as(lawyer1, "POST", `${base()}/contracts/${cid}/toggle`);
    contracts = await get(lawyer1, `${base()}/contracts`);
    expect(contracts[0]).toMatchObject({ isSigned: false, signedAt: null });
    await as(lawyer1, "DELETE", `${base()}/contracts/${cid}`);
    expect(await get(lawyer1, `${base()}/contracts`)).toEqual([]);

    await as(lawyer1, "POST", `${base()}/communications`, { type: "CALL", note: "اتصال بالموكل" });
    const comms = await get(lawyer1, `${base()}/communications`);
    expect(comms[0]).toMatchObject({
      type: "CALL",
      note: "اتصال بالموكل",
      authorName: `user ${LAWYER_J1}`,
    });
    await as(lawyer1, "DELETE", `${base()}/communications/${comms[0].id}`);
    expect(await get(lawyer1, `${base()}/communications`)).toEqual([]);

    await as(lawyer1, "POST", `${base()}/messages`, { body: "مرحباً" });
    expect(await get(lawyer1, `${base()}/messages`)).toMatchObject([
      { senderType: "STAFF", senderName: `user ${LAWYER_J1}`, body: "مرحباً" },
    ]);
    expect((await as(lawyer1, "POST", `${base()}/messages`, { body: "  " })).statusCode).toBe(400);

    await as(lawyer1, "POST", `${base()}/client-approvals`, {
      title: "مذكرة",
      kind: "MEMO",
      amount: 5000,
    });
    await as(lawyer1, "POST", `${base()}/client-approvals`, {
      title: "عرض أتعاب",
      kind: "FEE",
      amount: 500000,
    });
    const reqs = await get(lawyer1, `${base()}/client-approvals`);
    expect(
      reqs.map((r: { kind: string; amount: number | null; status: string }) => [
        r.kind,
        r.amount,
        r.status,
      ]),
    ).toEqual([
      ["FEE", 500000, "PENDING"],
      ["MEMO", null, "PENDING"],
    ]);
    expect(await keys()).toEqual(
      expect.arrayContaining([
        "event.contractAdded",
        "event.contractSigned",
        "event.contractUnsigned",
        "event.contractDeleted",
        "event.communicationAdded",
        "event.clientApprovalCreated",
      ]),
    );
  });

  it("runs an execution file: one per case, collections move the status, follow-ups make reminders", async () => {
    expect((await get(lawyer1, `${base()}/execution`)).execution).toBeNull();
    expect(
      (await as(lawyer1, "POST", `${base()}/execution/collections`, { amount: 1 })).json().error
        .messageKey,
    ).toBe("errors.EXECUTION_NOT_OPEN");
    await as(lawyer1, "POST", `${base()}/execution`, {
      court: "محكمة التنفيذ",
      amount: 100000,
      debtor: "شركة المدين",
    });
    const again = await as(lawyer1, "POST", `${base()}/execution`, {});
    expect(again.json().error.messageKey).toBe("errors.EXECUTION_ALREADY_OPEN");

    // Concurrent collections must not lose an amount.
    await Promise.all(
      [10000, 10000, 10000, 10000, 10000].map((amount) =>
        as(lawyer1, "POST", `${base()}/execution/collections`, { amount }),
      ),
    );
    let ex = (await get(lawyer1, `${base()}/execution`)).execution;
    expect(ex).toMatchObject({
      collected: 50000,
      status: "PARTIALLY_COLLECTED",
      court: "محكمة التنفيذ",
    });
    await as(lawyer1, "POST", `${base()}/execution/collections`, { amount: 50000 });
    expect((await get(lawyer1, `${base()}/execution`)).execution.status).toBe("FULLY_COLLECTED");
    await as(lawyer1, "PUT", `${base()}/execution/status`, { status: "STALLED" });
    await as(lawyer1, "POST", `${base()}/execution/collections`, { amount: 1 });
    expect((await get(lawyer1, `${base()}/execution`)).execution.status).toBe("STALLED");
    expect(
      (await as(lawyer1, "POST", `${base()}/execution/collections`, { amount: 0 })).statusCode,
    ).toBe(400);
    await as(lawyer1, "PATCH", `${base()}/execution`, {
      court: "دائرة التنفيذ الأولى",
      amount: 120000,
    });

    const users = (await get(lawyer1, "/api/v1/cases/assignable-users")) as Array<{
      id: string;
      name: string;
    }>;
    const l1 = users.find((u) => u.name === `user ${LAWYER_J1}`)!;
    const bad = await as(lawyer1, "POST", `${base()}/execution/procedures`, {
      type: "حجز حسابات بنكية",
      followUpDate: "2026-12-01",
      followUpAssigneeId: OFFICE_A,
    });
    expect(bad.json().error.details[0].path).toBe("followUpAssigneeId");
    const pid = (
      await as(lawyer1, "POST", `${base()}/execution/procedures`, {
        type: "حجز حسابات بنكية",
        party: "OURS",
        followUpDate: "2026-12-01",
        followUpAssigneeId: l1.id,
      })
    ).json().data.id;
    await as(lawyer1, "POST", `${base()}/execution/procedures/${pid}/cycle`);
    ex = (await get(lawyer1, `${base()}/execution`)).execution;
    expect(ex).toMatchObject({ court: "دائرة التنفيذ الأولى", amount: 120000 });
    expect(ex.procedures[0]).toMatchObject({
      type: "حجز حسابات بنكية",
      status: "IN_PROGRESS",
      followUpAssigneeName: `user ${LAWYER_J1}`,
    });
    const deadlines = (await get(lawyer1, "/api/v1/deadlines")) as Array<{
      kind: string;
      label: string | null;
    }>;
    expect(deadlines.some((d) => d.label === "متابعة إجراء تنفيذ: حجز حسابات بنكية")).toBe(true);
    const tasks = (await get(lawyer1, "/api/v1/tasks")) as Array<{ origin: string }>;
    expect(tasks.some((tk) => tk.origin === "AUTO_EXECUTION_FOLLOWUP")).toBe(true);
    expect(
      (await as(lawyer1, "POST", `${base()}/execution/procedures`, { type: "نوع غير معروف" }))
        .statusCode,
    ).toBe(400);

    expect((await as(lawyer1, "DELETE", `${base()}/execution/procedures/${pid}`)).statusCode).toBe(
      403,
    );
    await as(partner, "DELETE", `${base()}/execution/procedures/${pid}`);
    expect((await get(lawyer1, `${base()}/execution`)).execution.procedures).toEqual([]);
    const after = (await get(lawyer1, "/api/v1/deadlines")) as Array<{ label: string | null }>;
    expect(after.some((d) => d.label === "متابعة إجراء تنفيذ: حجز حسابات بنكية")).toBe(false);

    await as(lawyer1, "PUT", `${base()}/execution/status`, { status: "CLOSED" });
    expect(await keys()).toEqual(
      expect.arrayContaining([
        "event.executionOpened",
        "event.executionCollected",
        "event.executionClosed",
      ]),
    );
  });
});

describe("documents: upload, download, share, delete, recycle", () => {
  const WEB = { origin: "http://localhost:3000" };
  let partner = "";
  let lawyer1 = "";
  let lawyer2 = "";
  let reception = "";
  let id = "";
  const PDF = Buffer.from("%PDF-1.7\n1 0 obj << >> endobj\n%%EOF\n");
  const as = (cookie: string, method: "GET" | "POST" | "DELETE", url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie, ...WEB }, ...(payload ? { payload } : {}) });
  const upload = (cookie: string, query: Record<string, string>, body: Buffer, caseId = id) =>
    app.inject({
      method: "POST",
      url: `/api/v1/cases/${caseId}/documents?${new URLSearchParams(query)}`,
      headers: { cookie, ...WEB, "content-type": "application/octet-stream" },
      payload: body,
    });
  const list = async (cookie: string) =>
    (await as(cookie, "GET", `/api/v1/cases/${id}/documents`)).json().data;

  beforeAll(async () => {
    partner = cookieOf(await login(PARTNER_K));
    lawyer1 = cookieOf(await login(LAWYER_K1));
    lawyer2 = cookieOf(await login(LAWYER_K2));
    reception = cookieOf(await login(RECEPTION_K));
    id = (
      await as(lawyer1, "POST", "/api/v1/cases", { number: "1447/70", title: "قضية المستندات" })
    ).json().data.id;
  });

  it("stores an upload and streams it back to an authorized caller, audited", async () => {
    const res = await upload(
      lawyer1,
      {
        fileName: "صحيفة الدعوى.pdf",
        mimeType: "application/pdf",
        party: "OURS",
        docType: "صحيفة",
      },
      PDF,
    );
    expect(res.statusCode).toBe(201);
    const doc = res.json().data;
    expect(doc).toMatchObject({
      fileName: "صحيفة الدعوى.pdf",
      kind: "DOCUMENT",
      source: "UPLOAD",
      party: "OURS",
      sizeBytes: PDF.length,
    });

    const dl = await as(lawyer1, "GET", `/api/v1/documents/${doc.id}/download`);
    expect(dl.statusCode).toBe(200);
    expect(dl.headers["content-type"]).toContain("application/pdf");
    expect(String(dl.headers["content-disposition"])).toContain(
      `filename*=UTF-8''${encodeURIComponent("صحيفة الدعوى.pdf")}`,
    );
    expect(dl.rawPayload.equals(PDF)).toBe(true);

    expect((await as(lawyer2, "GET", `/api/v1/documents/${doc.id}/download`)).statusCode).toBe(404);
    expect((await as(lawyer2, "GET", `/api/v1/cases/${id}/documents`)).statusCode).toBe(404);
    expect((await as(reception, "GET", `/api/v1/documents/${doc.id}/download`)).statusCode).toBe(
      403,
    );

    const log = (await as(partner, "GET", "/api/v1/activity?type=other")).json().data
      .rows as Array<{ action: string }>;
    expect(log.map((r) => r.action)).toEqual(
      expect.arrayContaining(["document.upload", "document.download"]),
    );
    const c = (await as(lawyer1, "GET", `/api/v1/cases/${id}`)).json().data;
    expect(
      c.events.some(
        (e: { message: { messageKey: string } | null }) =>
          e.message?.messageKey === "event.docUploaded",
      ),
    ).toBe(true);
  });

  it("refuses wrong content, wrong types, empty and oversized files", async () => {
    const fake = await upload(
      lawyer1,
      { fileName: "x.pdf", mimeType: "application/pdf" },
      Buffer.from("MZ\x90\x00 not a pdf"),
    );
    expect(fake.json().error.messageKey).toBe("errors.UPLOAD_CONTENT_MISMATCH");
    expect(
      (await upload(lawyer1, { fileName: "x.exe", mimeType: "application/x-msdownload" }, PDF))
        .statusCode,
    ).toBe(400);
    const empty = await upload(
      lawyer1,
      { fileName: "x.pdf", mimeType: "application/pdf" },
      Buffer.alloc(0),
    );
    expect(empty.json().error.messageKey).toBe("errors.UPLOAD_EMPTY");
    const big = await upload(
      lawyer1,
      { fileName: "big.pdf", mimeType: "application/pdf" },
      Buffer.concat([PDF, Buffer.alloc(26 * 1024 * 1024)]),
    );
    expect(big.statusCode).toBe(413);
    expect(big.json().error).toMatchObject({
      code: "VALIDATION_FAILED",
      messageKey: "errors.UPLOAD_TOO_LARGE",
    });
    const foreign = await upload(
      lawyer1,
      { fileName: "x.pdf", mimeType: "application/pdf", hearingId: OFFICE_A },
      PDF,
    );
    expect(foreign.json().error.details[0].path).toBe("hearingId");
  });

  it("links attachments to a procedural request and a hearing", async () => {
    await as(lawyer1, "POST", `/api/v1/cases/${id}/procedure-requests`, {
      stageIndex: 1,
      party: "OURS",
      text: "طلب ندب خبير",
    });
    const req = (await as(lawyer1, "GET", `/api/v1/cases/${id}`)).json().data.procedureRequests[0];
    await upload(
      lawyer1,
      {
        fileName: "الطلب.pdf",
        mimeType: "application/pdf",
        source: "PROCEDURAL_REQUEST",
        procedureRequestId: req.id,
      },
      PDF,
    );
    await upload(
      lawyer1,
      {
        fileName: "النتيجة.pdf",
        mimeType: "application/pdf",
        source: "PROCEDURAL_REQUEST",
        procedureRequestId: req.id,
        procedureDocRole: "RESULT",
      },
      PDF,
    );
    await as(lawyer1, "POST", `/api/v1/cases/${id}/hearings`, { hearingDate: "2026-06-01" });
    const h = (await as(lawyer1, "GET", `/api/v1/cases/${id}`)).json().data.hearings[0];
    await upload(
      lawyer1,
      {
        fileName: "محضر.txt",
        mimeType: "text/plain",
        source: "HEARING",
        hearingId: h.id,
        sessionLabel: "جلسة ١",
      },
      Buffer.from("محضر الجلسة"),
    );
    const docs = (await list(lawyer1)) as Array<{
      fileName: string;
      procedureDocRole: string | null;
      hearingId: string | null;
      kind: string;
    }>;
    expect(docs.find((d) => d.fileName === "الطلب.pdf")?.procedureDocRole).toBe("REQUEST");
    expect(docs.find((d) => d.fileName === "النتيجة.pdf")?.procedureDocRole).toBe("RESULT");
    expect(docs.find((d) => d.fileName === "محضر.txt")).toMatchObject({
      hearingId: h.id,
      kind: "TEXT",
    });
  });

  it("shares, deletes into the recycle bin (full level), restores, and clears the opening package", async () => {
    const doc = (
      await upload(lawyer1, { fileName: "عقد.pdf", mimeType: "application/pdf" }, PDF)
    ).json().data;
    await as(lawyer1, "POST", `/api/v1/documents/${doc.id}/share`);
    expect(
      ((await list(lawyer1)) as Array<{ id: string; clientVisible: boolean }>).find(
        (d) => d.id === doc.id,
      )?.clientVisible,
    ).toBe(true);

    expect((await as(lawyer1, "DELETE", `/api/v1/documents/${doc.id}`)).statusCode).toBe(403);
    expect((await as(partner, "DELETE", `/api/v1/documents/${doc.id}`)).statusCode).toBe(200);
    expect(((await list(lawyer1)) as Array<{ id: string }>).some((d) => d.id === doc.id)).toBe(
      false,
    );
    const bin = (await as(partner, "GET", "/api/v1/recycle")).json().data as Array<{
      kind: string;
      id: string;
    }>;
    expect(bin.some((i) => i.kind === "document" && i.id === doc.id)).toBe(true);
    expect(
      ((await as(lawyer2, "GET", "/api/v1/recycle")).json().data as Array<{ id: string }>).some(
        (i) => i.id === doc.id,
      ),
    ).toBe(false);
    expect(
      (await as(partner, "POST", `/api/v1/recycle/document/${doc.id}/restore`)).statusCode,
    ).toBe(200);
    expect(((await list(lawyer1)) as Array<{ id: string }>).some((d) => d.id === doc.id)).toBe(
      true,
    );

    await upload(
      lawyer1,
      {
        fileName: "مستند افتتاحي ١.pdf",
        mimeType: "application/pdf",
        source: "OPENING",
        party: "OPPONENT",
      },
      PDF,
    );
    await upload(
      lawyer1,
      { fileName: "مستند افتتاحي ٢.png", mimeType: "image/png", source: "OPENING" },
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]),
    );
    const png = (
      (await list(lawyer1)) as Array<{ fileName: string; needsOcr: boolean; kind: string }>
    ).find((d) => d.fileName.endsWith(".png"));
    expect(png).toMatchObject({ needsOcr: true, kind: "IMAGE" });
    expect(
      (await as(partner, "POST", `/api/v1/cases/${id}/documents/clear-opening`)).json().data,
    ).toEqual({ count: 2 });
    expect(
      ((await list(lawyer1)) as Array<{ source: string }>).some((d) => d.source === "OPENING"),
    ).toBe(false);
  });

  it("finds documents in search and counts them in billing usage", async () => {
    const hits = (
      await as(lawyer1, "GET", `/api/v1/search?q=${encodeURIComponent("صحيفة")}`)
    ).json().data;
    expect(hits.documents.map((d: { label: string }) => d.label)).toContain("صحيفة الدعوى.pdf");
    expect(
      (await as(lawyer2, "GET", `/api/v1/search?q=${encodeURIComponent("صحيفة")}`)).json().data
        .documents,
    ).toEqual([]);
    const usage = (await as(partner, "GET", "/api/v1/billing/usage")).json().data;
    expect(usage).toMatchObject({ cases: 1 });
    expect(usage.documents).toBe(((await list(lawyer1)) as unknown[]).length);
  });
});

describe("generated documents: templates, letterhead PDFs, hearing reports", () => {
  const WEB = { origin: "http://localhost:3000" };
  let partner = "";
  let lawyer1 = "";
  let lawyer2 = "";
  let assistant = "";
  let id = "";
  const as = (cookie: string, method: "GET" | "POST" | "PATCH", url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie, ...WEB }, ...(payload ? { payload } : {}) });
  const docs = async () =>
    (await as(lawyer1, "GET", `/api/v1/cases/${id}/documents`)).json().data as Array<{
      id: string;
      source: string;
    }>;

  beforeAll(async () => {
    partner = cookieOf(await login(PARTNER_L));
    lawyer1 = cookieOf(await login(LAWYER_L1));
    lawyer2 = cookieOf(await login(LAWYER_L2));
    assistant = cookieOf(await login(ASSISTANT_L));
    const client = (
      await as(partner, "POST", "/api/v1/clients", { name: "شركة الإمداد", city: "الرياض" })
    ).json().data;
    id = (
      await as(lawyer1, "POST", "/api/v1/cases", {
        number: "1447/80",
        title: "قضية القوالب",
        clientId: client.id,
        opposingParty: "مؤسسة الصقر",
        city: "الرياض",
      })
    ).json().data.id;
    const users = (await as(lawyer1, "GET", "/api/v1/cases/assignable-users")).json()
      .data as Array<{ id: string; name: string }>;
    await as(lawyer1, "POST", `/api/v1/cases/${id}/assignees`, {
      userId: users.find((u) => u.name === `user ${ASSISTANT_L}`)!.id,
    });
  });

  it("lists the system templates and prefills the form from the case", async () => {
    const list = (await as(lawyer1, "GET", "/api/v1/documents/templates")).json().data as Array<{
      key: string;
    }>;
    expect(list.map((x) => x.key)).toEqual(
      expect.arrayContaining(["claim", "engage", "poa", "warn"]),
    );
    const form = (
      await as(lawyer1, "GET", `/api/v1/documents/templates/claim/form?caseId=${id}`)
    ).json().data;
    expect(form).toMatchObject({ caseId: id, caseTitle: "قضية القوالب" });
    expect(form.values).toMatchObject({
      plaintiff: "شركة الإمداد",
      defendant: "مؤسسة الصقر",
      court: "المحكمة المختصة بمدينة الرياض",
    });
    expect(
      (await as(lawyer2, "GET", `/api/v1/documents/templates/claim/form?caseId=${id}`)).statusCode,
    ).toBe(404);
    expect(
      (await as(lawyer1, "GET", "/api/v1/documents/templates/nope/form")).json().error.messageKey,
    ).toBe("errors.TEMPLATE_NOT_FOUND");
  });

  it("generates an escaped letterhead PDF into the case and serves it", async () => {
    pdfStub.html.length = 0;
    const res = await as(lawyer1, "POST", "/api/v1/documents/generate", {
      templateKey: "claim",
      caseId: id,
      values: { amount: "50000", facts: "وقائع <script>alert(1)</script>" },
    });
    expect(res.statusCode).toBe(201);
    const doc = res.json().data;
    expect(doc).toMatchObject({
      source: "TEMPLATE",
      kind: "LETTER",
      templateKey: "claim",
      mimeType: "application/pdf",
    });
    const html = pdfStub.html[0]!;
    expect(html).toContain("شركة الإمداد");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("التاريخ:");
    const dl = await as(lawyer1, "GET", `/api/v1/documents/${doc.id}/download`);
    expect(dl.rawPayload.equals(STUB_PDF)).toBe(true);
    const c = (await as(lawyer1, "GET", `/api/v1/cases/${id}`)).json().data;
    expect(
      c.events.some(
        (e: { message: { messageKey: string } | null }) =>
          e.message?.messageKey === "event.docGenerated",
      ),
    ).toBe(true);
  });

  it("drops fee fields for a role denied the fees field, even when submitted", async () => {
    const form = (
      await as(assistant, "GET", `/api/v1/documents/templates/engage/form?caseId=${id}`)
    ).json().data;
    expect(form.fields.some((f: { id: string }) => f.id === "feeValue")).toBe(false);
    pdfStub.html.length = 0;
    await as(assistant, "POST", "/api/v1/documents/generate", {
      templateKey: "engage",
      caseId: id,
      values: { feeValue: "٢٥٪ سرّي" },
    });
    expect(pdfStub.html[0]).not.toContain("٢٥٪ سرّي");
    pdfStub.html.length = 0;
    await as(lawyer1, "POST", "/api/v1/documents/generate", {
      templateKey: "engage",
      caseId: id,
      values: { feeValue: "٢٥٪" },
    });
    expect(pdfStub.html[0]).toContain("٢٥٪");
  });

  it("generates outside a case, and says unavailable (with no document) when the PDF service fails", async () => {
    const free = (
      await as(lawyer1, "POST", "/api/v1/documents/generate", { templateKey: "warn", values: {} })
    ).json().data;
    expect(free.id).toBeDefined();
    expect((await as(lawyer1, "GET", `/api/v1/documents/${free.id}/download`)).statusCode).toBe(
      200,
    );

    const before = (await docs()).length;
    pdfStub.fail = true;
    const res = await as(lawyer1, "POST", "/api/v1/documents/generate", {
      templateKey: "claim",
      caseId: id,
      values: {},
    });
    pdfStub.fail = false;
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toMatchObject({
      code: "UNAVAILABLE",
      messageKey: "errors.PDF_UNAVAILABLE",
    });
    expect((await docs()).length).toBe(before);
  });

  it("renders a hearing's client report on the letterhead as a hearing document", async () => {
    await as(lawyer1, "POST", `/api/v1/cases/${id}/hearings`, { hearingDate: "2026-06-01" });
    const h = (await as(lawyer1, "GET", `/api/v1/cases/${id}`)).json().data.hearings[0];
    const none = await as(lawyer1, "POST", `/api/v1/cases/${id}/hearings/${h.id}/report-pdf`);
    expect(none.json().error.messageKey).toBe("errors.HEARING_HAS_NO_REPORT");
    await as(lawyer1, "PATCH", `/api/v1/cases/${id}/hearings/${h.id}`, {
      clientReport: "تأجيلت الجلسة\nللاطلاع على المذكرة",
    });
    pdfStub.html.length = 0;
    const doc = (
      await as(lawyer1, "POST", `/api/v1/cases/${id}/hearings/${h.id}/report-pdf`)
    ).json().data;
    expect(doc).toMatchObject({ source: "HEARING", hearingId: h.id, kind: "LETTER" });
    expect(pdfStub.html[0]).toContain("تأجيلت الجلسة<br/>للاطلاع على المذكرة");
    expect(
      (await as(lawyer2, "POST", `/api/v1/cases/${id}/hearings/${h.id}/report-pdf`)).statusCode,
    ).toBe(404);
  });
});

describe("finance: invoices, VAT, payments, credit notes, fees, time, trust, periods", () => {
  const WEB = { origin: "http://localhost:3000" };
  let partner = "";
  let accountant = "";
  let lawyer = "";
  let clientA = "";
  let clientB = "";
  let caseA = "";
  let lawyerId = "";
  const as = (cookie: string, method: "GET" | "POST" | "PUT", url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie, ...WEB }, ...(payload ? { payload } : {}) });
  const get = async (url: string, cookie = accountant) =>
    (await as(cookie, "GET", url)).json().data;
  const invoice = (body: object) =>
    as(accountant, "POST", "/api/v1/finance/invoices", { clientId: clientA, ...body });
  const one = (unitPrice: number) =>
    invoice({ items: [{ description: "أتعاب", quantity: 1, unitPrice }] });

  beforeAll(async () => {
    partner = cookieOf(await login(PARTNER_M));
    accountant = cookieOf(await login(ACCOUNTANT_M));
    lawyer = cookieOf(await login(LAWYER_M));
    clientA = (await as(partner, "POST", "/api/v1/clients", { name: "شركة المالية أ" })).json().data
      .id;
    clientB = (await as(partner, "POST", "/api/v1/clients", { name: "شركة المالية ب" })).json().data
      .id;
    caseA = (
      await as(partner, "POST", "/api/v1/cases", {
        number: "1447/90",
        title: "قضية الأتعاب",
        clientId: clientA,
      })
    ).json().data.id;
    lawyerId = (
      (await get("/api/v1/cases/assignable-users", partner)) as Array<{ id: string; name: string }>
    ).find((u) => u.name === `user ${LAWYER_M}`)!.id;
  });

  it("keeps finance away from roles without the module", async () => {
    expect((await as(lawyer, "GET", "/api/v1/finance/invoices")).statusCode).toBe(403);
    expect((await as(lawyer, "GET", `/api/v1/cases/${caseA}/fee-agreement`)).statusCode).toBe(403);
  });

  it("issues numbered invoices with 15% VAT and a balanced journal entry", async () => {
    const res = await invoice({
      caseId: caseA,
      items: [
        { description: "مرافعة", quantity: 2, unitPrice: 333_33 },
        { description: "استشارة", quantity: 1, unitPrice: 100_01 },
      ],
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.number).toBe("INV-1043");
    const d = await get(`/api/v1/finance/invoices/${res.json().data.id}`);
    expect(d).toMatchObject({
      net: 766_67,
      vat: 115_00,
      total: 881_67,
      status: "DUE",
      paid: 0,
      origin: "MANUAL",
      caseTitle: "قضية الأتعاب",
    });
    expect(d.items).toHaveLength(2);
    expect((await one(1000_00)).json().data.number).toBe("INV-1044");

    const journal = (await get("/api/v1/finance/journal")) as Array<{
      description: { messageKey: string; params: { number: string } };
      lines: Array<{ code: string; debit: number; credit: number }>;
    }>;
    const entry = journal.find((j) => j.description.params.number === "INV-1043")!;
    expect(entry.description.messageKey).toBe("journal.invoice");
    expect(entry.lines).toEqual([
      { code: "1100", name: "الذمم المدينة", debit: 881_67, credit: 0 },
      { code: "4000", name: "إيرادات الأتعاب", debit: 0, credit: 766_67 },
      { code: "2200", name: "ضريبة القيمة المضافة المستحقة", debit: 0, credit: 115_00 },
    ]);
    const mismatch = await as(accountant, "POST", "/api/v1/finance/invoices", {
      clientId: clientB,
      caseId: caseA,
      items: [{ description: "x", unitPrice: 100 }],
    });
    expect(mismatch.json().error.messageKey).toBe("errors.CASE_CLIENT_MISMATCH");
  });

  it("takes payments up to the remaining amount, even when two arrive at once", async () => {
    const id = (await one(1000_00)).json().data.id; // total 1150.00
    const both = await Promise.all([
      as(accountant, "POST", `/api/v1/finance/invoices/${id}/payments`, {
        amount: 700_00,
        method: "BANK_TRANSFER",
      }),
      as(accountant, "POST", `/api/v1/finance/invoices/${id}/payments`, {
        amount: 700_00,
        method: "CASH",
      }),
    ]);
    expect(both.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(both.find((r) => r.statusCode === 409)!.json().error.messageKey).toBe(
      "errors.PAYMENT_EXCEEDS_REMAINING",
    );
    let d = await get(`/api/v1/finance/invoices/${id}`);
    expect(d).toMatchObject({ paid: 700_00, remaining: 450_00, status: "PARTIALLY_PAID" });
    await as(accountant, "POST", `/api/v1/finance/invoices/${id}/payments`, {
      amount: 450_00,
      method: "MADA",
      reference: "TX-1",
    });
    d = await get(`/api/v1/finance/invoices/${id}`);
    expect(d).toMatchObject({ remaining: 0, status: "PAID" });
    expect(d.payments.map((x: { number: string }) => x.number)).toEqual(["REC-1001", "REC-1002"]);
    const cn = await as(partner, "POST", `/api/v1/finance/invoices/${id}/credit-note`, {});
    expect(cn.json().error.messageKey).toBe("errors.INVOICE_HAS_PAYMENTS");
  });

  it("cancels by credit note (full level) and writes off bad debt without reversing VAT", async () => {
    const id = (await one(200_00)).json().data.id;
    expect(
      (await as(lawyer, "POST", `/api/v1/finance/invoices/${id}/credit-note`, {})).statusCode,
    ).toBe(403);
    const cn = await as(partner, "POST", `/api/v1/finance/invoices/${id}/credit-note`, {
      reason: "خطأ في الفاتورة",
    });
    expect(cn.json().data.number).toBe("CN-2001");
    expect(await get(`/api/v1/finance/invoices/${id}`)).toMatchObject({
      status: "CANCELLED",
      creditNote: { number: "CN-2001", amount: 230_00, reason: "خطأ في الفاتورة" },
    });
    expect(
      (await as(partner, "POST", `/api/v1/finance/invoices/${id}/credit-note`, {})).json().error
        .messageKey,
    ).toBe("errors.ALREADY_CREDITED");
    expect(
      (
        await as(accountant, "POST", `/api/v1/finance/invoices/${id}/payments`, {
          amount: 1,
          method: "CASH",
        })
      ).json().error.messageKey,
    ).toBe("errors.INVOICE_NOT_PAYABLE");

    const bad = (await one(400_00)).json().data.id; // 460.00
    await as(accountant, "POST", `/api/v1/finance/invoices/${bad}/payments`, {
      amount: 60_00,
      method: "CASH",
    });
    await as(partner, "POST", `/api/v1/finance/invoices/${bad}/bad-debt`);
    expect(await get(`/api/v1/finance/invoices/${bad}`)).toMatchObject({
      status: "BAD_DEBT",
      remaining: 400_00,
    });
    const journal = (await get("/api/v1/finance/journal")) as Array<{
      sourceType: string;
      lines: Array<{ code: string; debit: number; credit: number }>;
    }>;
    expect(journal.find((j) => j.sourceType === "BAD_DEBT")!.lines).toEqual([
      { code: "5100", name: "المصروفات التشغيلية", debit: 400_00, credit: 0 },
      { code: "1100", name: "الذمم المدينة", debit: 0, credit: 400_00 },
    ]);
  });

  it("invoices fee agreements: flat, percentage of the award, and hourly time billed once", async () => {
    await as(accountant, "PUT", `/api/v1/cases/${caseA}/fee-agreement`, {
      type: "PERCENTAGE",
      percentageBps: 2500,
      awarded: 80_000_00,
    });
    expect(await get(`/api/v1/cases/${caseA}/fee-agreement`)).toMatchObject({
      previewNet: 20_000_00,
      agreed: 20_000_00,
    });

    await as(accountant, "PUT", `/api/v1/cases/${caseA}/fee-agreement`, { type: "HOURLY" });
    await as(accountant, "POST", "/api/v1/finance/time-entries", {
      caseId: caseA,
      lawyerId,
      minutes: 90,
      hourlyRate: 500_00,
    });
    await as(accountant, "POST", "/api/v1/finance/time-entries", {
      caseId: caseA,
      lawyerId,
      minutes: 30,
      hourlyRate: 500_00,
      description: "مراجعة",
    });
    expect(
      (
        await as(accountant, "POST", "/api/v1/finance/time-entries", {
          caseId: caseA,
          lawyerId: OFFICE_A,
          minutes: 30,
          hourlyRate: 1,
        })
      ).json().error.details[0].path,
    ).toBe("lawyerId");
    expect(await get(`/api/v1/cases/${caseA}/fee-agreement`)).toMatchObject({
      previewNet: 1000_00,
      agreed: null,
    });
    const twice = await Promise.all([
      as(accountant, "POST", `/api/v1/cases/${caseA}/fee-agreement/invoice`),
      as(accountant, "POST", `/api/v1/cases/${caseA}/fee-agreement/invoice`),
    ]);
    expect(twice.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    const feeInv = await get(
      `/api/v1/finance/invoices/${twice.find((r) => r.statusCode === 201)!.json().data.id}`,
    );
    expect(feeInv).toMatchObject({
      net: 1000_00,
      total: 1150_00,
      origin: "FEE_AGREEMENT",
      basis: "أتعاب بالساعة",
    });
    const entries = (await get(`/api/v1/finance/time-entries?caseId=${caseA}`)) as Array<{
      invoiced: boolean;
      value: number;
    }>;
    expect(entries.every((e) => e.invoiced)).toBe(true);

    const te = (
      await as(accountant, "POST", "/api/v1/finance/time-entries", {
        caseId: caseA,
        lawyerId,
        minutes: 60,
        hourlyRate: 300_00,
      })
    ).json().data.id;
    expect(
      (await as(accountant, "POST", `/api/v1/finance/time-entries/${te}/invoice`)).statusCode,
    ).toBe(201);
    expect(
      (await as(accountant, "POST", `/api/v1/finance/time-entries/${te}/invoice`)).json().error
        .messageKey,
    ).toBe("errors.TIME_NOT_BILLABLE");
  });

  it("keeps trust apart from revenue and never below zero; pays an invoice from trust", async () => {
    const move = (body: object) =>
      as(accountant, "POST", `/api/v1/finance/trust/${clientB}/movements`, body);
    expect(
      (await move({ type: "DEPOSIT", amount: 5000_00, note: "عهدة رسوم" })).json().data,
    ).toEqual({ balance: 5000_00 });
    expect((await move({ type: "WITHDRAWAL", amount: 6000_00 })).json().error.messageKey).toBe(
      "errors.TRUST_INSUFFICIENT_BALANCE",
    );
    const racing = await Promise.all([
      move({ type: "WITHDRAWAL", amount: 3000_00 }),
      move({ type: "WITHDRAWAL", amount: 3000_00 }),
    ]);
    expect(racing.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(
      (await move({ type: "DEPOSIT", amount: 1000_00, caseId: caseA })).json().error.messageKey,
    ).toBe("errors.CASE_CLIENT_MISMATCH");

    const inv = (
      await as(accountant, "POST", "/api/v1/finance/invoices", {
        clientId: clientB,
        items: [{ description: "أتعاب", unitPrice: 1000_00 }],
      })
    ).json().data.id;
    await as(accountant, "POST", `/api/v1/finance/invoices/${inv}/payments`, {
      amount: 1150_00,
      method: "FROM_TRUST",
    });
    expect(await get(`/api/v1/finance/invoices/${inv}`)).toMatchObject({ status: "PAID" });
    const ledger = await get(`/api/v1/finance/trust/${clientB}`);
    expect(ledger).toMatchObject({ balance: 850_00, clientName: "شركة المالية ب" });
    expect(
      ledger.movements.map((m: { type: string; runningBalance: number }) => [
        m.type,
        m.runningBalance,
      ]),
    ).toEqual([
      ["DEPOSIT", 5000_00],
      ["WITHDRAWAL", 2000_00],
      ["TRANSFER_TO_FEES", 850_00],
    ]);
    expect((await get("/api/v1/finance/trust")).total).toBe(850_00);
    const journal = (await get("/api/v1/finance/journal")) as Array<{
      sourceType: string;
      lines: Array<{ code: string; debit: number; credit: number }>;
    }>;
    expect(
      journal
        .find((j) => j.sourceType === "TRUST_TRANSFER")!
        .lines.map((l) => [l.code, l.debit, l.credit]),
    ).toEqual([
      ["2100", 1150_00, 0],
      ["1100", 0, 1150_00],
    ]);
  });

  it("locks a period against postings (full level), and the whole ledger balances", async () => {
    const key = dateInDays(0).toISOString().slice(0, 7);
    expect(
      (await as(lawyer, "PUT", `/api/v1/finance/periods/${key}`, { locked: true })).statusCode,
    ).toBe(403);
    expect(
      (await as(partner, "PUT", `/api/v1/finance/periods/${key}`, { locked: true })).statusCode,
    ).toBe(200);
    expect(
      (await get("/api/v1/finance/periods")).find(
        (x: { periodKey: string }) => x.periodKey === key,
      ),
    ).toEqual({ periodKey: key, locked: true });
    const counterBefore = (await one(100_00)).json();
    expect(counterBefore.error.messageKey).toBe("errors.PERIOD_LOCKED");
    await as(partner, "PUT", `/api/v1/finance/periods/${key}`, { locked: false });
    // The refused invoice consumed no number: numbering has no gaps.
    const list = (await get("/api/v1/finance/invoices")) as Array<{ number: string }>;
    const next = (await one(100_00)).json().data.number;
    expect(Number(next.slice(4))).toBe(Math.max(...list.map((i) => Number(i.number.slice(4)))) + 1);

    const journal = (await get("/api/v1/finance/journal")) as Array<{
      lines: Array<{ debit: number; credit: number }>;
    }>;
    const all = journal.flatMap((j) => j.lines);
    expect(all.reduce((s, l) => s + l.debit, 0)).toBe(all.reduce((s, l) => s + l.credit, 0));
    expect(((await get("/api/v1/finance/accounts")) as unknown[]).length).toBe(14);
  });

  it("feeds search and the client journey", async () => {
    const hits = (await get(`/api/v1/search?q=INV-104`, partner)).invoices as Array<{
      label: string;
    }>;
    expect(hits.length).toBeGreaterThan(0);
    expect((await get(`/api/v1/search?q=INV-104`, lawyer)).invoices).toEqual([]);
    const j = await get("/api/v1/journey", partner);
    expect(j.invoicesDue).toBeGreaterThan(0);
    expect(j.uncollected).toBeGreaterThan(0);
  });
});

describe("finance: expenses, reimbursement, approvals (two people), bank reconciliation", () => {
  const WEB = { origin: "http://localhost:3000" };
  let partner = "";
  let accountant = "";
  let clientId = "";
  const as = (cookie: string, method: "GET" | "POST" | "PUT", url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie, ...WEB }, ...(payload ? { payload } : {}) });
  const get = async (url: string, cookie = accountant) =>
    (await as(cookie, "GET", url)).json().data;
  const journal = async () =>
    (await get("/api/v1/finance/journal")) as Array<{
      sourceType: string;
      description: { params: Record<string, string> };
      lines: Array<{ code: string; debit: number; credit: number }>;
    }>;

  beforeAll(async () => {
    partner = cookieOf(await login(PARTNER_N));
    accountant = cookieOf(await login(ACCOUNTANT_N));
    clientId = (await as(partner, "POST", "/api/v1/clients", { name: "عميل المصروفات" })).json()
      .data.id;
  });

  it("splits VAT out of an expense, posts it, and reimburses a billable one exactly once", async () => {
    const res = await as(accountant, "POST", "/api/v1/finance/expenses", {
      gross: 1150_00,
      category: "COURT_FEES",
      vendor: "وزارة العدل",
      billable: true,
      clientId,
    });
    expect(res.statusCode).toBe(201);
    const list = (await get("/api/v1/finance/expenses")) as Array<{
      id: string;
      net: number;
      inputVat: number;
      approved: boolean;
    }>;
    expect(list[0]).toMatchObject({ net: 1000_00, inputVat: 150_00, approved: true });
    expect(
      (await journal())
        .find((j) => j.sourceType === "EXPENSE")!
        .lines.map((l) => [l.code, l.debit, l.credit]),
    ).toEqual([
      ["5100", 1000_00, 0],
      ["2200", 150_00, 0],
      ["1000", 0, 1150_00],
    ]);
    const twice = await Promise.all([
      as(accountant, "POST", `/api/v1/finance/expenses/${res.json().data.id}/reimburse`),
      as(accountant, "POST", `/api/v1/finance/expenses/${res.json().data.id}/reimburse`),
    ]);
    expect(twice.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    const inv = await get(
      `/api/v1/finance/invoices/${twice.find((r) => r.statusCode === 201)!.json().data.id}`,
    );
    expect(inv).toMatchObject({
      net: 1000_00,
      origin: "EXPENSE_REIMBURSEMENT",
      basis: "استرداد مصروف",
    });
    expect(inv.items[0].description).toBe("استرداد مصروف: وزارة العدل");
  });

  it("holds new payments and expenses for approval by someone else when the switch is on", async () => {
    expect(
      (await as(accountant, "PUT", "/api/v1/finance/settings/require-approval", { value: true }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await as(partner, "PUT", "/api/v1/finance/settings/require-approval", { value: true })
      ).json().data,
    ).toEqual({ requireApproval: true });

    const before = (await journal()).length;
    const exp = (
      await as(accountant, "POST", "/api/v1/finance/expenses", {
        gross: 230_00,
        category: "OFFICE_RENT",
        method: "CASH",
      })
    ).json().data.id;
    expect((await journal()).length).toBe(before); // not posted yet
    const inv = (
      await as(accountant, "POST", "/api/v1/finance/invoices", {
        clientId,
        items: [{ description: "أتعاب", unitPrice: 100_00 }],
      })
    ).json().data.id;
    const pay = (
      await as(accountant, "POST", `/api/v1/finance/invoices/${inv}/payments`, {
        amount: 50_00,
        method: "BANK_TRANSFER",
      })
    ).json().data.id;

    const pending = await get("/api/v1/finance/approvals");
    expect(pending.expenses.map((e: { id: string }) => e.id)).toEqual([exp]);
    expect(pending.payments.map((x: { id: string }) => x.id)).toEqual([pay]);

    const own = await as(accountant, "POST", `/api/v1/finance/expenses/${exp}/approve`);
    expect(own.statusCode).toBe(403);
    expect(own.json().error.messageKey).toBe("errors.APPROVE_OWN_ENTRY");
    expect((await as(partner, "POST", `/api/v1/finance/expenses/${exp}/approve`)).statusCode).toBe(
      200,
    );
    expect((await as(partner, "POST", `/api/v1/finance/expenses/${exp}/approve`)).statusCode).toBe(
      404,
    );
    expect((await journal()).filter((j) => j.sourceType === "EXPENSE").length).toBe(2);
    expect((await as(partner, "POST", `/api/v1/finance/payments/${pay}/approve`)).statusCode).toBe(
      200,
    );
    expect(await get("/api/v1/finance/approvals")).toEqual({ payments: [], expenses: [] });

    const audit = (await get("/api/v1/finance/audit")) as Array<{ action: string }>;
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining(["finance.requireApproval.set", "expense.approve", "payment.approve"]),
    );
    await as(partner, "PUT", "/api/v1/finance/settings/require-approval", { value: false });
  });

  it("shows money by account and reconciles lines against the statement", async () => {
    const bank = await get("/api/v1/finance/bank?account=CASH");
    expect(bank.cash).toEqual({ inflow: 0, outflow: 230_00 });
    expect(bank.current.inflow).toBe(50_00);
    expect(bank.current.outflow).toBe(1150_00);
    const line = bank.ledger[0];
    expect(line).toMatchObject({ kind: "EXPENSE", amount: -230_00, cleared: false });
    await as(accountant, "POST", `/api/v1/finance/bank/EXPENSE/${line.id}/toggle`);
    expect((await get("/api/v1/finance/bank?account=CASH")).ledger[0].cleared).toBe(true);
  });

  it("derives trial balance, VAT return, aging, statements, dashboard and profitability from the books", async () => {
    const report = await get("/api/v1/finance/reports/ledger");
    const dr = report.trial.reduce((s: number, r: { debit: number }) => s + r.debit, 0);
    const cr = report.trial.reduce((s: number, r: { credit: number }) => s + r.credit, 0);
    expect(dr).toBe(cr);
    // Output VAT: reimbursement 150 + invoice 15 = 165; input VAT: 150 + 30 = 180 → refundable 15.
    expect(report.vat).toEqual({
      outputVat: 165_00,
      inputVat: 180_00,
      net: -15_00,
      payable: false,
    });
    expect(report.aging.total).toBe(1150_00 + 65_00);
    expect(report.aging.buckets.b0_30).toBe(1215_00);

    const st = await get("/api/v1/finance/reports/statements");
    expect(st).toMatchObject({ revenue: 1100_00, expenses: 1200_00, netIncome: -100_00 });
    expect(st.cashFlow).toMatchObject({
      collected: 50_00,
      trustToFees: 0,
      expensePaid: 1380_00,
      operating: -1330_00,
      cashBank: -1330_00,
    });

    const dash = await get("/api/v1/finance/reports/dashboard");
    expect(dash).toMatchObject({
      outstanding: 1215_00,
      overdueCount: 0,
      monthRevenue: 1100_00,
      monthExpense: 1380_00,
    });
    expect(dash.revenueByMonth).toHaveLength(6);

    const manual = await as(partner, "POST", "/api/v1/finance/journal", {
      date: dateInDays(0).toISOString().slice(0, 10),
      description: "إيداع رأس مال",
      lines: [
        { code: "1000", debit: 10_000_00 },
        { code: "3000", credit: 10_000_00 },
      ],
    });
    expect(manual.statusCode).toBe(201);
    const bad = await as(partner, "POST", "/api/v1/finance/journal", {
      date: dateInDays(0).toISOString().slice(0, 10),
      description: "x",
      lines: [
        { code: "1000", debit: 100 },
        { code: "3000", credit: 99 },
      ],
    });
    expect(bad.json().error.messageKey).toBe("errors.JOURNAL_UNBALANCED");
    expect(
      (
        await as(accountant, "POST", "/api/v1/finance/journal", {
          date: "2026-01-01",
          description: "x",
          lines: [
            { code: "9999", debit: 1 },
            { code: "1000", credit: 1 },
          ],
        })
      ).json().error.details[0].path,
    ).toBe("lines.0.code");
    expect((await get("/api/v1/finance/reports/statements")).equity).toBe(10_000_00);
    expect(await get("/api/v1/finance/reports/profitability")).toEqual([]);
  });
});

describe("legal AI: closed knowledge base, citation gate, PII redaction, arena, hearing draft", () => {
  const WEB = { origin: "http://localhost:3000" };
  let partner = "";
  let lawyer1 = "";
  let lawyer2 = "";
  let assistant = "";
  let caseId = "";
  let sourceId = "";
  const as = (cookie: string, method: "GET" | "POST" | "PUT", url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie, ...WEB }, ...(payload ? { payload } : {}) });

  beforeAll(async () => {
    partner = cookieOf(await login(PARTNER_O));
    lawyer1 = cookieOf(await login(LAWYER_O1));
    lawyer2 = cookieOf(await login(LAWYER_O2));
    assistant = cookieOf(await login(ASSISTANT_O));
    const client = (
      await as(partner, "POST", "/api/v1/clients", { name: "شركة سرية الاسم" })
    ).json().data.id;
    caseId = (
      await as(lawyer1, "POST", "/api/v1/cases", {
        number: "1447/99",
        title: "فصل تعسفي",
        clientId: client,
        opposingParty: "مؤسسة الخصم",
      })
    ).json().data.id;
  });

  it("manages the knowledge base at the full level only", async () => {
    const body = {
      type: "STATUTE",
      title: "نظام العمل",
      citationKey: "نظام العمل",
      chunks: [
        { articleNumber: "74", content: "ينتهي عقد العمل بانتهاء مدته أو باتفاق الطرفين." },
        {
          articleNumber: "٧٧",
          content: "إذا أُنهي العقد لسبب غير مشروع استحق الطرف المتضرر تعويضاً.",
        },
      ],
    };
    expect((await as(lawyer1, "POST", "/api/v1/ai/kb/sources", body)).statusCode).toBe(403);
    const res = await as(partner, "POST", "/api/v1/ai/kb/sources", body);
    expect(res.statusCode).toBe(201);
    sourceId = res.json().data.id;
    expect((await as(partner, "POST", "/api/v1/ai/kb/sources", body)).json().error.messageKey).toBe(
      "errors.KB_SOURCE_EXISTS",
    );
    const kb = (await as(lawyer1, "GET", "/api/v1/ai/kb")).json().data;
    expect(kb).toMatchObject([
      { citationKey: "نظام العمل", chunks: 2, isActive: true, isDemo: false },
    ]);
    expect((await as(lawyer1, "GET", "/api/v1/ai/status")).json().data).toEqual({
      connected: true,
      provider: "test",
      region: "test",
    });
  });

  it("retrieves the relevant articles, redacts identifiers, and blocks every unmatched citation", async () => {
    fakeLlm.prompts.length = 0;
    fakeLlm.reply = () =>
      "وفقاً للمادة (77) من نظام العمل يستحق العامل التعويض. وبحسب المادة (999) من نظام العمل يضاعف المبلغ. والمادة (5) من نظام المحاماة الموحد تؤكد ذلك. وننصح بالتفاوض أولاً.";
    const res = await as(lawyer1, "POST", "/api/v1/ai/ask", {
      question:
        "هل يستحق التعويض إذا أنهي العقد لسبب غير مشروع؟ جوال العامل 0551234567 وهويته 1012345678",
    });
    expect(res.statusCode).toBe(201);
    const a = res.json().data;
    expect(a.verdict).toBe("BLOCKED");
    // The gate returns normalized prose (no diacritics, "للمادة" → "المادة").
    expect(a.finalOutput).toBe(
      "وفقا المادة (77) من نظام العمل يستحق العامل التعويض. وننصح بالتفاوض أولا.",
    );
    // (999), plus (5) and the unknown statute it names.
    expect(a.blockedCount).toBe(3);
    expect(a.citations).toEqual([
      {
        rawText: expect.stringContaining("77"),
        sourceTitle: "نظام العمل",
        citationKey: "نظام العمل",
        articleNumber: "77",
        isDemo: false,
      },
    ]);
    expect(a.grounded).toBe(true);
    const sent = fakeLlm.prompts[0]!.prompt;
    expect(sent).toContain("المادة (77): إذا أُنهي العقد لسبب غير مشروع");
    expect(sent).not.toContain("0551234567");
    expect(sent).not.toContain("1012345678");
    expect(sent).toContain("[PHONE]");
    expect(a.question).not.toContain("0551234567");
  });

  it("answers ungrounded questions without inventing sources, and keeps access rules", async () => {
    fakeLlm.reply = () => "هذا تحليل منطقي دون سند نظامي.";
    const a = (
      await as(lawyer1, "POST", "/api/v1/ai/ask", { question: "ما رأيك في الطقس؟" })
    ).json().data;
    expect(a).toMatchObject({ grounded: false, verdict: "PASSED", citations: [] });
    expect((await as(assistant, "POST", "/api/v1/ai/ask", { question: "س" })).statusCode).toBe(403);
    const mine = (await as(lawyer1, "GET", "/api/v1/ai/history")).json().data as unknown[];
    expect(mine).toHaveLength(2);
    expect((await as(partner, "GET", "/api/v1/ai/history")).json().data).toEqual([]);
  });

  it("analyses a case inside its row scope without party names in the prompt", async () => {
    fakeLlm.prompts.length = 0;
    fakeLlm.reply = () => "التحليل: موقف الموكل قوي.";
    expect(
      (await as(lawyer2, "POST", "/api/v1/ai/ask", { question: "حلّل", caseId })).statusCode,
    ).toBe(404);
    const a = (
      await as(lawyer1, "POST", "/api/v1/ai/ask", { question: "حلّل القضية", caseId })
    ).json().data;
    expect(a.surface).toBe("CASE_ANALYSIS");
    const sent = fakeLlm.prompts[0]!.prompt;
    expect(sent).toContain("القضية: فصل تعسفي");
    expect(sent).not.toContain("شركة سرية الاسم");
    expect(sent).not.toContain("مؤسسة الخصم");
    const history = (await as(lawyer1, "GET", `/api/v1/ai/history?caseId=${caseId}`)).json()
      .data as Array<{ id: string }>;
    expect(history.map((h) => h.id)).toEqual([a.id]);
  });

  it("runs arena rounds of three gated turns and resets to a new session", async () => {
    fakeLlm.reply = (req) =>
      req.system.includes("قاضٍ")
        ? "المآل المرجح لصالح الموكل. والمادة (12) من نظام مخترع تقضي بذلك."
        : "حجتنا قوية.";
    let view = (await as(lawyer1, "POST", `/api/v1/ai/arena/${caseId}/round`)).json().data;
    expect(view.turns.map((t: { arenaRole: string }) => t.arenaRole)).toEqual([
      "OURS",
      "OPPONENT",
      "JUDGE",
    ]);
    expect(view.turns[2]).toMatchObject({
      verdict: "BLOCKED",
      finalOutput: "المآل المرجح لصالح الموكل.",
    });
    expect(view.round).toBe(2);
    await as(lawyer1, "POST", `/api/v1/ai/arena/${caseId}/reset`);
    view = (await as(lawyer1, "GET", `/api/v1/ai/arena/${caseId}`)).json().data;
    expect(view).toMatchObject({ round: 1, turns: [] });
    expect((await as(lawyer2, "GET", `/api/v1/ai/arena/${caseId}`)).statusCode).toBe(404);
  });

  it("drafts hearing fields through the gate; a broken model reply is refused", async () => {
    fakeLlm.reply = () =>
      JSON.stringify({
        minutes: "حضر الطرفان وطلب المدعى عليه مهلة للرد.",
        result: "تأجيل للاطلاع",
        clientReport: "أُجّلت الجلسة. وتنص المادة (300) من نظام العمل على حقك. سنوافيك بالموعد.",
      });
    const d = (
      await as(lawyer1, "POST", `/api/v1/cases/${caseId}/hearings/draft`, {
        notes: "حضر الطرفان وطلب الخصم مهلة",
      })
    ).json().data;
    expect(d).toMatchObject({
      minutes: "حضر الطرفان وطلب المدعى عليه مهلة للرد.",
      result: "تأجيل للاطلاع",
      verdict: "BLOCKED",
      blockedCount: 1,
    });
    expect(d.clientReport).toBe("أجلت الجلسة. سنوافيك بالموعد.");
    fakeLlm.reply = () => "ليس JSON";
    const bad = await as(lawyer1, "POST", `/api/v1/cases/${caseId}/hearings/draft`, { notes: "x" });
    expect(bad.statusCode).toBe(503);
    expect(bad.json().error.messageKey).toBe("errors.AI_BAD_OUTPUT");
  });

  it("stops citing a source once it is deactivated", async () => {
    await as(partner, "PUT", `/api/v1/ai/kb/sources/${sourceId}/active`, { active: false });
    fakeLlm.reply = () => "وفقاً للمادة (77) من نظام العمل يستحق التعويض.";
    const a = (await as(lawyer1, "POST", "/api/v1/ai/ask", { question: "تعويض" })).json().data;
    expect(a).toMatchObject({ verdict: "BLOCKED", finalOutput: "", citations: [] });
  });
});

describe("HR: employees, advances, leaves, requests, attendance, payroll, recruitment, Team Pulse", () => {
  const WEB = { origin: "http://localhost:3000" };
  let partner = "";
  let admin = "";
  let lawyer = "";
  const ids: Record<string, string> = {};
  const as = (cookie: string, method: "GET" | "POST" | "PUT", url: string, payload?: object) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      headers: { cookie, ...WEB },
      ...(payload ? { payload } : {}),
    });
  const data = async (
    cookie: string,
    method: "GET" | "POST" | "PUT",
    url: string,
    payload?: object,
  ) => {
    const res = await as(cookie, method, url, payload);
    if (res.statusCode >= 400) throw new Error(`${method} ${url} → ${res.statusCode} ${res.body}`);
    return res.json().data;
  };
  const errorKey = async (cookie: string, method: "POST" | "PUT", url: string, payload?: object) =>
    (await as(cookie, method, url, payload)).json().error.messageKey;
  const thisMonth = riyadhCalendarDate().toISOString().slice(0, 7);

  // Read-only checks on the ledger and the audit log, as the table owner.
  const owner = postgres(OWNER_URL, { max: 1 });
  afterAll(() => owner.end());

  beforeAll(async () => {
    partner = cookieOf(await login(PARTNER_P));
    admin = cookieOf(await login(ADMIN_P));
    lawyer = cookieOf(await login(LAWYER_P));
  });

  it("keeps HR to the roles that have it, and records employees in halalas", async () => {
    expect((await as(lawyer, "GET", "/hr/employees")).statusCode).toBe(403);
    ids.saudi = (
      await data(admin, "POST", "/hr/employees", {
        name: "سارة القحطاني",
        department: "القضايا",
        jobTitle: "محامية",
        hireDate: "2020-01-15",
        basicSalary: 1_000_000,
        allowances: 200_000,
        gosiContribution: 90_000,
        leaveBalanceDays: 21,
        iban: "SA0380000000608010167519",
        nationalId: "1012345678",
      })
    ).id;
    ids.noIban = (
      await data(admin, "POST", "/hr/employees", {
        name: "فهد العتيبي",
        department: "القضايا",
        hireDate: "2024-03-01",
        basicSalary: 800_000,
      })
    ).id;
    ids.expat = (
      await data(admin, "POST", "/hr/employees", {
        name: "Ahmed Karim",
        nationality: "مصري",
        hireDate: "2025-06-01",
        basicSalary: 500_000,
        allowances: 100_000,
        gosiContribution: 700_000,
        iban: "SA4420000001234567891234",
      })
    ).id;
    const list = await data(admin, "GET", "/hr/employees");
    expect(list).toHaveLength(3);
    const sz = await data(admin, "GET", "/hr/saudization");
    expect(sz).toMatchObject({ total: 3, saudiCount: 2, band: "MID_GREEN" });
    expect(sz.targets.map((t: { band: string }) => t.band)).toEqual(["PLATINUM", "HIGH_GREEN"]);
    const org = await data(admin, "GET", "/hr/org");
    expect(org[0]).toMatchObject({ department: "القضايا" });
    expect(org[0].employees).toHaveLength(2);
    const d = await data(admin, "GET", `/hr/employees/${ids.saudi}`);
    expect(d.ibanMasked).toBe("SA••••7519");
    const years = serviceYears(2020, riyadhCalendarDate().getUTCFullYear());
    expect(d.endOfService).toEqual({
      years,
      awardMinor: endOfServiceAward({ basicSalary: 1_000_000, allowances: 200_000, years }),
      frozen: false,
    });
  });

  it("grants an advance with its journal entry and refuses installments that round to zero", async () => {
    expect(
      await errorKey(admin, "POST", "/hr/advances", {
        employeeId: ids.saudi,
        amount: 40,
        months: 100,
      }),
    ).toBe("hr.err.INSTALLMENT_TOO_SMALL");
    expect(
      await errorKey(admin, "POST", "/hr/advances", {
        employeeId: ids.saudi,
        amount: 1000,
        monthlyInstallment: 2000,
      }),
    ).toBe("hr.err.INSTALLMENT_EXCEEDS_AMOUNT");
    await data(admin, "POST", "/hr/advances", {
      employeeId: ids.saudi,
      amount: 300_000,
      months: 3,
    });
    const [a] = await data(admin, "GET", "/hr/advances");
    expect(a).toMatchObject({
      employeeName: "سارة القحطاني",
      monthlyDue: 100_000,
      remaining: 300_000,
      status: "ACTIVE",
    });
    const [row] =
      await owner`select l.debit, l.credit, c.code from journal_lines l join chart_of_accounts c on c.id = l.account_id
      join journal_entries e on e.id = l.journal_entry_id where e.office_id = ${OFFICE_P} and e.description_key = 'journal.advance' order by l.line_no`;
    expect(row).toMatchObject({ code: "1300", debit: "300000" });
  });

  it("draws annual leave from the balance only, never below zero", async () => {
    expect(
      await errorKey(admin, "POST", "/hr/leaves", {
        employeeId: ids.saudi,
        type: "ANNUAL",
        days: 30,
        startDate: "2026-11-01",
      }),
    ).toBe("hr.err.LEAVE_BALANCE_INSUFFICIENT");
    await data(admin, "POST", "/hr/leaves", {
      employeeId: ids.saudi,
      type: "ANNUAL",
      days: 5,
      startDate: "2026-11-01",
    });
    await data(admin, "POST", "/hr/leaves", {
      employeeId: ids.saudi,
      type: "SICK",
      days: 3,
      startDate: "2026-11-10",
    });
    expect((await data(admin, "GET", `/hr/employees/${ids.saudi}`)).leaveBalanceDays).toBe(16);
  });

  it("decides requests once; an approved leave request takes effect", async () => {
    const leave = (
      await data(admin, "POST", "/hr/requests", {
        employeeId: ids.saudi,
        kind: "LEAVE",
        days: 2,
        detail: "سفر",
      })
    ).id;
    const noDays = (
      await data(admin, "POST", "/hr/requests", { employeeId: ids.saudi, kind: "LEAVE" })
    ).id;
    await data(admin, "POST", `/hr/requests/${leave}/decide`, { status: "IN_REVIEW" });
    await data(admin, "POST", `/hr/requests/${leave}/decide`, { status: "APPROVED" });
    expect(
      await errorKey(admin, "POST", `/hr/requests/${leave}/decide`, { status: "REJECTED" }),
    ).toBe("hr.err.REQUEST_ALREADY_DECIDED");
    expect(
      await errorKey(admin, "POST", `/hr/requests/${noDays}/decide`, { status: "APPROVED" }),
    ).toBe("hr.err.LEAVE_REQUEST_MISSING_DAYS");
    const d = await data(admin, "GET", `/hr/employees/${ids.saudi}`);
    expect(d.leaveBalanceDays).toBe(14);
    expect(d.leaves).toHaveLength(3);
    const r = (await data(admin, "GET", "/hr/requests")).find(
      (x: { id: string }) => x.id === leave,
    );
    expect(r.history.map((h: { status: string }) => h.status)).toEqual([
      "SUBMITTED",
      "IN_REVIEW",
      "APPROVED",
    ]);
  });

  it("records today's attendance, keeps the first check-in, and counts the month", async () => {
    expect((await as(admin, "POST", `/hr/attendance/${ids.noIban}/clock-out`)).statusCode).toBe(
      404,
    );
    await data(admin, "PUT", `/hr/attendance/${ids.saudi}`, { status: "PRESENT" });
    const first = (await data(admin, "GET", "/hr/attendance/today")).rows.find(
      (r: { employeeId: string }) => r.employeeId === ids.saudi,
    );
    await data(admin, "PUT", `/hr/attendance/${ids.saudi}`, { status: "LATE" });
    await data(admin, "POST", `/hr/attendance/${ids.saudi}/clock-out`);
    await data(admin, "PUT", `/hr/attendance/${ids.noIban}`, { status: "ABSENT" });
    const today = (await data(admin, "GET", "/hr/attendance/today")).rows;
    const s = today.find((r: { employeeId: string }) => r.employeeId === ids.saudi);
    expect(s).toMatchObject({ status: "LATE", checkIn: first.checkIn });
    expect(s.checkOut).not.toBeNull();
    expect(today.find((r: { employeeId: string }) => r.employeeId === ids.noIban)).toMatchObject({
      status: "ABSENT",
      checkIn: null,
    });
    const month = await data(admin, "GET", `/hr/attendance/month?month=${thisMonth}`);
    expect(
      month.rows.find((r: { employeeId: string }) => r.employeeId === ids.saudi),
    ).toMatchObject({ lateCount: 1, daysPresent: 0 });
  });

  it("runs payroll once per month: GOSI capped, advances repaid, one balanced entry, WPS records", async () => {
    const [year, month] = thisMonth.split("-").map(Number);
    const runId = (await data(admin, "POST", "/hr/payroll", { year, month })).id;
    expect(await errorKey(admin, "POST", "/hr/payroll", { year, month })).toBe(
      "hr.err.PAYROLL_ALREADY_RUN",
    );
    const run = await data(admin, "GET", `/hr/payroll/${runId}`);
    expect(run).toMatchObject({
      periodKey: thisMonth,
      totalBasic: 2_300_000,
      totalAllowances: 300_000,
      totalGosi: 690_000,
      totalAdvances: 100_000,
      totalNet: 1_010_000 + 800_000 + 0,
    });
    expect(
      run.lines.find((l: { employeeName: string }) => l.employeeName === "Ahmed Karim"),
    ).toMatchObject({ gosi: 600_000, net: 0 });
    const [adv] = await data(admin, "GET", "/hr/advances");
    expect(adv).toMatchObject({ paid: 100_000, remaining: 200_000 });
    const lines =
      await owner`select sum(l.debit)::int as dr, sum(l.credit)::int as cr from journal_lines l where l.journal_entry_id = ${run.journalEntryId}`;
    expect(lines[0]).toEqual({ dr: 2_600_000, cr: 2_600_000 });
    const wps = await data(admin, "GET", `/hr/payroll/${runId}/wps`);
    expect(wps).toMatchObject({ recordCount: 3, missingIban: ["فهد العتيبي"] });
    expect(JSON.stringify(wps)).not.toContain("SA0380000000608010167519");
    const [audit] =
      await owner`select count(*)::int as n from audit_log where office_id = ${OFFICE_P} and action = 'payroll.wpsView'`;
    expect(audit!.n).toBe(1);
  });

  it("grants system accounts at the full level and switches them off when service ends", async () => {
    expect(
      (
        await as(admin, "POST", `/hr/employees/${ids.noIban}/account`, {
          phone: "0500001409",
          role: "LAWYER",
        })
      ).statusCode,
    ).toBe(403);
    expect(
      await errorKey(partner, "POST", `/hr/employees/${ids.noIban}/account`, {
        phone: LAWYER_P,
        role: "LAWYER",
      }),
    ).toBe("hr.err.PHONE_ALREADY_IN_USE");
    await data(partner, "POST", `/hr/employees/${ids.noIban}/account`, {
      phone: "0500001409",
      role: "LAWYER",
    });
    expect(
      await errorKey(partner, "POST", `/hr/employees/${ids.noIban}/account`, {
        phone: "0500001408",
        role: "LAWYER",
      }),
    ).toBe("hr.err.EMPLOYEE_ALREADY_HAS_ACCOUNT");
    const staff = cookieOf(await login("0500001409"));
    expect((await as(staff, "GET", "/auth/me")).statusCode).toBe(200);
    expect((await as(admin, "POST", `/hr/employees/${ids.noIban}/terminate`)).statusCode).toBe(403);
    await data(partner, "POST", `/hr/employees/${ids.noIban}/terminate`);
    expect(await errorKey(partner, "POST", `/hr/employees/${ids.noIban}/terminate`)).toBe(
      "hr.err.EMPLOYEE_ALREADY_TERMINATED",
    );
    expect((await as(staff, "GET", "/auth/me")).statusCode).toBe(401);
    const d = await data(partner, "GET", `/hr/employees/${ids.noIban}`);
    expect(d).toMatchObject({ status: "TERMINATED", endOfService: { frozen: true } });
    expect(
      await errorKey(admin, "POST", "/hr/advances", { employeeId: ids.noIban, amount: 1000 }),
    ).toBe("hr.err.EMPLOYEE_ALREADY_TERMINATED");
    // Terminated staff leave the Nitaqat headcount.
    expect(await data(admin, "GET", "/hr/saudization")).toMatchObject({ total: 2, saudiCount: 1 });
  });

  it("moves candidates one stage at a time and deletes softly", async () => {
    const c = (
      await data(admin, "POST", "/hr/candidates", {
        name: "مرشح",
        roleTitle: "محامٍ متدرب",
        source: "LINKEDIN",
      })
    ).id;
    await data(admin, "POST", `/hr/candidates/${c}/move`, { direction: -1 });
    await data(admin, "POST", `/hr/candidates/${c}/move`, { direction: 1 });
    await data(admin, "POST", `/hr/candidates/${c}/move`, { direction: 1 });
    expect((await data(admin, "GET", "/hr/candidates"))[0]).toMatchObject({
      stage: "OFFER",
      source: "LINKEDIN",
    });
    await data(admin, "POST", `/hr/candidates/${c}/delete`);
    expect(await data(admin, "GET", "/hr/candidates")).toEqual([]);
  });

  it("awards Team Pulse points for real actions, once per task, with office weights", async () => {
    const adminId = (await data(admin, "GET", "/auth/me")).user.id;
    const lawyerId = (await data(lawyer, "GET", "/auth/me")).user.id;
    expect(
      (await as(admin, "PUT", "/pulse/weights/TASK_COMPLETED", { points: 7 })).statusCode,
    ).toBe(403);
    await data(partner, "PUT", "/pulse/weights/TASK_COMPLETED", { points: 7 });
    const t1 = (await data(partner, "POST", "/tasks", { title: "مهمة", assigneeId: lawyerId })).id;
    await data(lawyer, "PUT", `/tasks/${t1}/status`, { status: "DONE" });
    await data(lawyer, "PUT", `/tasks/${t1}/status`, { status: "NEW" });
    await data(lawyer, "PUT", `/tasks/${t1}/status`, { status: "DONE" });
    await data(partner, "POST", "/pulse/weights/TASK_COMPLETED/reset");
    const t2 = (await data(partner, "POST", "/tasks", { title: "مهمة ٢", assigneeId: adminId })).id;
    await data(admin, "PUT", `/tasks/${t2}/status`, { status: "DONE" });

    const self = await data(lawyer, "GET", "/pulse/self?window=today");
    expect(self).toMatchObject({ points: 7, tasksDone: 1, completionRatePct: 100 });
    expect((await as(lawyer, "GET", "/pulse/team")).statusCode).toBe(403);
    const team = await data(admin, "GET", "/pulse/team?window=week");
    expect(team.totals).toEqual({ totalPoints: 12, tasksCompleted: 2, hearingsLogged: 0 });
    expect(team.ranking.map((r: { points: number }) => r.points)).toEqual([7, 5]);
    const drill = await data(admin, "GET", `/pulse/team/${lawyerId}`);
    expect(drill.events).toHaveLength(1);
    expect(
      (await data(partner, "GET", "/pulse/weights")).find(
        (w: { kind: string }) => w.kind === "TASK_COMPLETED",
      ),
    ).toEqual({
      kind: "TASK_COMPLETED",
      points: 5,
      isDefault: true,
    });
    expect((await data(lawyer, "GET", "/today")).employeeOfWeek).toMatchObject({
      points: 7,
      role: "LAWYER",
    });
  });
});

describe("integrations: ZATCA tax invoice, platform status, WhatsApp log", () => {
  const WEB = { origin: "http://localhost:3000" };
  let partner = "";
  let accountant = "";
  let lawyer1 = "";
  let lawyer2 = "";
  let reception = "";
  let clientId = "";
  let invoiceId = "";
  const as = (
    cookie: string,
    method: "GET" | "POST" | "PUT" | "PATCH",
    url: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      headers: { cookie, ...WEB },
      ...(payload ? { payload } : {}),
    });
  const data = async (
    cookie: string,
    method: "GET" | "POST" | "PUT" | "PATCH",
    url: string,
    payload?: object,
  ) => {
    const res = await as(cookie, method, url, payload);
    if (res.statusCode >= 400) throw new Error(`${method} ${url} → ${res.statusCode} ${res.body}`);
    return res.json().data;
  };

  beforeAll(async () => {
    partner = cookieOf(await login(PARTNER_Q));
    accountant = cookieOf(await login(ACCOUNTANT_Q));
    lawyer1 = cookieOf(await login(LAWYER_Q1));
    lawyer2 = cookieOf(await login(LAWYER_Q2));
    reception = cookieOf(await login(RECEPTION_Q));
    clientId = (await data(partner, "POST", "/clients", { name: "مؤسسة الأفراد" })).id;
    invoiceId = (
      await data(accountant, "POST", "/finance/invoices", {
        clientId,
        items: [{ description: "أتعاب استشارة", quantity: 2, unitPrice: 50_000 }],
      })
    ).id;
  });

  it("keeps the tax profile partner-only and validates VAT and CR numbers", async () => {
    expect(
      (await as(accountant, "PUT", "/offices/tax-profile", { vatNumber: "300000000000003" }))
        .statusCode,
    ).toBe(403);
    const bad = await as(partner, "PUT", "/offices/tax-profile", {
      vatNumber: "123",
      crNumber: "99",
    });
    expect(bad.statusCode).toBe(400);
    expect(
      bad
        .json()
        .error.details.map((d: { message: string }) => d.message)
        .sort(),
    ).toEqual(["errors.CR_NUMBER_INVALID", "errors.VAT_NUMBER_INVALID"]);
    const ints = await data(lawyer1, "GET", "/integrations");
    expect(ints.every((i: { status: string }) => i.status === "NOT_CONNECTED")).toBe(true);
    expect(ints.map((i: { key: string }) => i.key)).toEqual([
      "NAJIZ",
      "NAFATH",
      "ZATCA",
      "MUDAD",
      "GOSI",
      "QIWA",
      "ABSHER",
      "MUQEEM",
    ]);
    expect(ints.find((i: { key: string }) => i.key === "ZATCA").phase1Ready).toBe(false);
  });

  it("prints no tax invoice without the office VAT number", async () => {
    const res = await as(accountant, "GET", `/finance/invoices/${invoiceId}/pdf`);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.messageKey).toBe("errors.TAX_PROFILE_MISSING");
  });

  it("prints a simplified tax invoice with the VAT number and QR, and a full one for a VAT-registered buyer", async () => {
    await data(partner, "PUT", "/offices/tax-profile", {
      vatNumber: "310122393500003",
      crNumber: "1010123456",
      taxAddress: "الرياض، حي العليا",
    });
    expect(await data(accountant, "GET", "/offices/tax-profile")).toEqual({
      vatNumber: "310122393500003",
      crNumber: "1010123456",
      taxAddress: "الرياض، حي العليا",
    });
    pdfStub.html.length = 0;
    const res = await as(accountant, "GET", `/finance/invoices/${invoiceId}/pdf`);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    const html = pdfStub.html[0]!;
    expect(html).toContain("فاتورة ضريبية مبسطة");
    expect(html).toContain("310122393500003");
    expect(html).toContain("1010123456");
    expect(html).toMatch(/<svg[^>]*viewBox/);
    expect(
      (await data(lawyer1, "GET", "/integrations")).find((i: { key: string }) => i.key === "ZATCA")
        .phase1Ready,
    ).toBe(true);

    expect(
      (await as(partner, "PATCH", `/clients/${clientId}`, { vatNumber: "12" })).statusCode,
    ).toBe(400);
    await data(partner, "PATCH", `/clients/${clientId}`, { vatNumber: "300000000000003" });
    pdfStub.html.length = 0;
    await as(accountant, "GET", `/finance/invoices/${invoiceId}/pdf`);
    expect(pdfStub.html[0]).toContain("فاتورة ضريبية<");
    expect(pdfStub.html[0]).toContain("300000000000003");
    const [audit] = await (async () => {
      const owner = postgres(OWNER_URL, { max: 1 });
      try {
        return await owner`select count(*)::int as n from audit_log where office_id = ${OFFICE_Q} and action = 'invoice.pdf'`;
      } finally {
        await owner.end();
      }
    })();
    expect(audit!.n).toBe(2);
  });

  it("lists recorded WhatsApp contacts within case scope", async () => {
    const mine = (
      await data(lawyer1, "POST", "/cases", { number: "1447/5", title: "قضية الأفراد", clientId })
    ).id;
    await data(lawyer1, "POST", `/cases/${mine}/communications`, {
      type: "MESSAGE",
      note: "رسالة للموكل",
    });
    await data(lawyer1, "POST", `/cases/${mine}/communications`, { type: "CALL", note: "اتصال" });
    expect((await as(accountant, "GET", "/whatsapp/messages")).statusCode).toBe(403);
    expect(await data(reception, "GET", "/whatsapp/messages")).toMatchObject([
      { note: "رسالة للموكل", caseTitle: "قضية الأفراد", clientName: "مؤسسة الأفراد" },
    ]);
    // A lawyer sees only the cases assigned to them.
    expect(await data(lawyer2, "GET", "/whatsapp/messages")).toEqual([]);
    expect(await data(lawyer1, "GET", "/whatsapp/messages")).toHaveLength(1);
  });
});

describe("client and employee portals: own data only, revocable sessions", () => {
  const WEB = { origin: "http://localhost:3000" };
  const CLIENT_PHONE = "0500001611";
  const EMPLOYEE_PHONE = "0500001612";
  const PDF = Buffer.from("%PDF-1.7\n1 0 obj << >> endobj\n%%EOF\n");
  let partner = "";
  let clientId = "";
  let ownCase = "";
  let otherCase = "";
  let sharedDoc = "";
  let hiddenDoc = "";
  let approvalId = "";
  let employeeId = "";
  let otherEmployeeId = "";
  let ownInvoice = "";
  let otherInvoice = "";
  const as = (
    cookie: string,
    method: "GET" | "POST" | "PUT" | "PATCH",
    url: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      headers: { cookie, ...WEB },
      ...(payload ? { payload } : {}),
    });
  const data = async (
    cookie: string,
    method: "GET" | "POST" | "PUT" | "PATCH",
    url: string,
    payload?: object,
  ) => {
    const res = await as(cookie, method, url, payload);
    if (res.statusCode >= 400) throw new Error(`${method} ${url} → ${res.statusCode} ${res.body}`);
    return res.json().data;
  };
  const uploadAs = (cookie: string, url: string, query: Record<string, string>) =>
    app.inject({
      method: "POST",
      url: `/api/v1${url}?${new URLSearchParams(query)}`,
      headers: { cookie, ...WEB, "content-type": "application/octet-stream" },
      payload: PDF,
    });
  const portalLogin = async (prefix: "portal" | "emp-portal", phone: string) => {
    const otp = await as("", "POST", `/${prefix}/auth/otp`, { phone });
    const code = otp.json().data.devCode as string | undefined;
    if (!code) return { otp, cookie: "" };
    const res = await as("", "POST", `/${prefix}/auth/verify`, { phone, code });
    return { otp, res, cookie: cookieOf(res) };
  };
  let client = "";

  beforeAll(async () => {
    partner = cookieOf(await login(PARTNER_R));
    clientId = (
      await data(partner, "POST", "/clients", { name: "عميل البوابة", phone: CLIENT_PHONE })
    ).id;
    const other = (await data(partner, "POST", "/clients", { name: "عميل آخر" })).id;
    ownCase = (
      await data(partner, "POST", "/cases", { number: "1/1", title: "قضية العميل", clientId })
    ).id;
    otherCase = (
      await data(partner, "POST", "/cases", { number: "2/2", title: "قضية غيره", clientId: other })
    ).id;
    sharedDoc = (
      await uploadAs(partner, `/cases/${ownCase}/documents`, {
        fileName: "مذكرة.pdf",
        mimeType: "application/pdf",
      })
    ).json().data.id;
    hiddenDoc = (
      await uploadAs(partner, `/cases/${ownCase}/documents`, {
        fileName: "داخلي.pdf",
        mimeType: "application/pdf",
      })
    ).json().data.id;
    await data(partner, "POST", `/documents/${sharedDoc}/share`);
    await data(partner, "POST", `/cases/${ownCase}/client-approvals`, {
      title: "عرض أتعاب",
      kind: "FEE",
      amount: 500_000,
    });
    approvalId = (await data(partner, "GET", `/cases/${ownCase}/client-approvals`))[0].id;
    ownInvoice = (
      await data(partner, "POST", "/finance/invoices", {
        clientId,
        items: [{ description: "أتعاب", unitPrice: 100_000 }],
      })
    ).id;
    otherInvoice = (
      await data(partner, "POST", "/finance/invoices", {
        clientId: other,
        items: [{ description: "أتعاب", unitPrice: 50_000 }],
      })
    ).id;
    employeeId = (
      await data(partner, "POST", "/hr/employees", {
        name: "موظف البوابة",
        phone: EMPLOYEE_PHONE,
        hireDate: "2024-01-01",
        basicSalary: 500_000,
        leaveBalanceDays: 10,
      })
    ).id;
    otherEmployeeId = (
      await data(partner, "POST", "/hr/employees", {
        name: "موظف آخر",
        hireDate: "2024-01-01",
        basicSalary: 400_000,
        leaveBalanceDays: 10,
      })
    ).id;
  });

  it("signs a client in without revealing unknown numbers, and keeps portal and staff sessions apart", async () => {
    const unknown = await as("", "POST", "/portal/auth/otp", { phone: "0500001699" });
    expect(unknown.json().data).toEqual({ sent: true });
    // A staff member is not a client: their number opens nothing here.
    expect((await as("", "POST", "/portal/auth/otp", { phone: PARTNER_R })).json().data).toEqual({
      sent: true,
    });
    const { res, cookie } = await portalLogin("portal", CLIENT_PHONE);
    expect(res!.json().data).toEqual({
      kind: "CLIENT",
      name: "عميل البوابة",
      officeName: "Office R",
    });
    expect(cookie.startsWith("murafaa_portal=")).toBe(true);
    client = cookie;
    expect((await as(client, "GET", "/cases")).statusCode).toBe(401);
    expect((await as(partner, "GET", "/portal/cases")).statusCode).toBe(401);
    expect((await as(client, "GET", "/emp-portal/me")).statusCode).toBe(401);
  });

  it("shows the client only their own cases, shared documents and invoices", async () => {
    expect((await data(client, "GET", "/portal/cases")).map((c: { id: string }) => c.id)).toEqual([
      ownCase,
    ]);
    expect((await as(client, "GET", `/portal/cases/${otherCase}`)).statusCode).toBe(404);
    const detail = await data(client, "GET", `/portal/cases/${ownCase}`);
    expect(detail.documents.map((d: { id: string }) => d.id)).toEqual([sharedDoc]);
    expect(detail).not.toHaveProperty("fees");
    expect((await as(client, "GET", `/portal/documents/${sharedDoc}/download`)).statusCode).toBe(
      200,
    );
    expect((await as(client, "GET", `/portal/documents/${hiddenDoc}/download`)).statusCode).toBe(
      404,
    );
    const invoices = await data(client, "GET", "/portal/invoices");
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({ total: 115_000, status: "DUE" });
  });

  it("prints the client's own tax invoice only, once the office has a VAT number", async () => {
    const early = await as(client, "GET", `/portal/invoices/${ownInvoice}/pdf`);
    expect(early.statusCode).toBe(409);
    expect(early.json().error.messageKey).toBe("errors.TAX_PROFILE_MISSING");
    await data(partner, "PUT", "/offices/tax-profile", { vatNumber: "310122393500003" });
    pdfStub.html.length = 0;
    const own = await as(client, "GET", `/portal/invoices/${ownInvoice}/pdf`);
    expect(own.statusCode).toBe(200);
    expect(own.headers["content-type"]).toContain("application/pdf");
    expect(pdfStub.html[0]).toContain("عميل البوابة");
    expect((await as(client, "GET", `/portal/invoices/${otherInvoice}/pdf`)).statusCode).toBe(404);
    expect(pdfStub.html).toHaveLength(1);
    expect((await as(partner, "GET", `/portal/invoices/${ownInvoice}/pdf`)).statusCode).toBe(401);
  });

  it("lets the client write to the chat, send a file and decide an approval once", async () => {
    await data(client, "POST", `/portal/cases/${ownCase}/messages`, { body: "متى الجلسة؟" });
    expect(
      (await as(client, "POST", `/portal/cases/${otherCase}/messages`, { body: "x" })).statusCode,
    ).toBe(404);
    const chat = await data(partner, "GET", `/cases/${ownCase}/messages`);
    expect(chat.at(-1)).toMatchObject({ senderType: "CLIENT", body: "متى الجلسة؟" });

    const up = await uploadAs(client, `/portal/cases/${ownCase}/documents`, {
      fileName: "هوية.pdf",
      mimeType: "application/pdf",
    });
    expect(up.statusCode).toBe(201);
    const staffDocs = await data(partner, "GET", `/cases/${ownCase}/documents`);
    expect(staffDocs.find((d: { id: string }) => d.id === up.json().data.id)).toMatchObject({
      source: "CLIENT",
    });
    const fake = await app.inject({
      method: "POST",
      url: `/api/v1/portal/cases/${ownCase}/documents?${new URLSearchParams({ fileName: "x.pdf", mimeType: "application/pdf" })}`,
      headers: { cookie: client, ...WEB, "content-type": "application/octet-stream" },
      payload: Buffer.from("not a pdf"),
    });
    expect(fake.statusCode).toBe(400);

    await data(client, "POST", `/portal/cases/${ownCase}/approvals/${approvalId}/decide`, {
      approve: true,
      note: "موافق",
    });
    const again = await as(
      client,
      "POST",
      `/portal/cases/${ownCase}/approvals/${approvalId}/decide`,
      { approve: false },
    );
    expect(again.json().error.messageKey).toBe("errors.APPROVAL_ALREADY_DECIDED");
    expect((await data(partner, "GET", `/cases/${ownCase}/client-approvals`))[0]).toMatchObject({
      status: "APPROVED",
      decisionNote: "موافق",
    });
  });

  it("ends the client's access at once when the office deactivates them, and on sign-out", async () => {
    await data(partner, "PATCH", `/clients/${clientId}`, { status: "INACTIVE" });
    expect((await as(client, "GET", "/portal/me")).statusCode).toBe(401);
    await data(partner, "PATCH", `/clients/${clientId}`, { status: "ACTIVE" });
    expect((await as(client, "GET", "/portal/me")).statusCode).toBe(200);
    await data(client, "POST", "/portal/auth/logout");
    expect((await as(client, "GET", "/portal/me")).statusCode).toBe(401);
  });

  it("lets an employee see their profile and file requests that HR then sees", async () => {
    const { cookie } = await portalLogin("emp-portal", EMPLOYEE_PHONE);
    expect(cookie.startsWith("murafaa_emp_portal=")).toBe(true);
    const profile = await data(cookie, "GET", "/emp-portal/profile");
    expect(profile).toEqual({
      id: employeeId,
      name: "موظف البوابة",
      jobTitle: null,
      department: null,
      leaveBalanceDays: 10,
      performanceScore: null,
    });
    const missing = await as(cookie, "POST", "/emp-portal/requests", { kind: "LEAVE" });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().error.details[0].message).toBe("hr.err.LEAVE_REQUEST_MISSING_DAYS");
    await data(cookie, "POST", "/emp-portal/requests", { kind: "LEAVE", days: 3, detail: "إجازة" });
    expect(await data(cookie, "GET", "/emp-portal/requests")).toMatchObject([
      { kind: "LEAVE", days: 3, status: "SUBMITTED" },
    ]);
    expect((await data(partner, "GET", "/hr/requests"))[0]).toMatchObject({
      employeeName: "موظف البوابة",
      kind: "LEAVE",
    });
    expect((await as(cookie, "GET", "/portal/cases")).statusCode).toBe(401);

    const day = new Date().toISOString().slice(0, 10);
    await data(partner, "POST", "/hr/leaves", { employeeId, days: 2, startDate: day });
    await data(partner, "POST", "/hr/leaves", {
      employeeId: otherEmployeeId,
      days: 1,
      startDate: day,
    });
    await data(partner, "POST", "/hr/advances", { employeeId, amount: 300_000, months: 3 });
    await data(partner, "POST", "/hr/advances", { employeeId: otherEmployeeId, amount: 100_000 });
    expect(await data(cookie, "GET", "/emp-portal/leaves")).toMatchObject([
      { employeeId, type: "ANNUAL", days: 2 },
    ]);
    expect(await data(cookie, "GET", "/emp-portal/advances")).toMatchObject([
      { employeeId, amount: 300_000, monthlyDue: 100_000, remaining: 300_000 },
    ]);
    await data(partner, "POST", `/hr/employees/${employeeId}/terminate`);
    expect((await as(cookie, "GET", "/emp-portal/profile")).statusCode).toBe(401);
  });
});

describe("platform admin: offices from one place, counts only, suspended = read-only", () => {
  const WEB = { origin: "http://localhost:3000" };
  const ADMIN_PHONE = "0500001701";
  const NEW_PARTNER = "0500001702";
  const NEW_CLIENT = "0500001703";
  const OTHER_PARTNER = "0500001704";
  let admin = "";
  let other = "";
  let officeId = "";
  let partner = "";
  let portal = "";
  let caseId = "";
  const as = (
    cookie: string,
    method: "GET" | "POST" | "PUT" | "PATCH",
    url: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      headers: { cookie, ...WEB },
      ...(payload ? { payload } : {}),
    });
  const data = async (
    cookie: string,
    method: "GET" | "POST" | "PUT" | "PATCH",
    url: string,
    payload?: object,
  ) => {
    const res = await as(cookie, method, url, payload);
    if (res.statusCode >= 400) throw new Error(`${method} ${url} → ${res.statusCode} ${res.body}`);
    return res.json().data;
  };
  const ownerQuery = async <T>(q: (sql: postgres.Sql) => Promise<T>) => {
    const owner = postgres(OWNER_URL, { max: 1 });
    try {
      return await q(owner);
    } finally {
      await owner.end();
    }
  };

  beforeAll(async () => {
    const h = createDb(APP_URL, { max: 1 });
    try {
      await withPlatform(h.db, (tx) =>
        tx.insert(platformAdmins).values({
          name: "نورة — فريق مُرافعة",
          phone: "+966500001701",
          totpSecretEnc: encryptSecret(ENCRYPTION_KEY, TOTP_SECRET),
        }),
      );
    } finally {
      await h.close();
    }
  });

  it("signs a platform admin in with OTP plus authenticator, and keeps the layers apart", async () => {
    const otp = await as("", "POST", "/platform/auth/otp", { phone: ADMIN_PHONE });
    const code = otp.json().data.devCode as string;
    const noTotp = await as("", "POST", "/platform/auth/verify", {
      phone: ADMIN_PHONE,
      code,
      totp: "000000",
    });
    expect(noTotp.json().error.code).toBe("TOTP_INVALID");
    const ok = await as("", "POST", "/platform/auth/verify", {
      phone: ADMIN_PHONE,
      code,
      totp: totpCode(TOTP_SECRET),
    });
    expect(ok.json().data).toEqual({ name: "نورة — فريق مُرافعة" });
    admin = cookieOf(ok);
    expect(admin.startsWith("murafaa_platform=")).toBe(true);
    // A staff number is not a platform admin: same answer, nothing sent.
    expect((await as("", "POST", "/platform/auth/otp", { phone: PARTNER_A })).json().data).toEqual({
      sent: true,
    });
    expect((await as(admin, "GET", "/cases")).statusCode).toBe(401);
    expect((await as(admin, "GET", "/portal/cases")).statusCode).toBe(401);
    expect((await as("", "GET", "/platform/offices")).statusCode).toBe(401);
  });

  it("creates an office with its permission matrix and first partner; a phone of another office is refused", async () => {
    const dup = await as(admin, "POST", "/platform/offices", {
      name: "مكتب مكرر",
      ownerName: "شريك",
      ownerPhone: PARTNER_R,
      status: "ACTIVE",
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.messageKey).toBe("errors.PHONE_IN_OTHER_OFFICE");
    const noEnd = await as(admin, "POST", "/platform/offices", {
      name: "مكتب تجريبي",
      ownerName: "شريك",
      ownerPhone: NEW_PARTNER,
      status: "TRIAL",
    });
    expect(noEnd.statusCode).toBe(400);

    officeId = (
      await data(admin, "POST", "/platform/offices", {
        name: "مكتب الميزان",
        city: "الدمام",
        crNumber: "2050123456",
        ownerName: "هند الزهراني",
        ownerPhone: NEW_PARTNER,
        status: "TRIAL",
        trialEndsAt: "2026-12-31",
      })
    ).id;
    partner = cookieOf(await login(NEW_PARTNER));
    // An office session never reaches the platform.
    expect((await as(partner, "GET", "/platform/offices")).statusCode).toBe(401);
    await data(admin, "POST", "/platform/offices", {
      name: "مكتب آخر",
      ownerName: "شريك آخر",
      ownerPhone: OTHER_PARTNER,
      status: "ACTIVE",
      paidUntil: "2027-06-30",
    });
    other = cookieOf(await login(OTHER_PARTNER));
    expect((await data(partner, "GET", "/cases")).items ?? []).toHaveLength(0);
    const client = await data(partner, "POST", "/clients", {
      name: "عميل الميزان",
      phone: NEW_CLIENT,
    });
    caseId = (
      await data(partner, "POST", "/cases", { number: "9/9", title: "سرية", clientId: client.id })
    ).id;

    // HR can't hand a phone of another office to a new login either.
    const emp = await data(partner, "POST", "/hr/employees", {
      name: "موظف",
      hireDate: "2024-01-01",
      basicSalary: 300_000,
    });
    const grant = await as(partner, "POST", `/hr/employees/${emp.id}/account`, {
      phone: PARTNER_A,
      role: "LAWYER",
    });
    expect(grant.statusCode).toBe(409);
    expect(grant.json().error.messageKey).toBe("errors.PHONE_IN_OTHER_OFFICE");
  });

  it("lists offices with counts only, never their content", async () => {
    const res = await as(admin, "GET", "/platform/offices");
    expect(res.statusCode).toBe(200);
    const mine = res.json().data.find((o: { id: string }) => o.id === officeId);
    expect(mine).toMatchObject({
      name: "مكتب الميزان",
      status: "TRIAL",
      trialEndsAt: "2026-12-31",
      users: 1,
      cases: 1,
      clients: 1,
      ownerName: "هند الزهراني",
    });
    // Case titles and client names of any office never leave through the platform.
    for (const secret of ["سرية", "عميل الميزان", "قضية العميل", "عميل البوابة"])
      expect(res.body).not.toContain(secret);
    const detail = await data(admin, "GET", `/platform/offices/${officeId}`);
    expect(detail.staff).toEqual([
      expect.objectContaining({ name: "هند الزهراني", role: "PARTNER", isActive: true }),
    ]);
    expect(JSON.stringify(detail)).not.toContain("سرية");
  });

  it("makes a suspended office read-only for staff and portals, until reactivated", async () => {
    const otp = await as("", "POST", "/portal/auth/otp", { phone: NEW_CLIENT });
    const verified = await as("", "POST", "/portal/auth/verify", {
      phone: NEW_CLIENT,
      code: otp.json().data.devCode,
    });
    portal = cookieOf(verified);

    await data(admin, "PATCH", `/platform/offices/${officeId}`, {
      status: "SUSPENDED",
      paidUntil: null,
    });
    expect((await as(partner, "GET", `/cases/${caseId}`)).statusCode).toBe(200);
    const write = await as(partner, "POST", "/clients", { name: "جديد" });
    expect(write.statusCode).toBe(403);
    expect(write.json().error.messageKey).toBe("errors.OFFICE_SUSPENDED");
    expect((await as(portal, "GET", `/portal/cases/${caseId}`)).statusCode).toBe(200);
    const msg = await as(portal, "POST", `/portal/cases/${caseId}/messages`, { body: "مرحبا" });
    expect(msg.json().error.messageKey).toBe("errors.OFFICE_SUSPENDED");
    // Other offices are untouched.
    expect((await as(other, "POST", "/clients", { name: "عميل المكتب الآخر" })).statusCode).toBe(
      201,
    );

    await data(admin, "PATCH", `/platform/offices/${officeId}`, {
      status: "ACTIVE",
      paidUntil: "2027-01-31",
    });
    expect((await as(partner, "POST", "/clients", { name: "جديد" })).statusCode).toBe(201);
    expect(
      (await data(admin, "GET", "/platform/offices")).find(
        (o: { id: string }) => o.id === officeId,
      ),
    ).toMatchObject({ status: "ACTIVE", paidUntil: "2027-01-31", suspendedAt: null });

    const actions = (await data(admin, "GET", "/platform/audit")).map(
      (a: { action: string }) => a.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining([
        "platform.office.create",
        "platform.office.suspend",
        "platform.office.reactivate",
        "platform.login",
      ]),
    );
    const officeAudit = await ownerQuery(
      (sql) =>
        sql`select action from audit_log where office_id = ${officeId} and action like 'platform.%' order by created_at`,
    );
    expect(officeAudit.map((r) => r.action)).toEqual([
      "platform.office.create",
      "platform.office.suspend",
      "platform.office.reactivate",
    ]);
  });

  it("ends the platform session on sign-out", async () => {
    await data(admin, "POST", "/platform/auth/logout");
    expect((await as(admin, "GET", "/platform/me")).statusCode).toBe(401);
  });
});
