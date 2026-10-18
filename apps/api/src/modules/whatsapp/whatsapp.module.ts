import { Module } from "@nestjs/common";
import { CasesModule } from "../cases/cases.module.js";
import { WhatsappController } from "./whatsapp.controller.js";

@Module({ imports: [CasesModule], controllers: [WhatsappController] })
export class WhatsappModule {}
