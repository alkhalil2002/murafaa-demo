import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermModule, Role } from "@murafaa/auth";
import type { Db } from "@murafaa/database";
import { describe, expect, it, vi } from "vitest";
import {
  Authenticated,
  Public,
  RequirePartner,
  RequirePermission,
} from "../src/common/permissions/permission.decorators.js";
import { PermissionsGuard } from "../src/common/permissions/permissions.guard.js";
import { PolicyService } from "../src/common/permissions/policy.service.js";
import type { Principal } from "../src/common/tenancy/principal.js";
import { loadEnv } from "../src/config/env.js";

class Routes {
  @Public() open() {}
  @Authenticated() mine() {}
  @RequirePermission(PermModule.FINANCE, "view") finance() {}
  undeclared() {}
  @RequirePartner("billing.view") billing() {}
  @RequirePartner("rolePreview.start") preview() {}
  @RequirePermission(PermModule.CASES, "edit") editCase() {}
}

const OFFICE = "aaaaaaaa-0000-4000-8000-000000000001";
const principal = (role: Principal["role"], previewRole?: Principal["role"]): Principal => ({
  userId: OFFICE,
  officeId: OFFICE,
  role,
  previewRole,
});

function setup(mode: "strict" | "permissive" = "strict") {
  const transaction = vi.fn(async () => undefined);
  const db = { transaction } as unknown as Db;
  const env = loadEnv({ DATABASE_URL: "postgres://u@localhost/db", RBAC_ENFORCEMENT: mode });
  return {
    guard: new PermissionsGuard(new Reflector(), new PolicyService(), env, db),
    transaction,
  };
}

function ctx(handler: keyof Routes, who?: Principal, method = "GET"): ExecutionContext {
  const request = { principal: who, method, url: "/x", ip: "127.0.0.1", id: "req-1" };
  return {
    getHandler: () => Routes.prototype[handler],
    getClass: () => Routes,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("PermissionsGuard", () => {
  it("lets public routes through without a session", async () => {
    expect(await setup().guard.canActivate(ctx("open"))).toBe(true);
  });

  it("rejects a missing session with 401", async () => {
    await expect(setup().guard.canActivate(ctx("mine"))).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("allows authenticated-only routes for any role", async () => {
    expect(await setup().guard.canActivate(ctx("mine", principal(Role.RECEPTION)))).toBe(true);
  });

  it("enforces the module permission and audits the denial", async () => {
    const { guard, transaction } = setup();
    expect(await guard.canActivate(ctx("finance", principal(Role.ACCOUNTANT)))).toBe(true);
    await expect(
      guard.canActivate(ctx("finance", principal(Role.RECEPTION))),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("denies routes with no declared permission in strict mode (no god mode)", async () => {
    await expect(
      setup("strict").guard.canActivate(ctx("undeclared", principal(Role.PARTNER))),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(
      await setup("permissive").guard.canActivate(ctx("undeclared", principal(Role.PARTNER))),
    ).toBe(true);
  });

  it("still denies when the audit write fails", async () => {
    const { guard, transaction } = setup();
    transaction.mockRejectedValueOnce(new Error("db down"));
    await expect(guard.canActivate(ctx("finance", principal(Role.LAWYER)))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("restricts partner-only actions to partners, even with full module access", async () => {
    const { guard } = setup();
    expect(await guard.canActivate(ctx("billing", principal(Role.PARTNER)))).toBe(true);
    await expect(guard.canActivate(ctx("billing", principal(Role.ADMIN)))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("decides with the previewed role", async () => {
    const { guard } = setup();
    await expect(
      guard.canActivate(ctx("billing", principal(Role.PARTNER, Role.LAWYER))),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      guard.canActivate(ctx("finance", principal(Role.PARTNER, Role.RECEPTION))),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("makes role preview view-only: every write is blocked", async () => {
    const { guard } = setup();
    const previewing = principal(Role.PARTNER, Role.LAWYER);
    expect(await guard.canActivate(ctx("mine", previewing))).toBe(true);
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      await expect(guard.canActivate(ctx("mine", previewing, method))).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    // LAWYER may edit cases, but not while it is only being previewed.
    await expect(guard.canActivate(ctx("editCase", previewing))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await guard.canActivate(ctx("editCase", principal(Role.LAWYER), "POST"))).toBe(true);
  });

  it("still lets a previewing partner switch or end the preview", async () => {
    const { guard } = setup();
    expect(
      await guard.canActivate(ctx("preview", principal(Role.PARTNER, Role.LAWYER), "POST")),
    ).toBe(true);
  });
});
