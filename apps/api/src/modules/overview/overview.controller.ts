import { Controller, Get, Req } from "@nestjs/common";
import { PermModule } from "@murafaa/auth";
import {
  activityFeed,
  activityQuery,
  alertList,
  dashboardSummary,
  deadlineList,
  ErrorCode,
  journeySummary,
  notificationCount,
  notificationList,
  searchQuery,
  searchResults,
  todaySummary,
} from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import {
  Authenticated,
  RequirePermission,
} from "../../common/permissions/permission.decorators.js";
import { ZodQuery, ZodResponse } from "../../common/zod/zod.decorators.js";
import { DeadlinesService } from "../cases/deadlines.service.js";
import { OverviewService } from "./overview.service.js";

function principal(req: FastifyRequest) {
  if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
  return req.principal;
}

/** Office-wide read views. Each section inside is also gated by its own module. */
@Controller()
export class OverviewController {
  constructor(
    private readonly overview: OverviewService,
    private readonly deadlines: DeadlinesService,
  ) {}

  /** Every role lands here; sections it may not see come back hidden. */
  @Authenticated()
  @Get("today")
  @ZodResponse(todaySummary)
  today(@Req() req: FastifyRequest) {
    return this.overview.today(principal(req));
  }

  @RequirePermission(PermModule.APPOINTMENTS, "view")
  @Get("deadlines")
  @ZodResponse(deadlineList)
  listDeadlines(@Req() req: FastifyRequest) {
    return this.deadlines.list(principal(req));
  }

  @RequirePermission(PermModule.ALERTS, "view")
  @Get("alerts")
  @ZodResponse(alertList)
  alerts(@Req() req: FastifyRequest) {
    return this.overview.alerts(principal(req));
  }

  @Authenticated()
  @Get("notifications")
  @ZodResponse(notificationList)
  notifications(@Req() req: FastifyRequest) {
    return this.overview.notifications(principal(req));
  }

  @Authenticated()
  @Get("notifications/count")
  @ZodResponse(notificationCount)
  async notificationCount(@Req() req: FastifyRequest) {
    return { count: (await this.overview.notifications(principal(req))).length };
  }

  @Authenticated()
  @Get("search")
  @ZodResponse(searchResults)
  search(@ZodQuery(searchQuery) query: z.infer<typeof searchQuery>, @Req() req: FastifyRequest) {
    return this.overview.search(principal(req), query.q);
  }

  @RequirePermission(PermModule.REPORTS, "view")
  @Get("dashboard")
  @ZodResponse(dashboardSummary)
  dashboard(@Req() req: FastifyRequest) {
    return this.overview.dashboard(principal(req));
  }

  @RequirePermission(PermModule.REPORTS, "view")
  @Get("journey")
  @ZodResponse(journeySummary)
  journey(@Req() req: FastifyRequest) {
    return this.overview.journey(principal(req));
  }

  @RequirePermission(PermModule.REPORTS, "view")
  @Get("activity")
  @ZodResponse(activityFeed)
  activity(@ZodQuery(activityQuery) query: z.infer<typeof activityQuery>) {
    return this.overview.activity(query);
  }
}
