import { Controller, Get } from "@nestjs/common";
import { type Office, office } from "@murafaa/contracts";
import { Authenticated } from "../../common/permissions/permission.decorators.js";
import { ZodResponse } from "../../common/zod/zod.decorators.js";
import { OfficesService } from "./offices.service.js";

@Controller("offices")
export class OfficesController {
  constructor(private readonly offices: OfficesService) {}

  @Authenticated()
  @Get("current")
  @ZodResponse(office)
  current(): Promise<Office> {
    return this.offices.current();
  }
}
