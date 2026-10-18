import { Module } from "@nestjs/common";
import { BillingController, BillingService } from "./billing.controller.js";

@Module({ controllers: [BillingController], providers: [BillingService] })
export class BillingModule {}
