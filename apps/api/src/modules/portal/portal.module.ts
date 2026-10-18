import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { CasesModule } from "../cases/cases.module.js";
import { DocumentsModule } from "../documents/documents.module.js";
import { FinanceModule } from "../finance/finance.module.js";
import { HrModule } from "../hr/hr.module.js";
import { PortalAuthService } from "./portal-auth.service.js";
import { ClientPortalController, EmployeePortalController } from "./portal.controller.js";
import { PortalSessionService } from "./portal-session.service.js";

/**
 * The client and employee portals: sign-in and sessions here; each owning
 * module (cases, documents, finance, HR) answers only for the one client or
 * employee signed in.
 */
@Module({
  imports: [AuthModule, CasesModule, DocumentsModule, FinanceModule, HrModule],
  controllers: [ClientPortalController, EmployeePortalController],
  providers: [PortalAuthService, PortalSessionService],
  exports: [PortalSessionService],
})
export class PortalModule {}
