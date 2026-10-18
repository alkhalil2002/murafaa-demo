import { Module } from "@nestjs/common";
import { PermissionsController } from "./permissions.controller.js";
import { PermissionsService } from "./permissions.service.js";

@Module({ controllers: [PermissionsController], providers: [PermissionsService] })
export class PermissionsModule {}
