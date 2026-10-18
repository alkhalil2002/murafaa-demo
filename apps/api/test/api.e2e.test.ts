import { createDb, runMigrations, seedOfficePolicy, withTenant } from "@murafaa/database";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import postgres from "postgres";
import { dateInDays } from "@murafaa/rules";
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

let app: NestFastifyApplication;

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
  await runMigrations(OWNER_URL);
  const owner = postgres(OWNER_URL, { max: 1 });
  await owner`truncate client_approval_requests, execution_procedures, case_executions, case_messages, client_communications, contracts, case_approvals, appointments, procedure_requests, case_reminders, tasks, hearings, conflict_flags, case_events, case_assignees, cases, leads, clients, permissions, field_permissions, role_case_scopes, sessions, otp_challenges, audit_log, outbox, users, offices cascade`;
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
  });
  app = await createApp(env);
  mountDocs(app, env);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app?.close();
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
    expect(me.office).toEqual({ id: OFFICE_A, name: "Office A" });
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
