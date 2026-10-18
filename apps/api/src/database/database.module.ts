import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { createDb, type Db, type DbHandle } from "@murafaa/database";
import { ENV, type Env } from "../config/env.js";
import { DB, DB_HANDLE } from "./database.tokens.js";
import { TenantDb } from "./tenant-db.service.js";

@Global()
@Module({
  providers: [
    {
      provide: DB_HANDLE,
      inject: [ENV],
      useFactory: (env: Env): DbHandle => createDb(env.DATABASE_URL),
    },
    { provide: DB, inject: [DB_HANDLE], useFactory: (h: DbHandle): Db => h.db },
    TenantDb,
  ],
  exports: [DB, TenantDb],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DB_HANDLE) private readonly handle: DbHandle) {}

  async onApplicationShutdown(): Promise<void> {
    await this.handle.close();
  }
}
