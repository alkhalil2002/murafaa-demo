import { Module } from "@nestjs/common";
import { RecycleController } from "./recycle.controller.js";

@Module({ controllers: [RecycleController] })
export class RecycleModule {}
