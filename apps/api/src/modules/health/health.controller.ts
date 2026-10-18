import { Controller, Get, Inject } from "@nestjs/common";
import { type HealthResponse, healthResponse } from "@murafaa/contracts";
import { type Db } from "@murafaa/database";
import { sql } from "drizzle-orm";
import { Public } from "../../common/permissions/permission.decorators.js";
import { ZodResponse } from "../../common/zod/zod.decorators.js";
import { ENV, type Env } from "../../config/env.js";
import { DB } from "../../database/database.tokens.js";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Get()
  @ZodResponse(healthResponse)
  async check(): Promise<HealthResponse> {
    const db = await this.db.execute(sql`select 1`).then(
      () => "up" as const,
      () => "down" as const,
    );
    return { status: db === "up" ? "ok" : "degraded", db, version: this.env.APP_VERSION };
  }
}
