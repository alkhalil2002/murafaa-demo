import { Module } from "@nestjs/common";
import { DOCUMENT_STORAGE, storageFor } from "../../common/storage/storage.js";
import { ENV, type Env } from "../../config/env.js";
import { CasesModule } from "../cases/cases.module.js";
import { DocumentsController } from "./documents.controller.js";
import { DocumentsService } from "./documents.service.js";

@Module({
  imports: [CasesModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    { provide: DOCUMENT_STORAGE, useFactory: (env: Env) => storageFor(env), inject: [ENV] },
  ],
  exports: [DocumentsService, DOCUMENT_STORAGE],
})
export class DocumentsModule {}
