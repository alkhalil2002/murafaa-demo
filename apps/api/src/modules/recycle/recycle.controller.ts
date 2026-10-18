import { Controller, Get } from "@nestjs/common";
import { recycleBin } from "@murafaa/contracts";
import { Authenticated } from "../../common/permissions/permission.decorators.js";
import { ZodResponse } from "../../common/zod/zod.decorators.js";

/**
 * Recycle bin (legacy settings → سلة المحذوفات): soft-deleted cases, leads,
 * documents and employees. Each kind is added here when its module is rebuilt
 * (M2/M3/M6), filtered by that module's view permission — legacy listed every
 * kind to every user. Restore needs the module's edit level; purge is
 * partner-only and needs a hard-delete path the app role doesn't have yet.
 */
@Controller("recycle")
export class RecycleController {
  @Authenticated()
  @Get()
  @ZodResponse(recycleBin)
  list(): never[] {
    return [];
  }
}
