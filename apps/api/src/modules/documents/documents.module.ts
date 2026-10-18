import { Module } from "@nestjs/common";
import { PerformanceModule } from "../performance/performance.module.js";
import { PdfClient } from "../../common/pdf/pdf.client.js";
import { DOCUMENT_STORAGE, storageFor } from "../../common/storage/storage.js";
import { ENV, type Env } from "../../config/env.js";
import { CasesModule } from "../cases/cases.module.js";
import { OfficesModule } from "../offices/offices.module.js";
import { DocumentsController } from "./documents.controller.js";
import { DocumentsService } from "./documents.service.js";

@Module({
  imports: [PerformanceModule, CasesModule, OfficesModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    PdfClient,
    { provide: DOCUMENT_STORAGE, useFactory: (env: Env) => storageFor(env), inject: [ENV] },
  ],
  exports: [DocumentsService, DOCUMENT_STORAGE],
})
export class DocumentsModule {}
