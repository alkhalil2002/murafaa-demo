import { Controller, Get, HttpCode, Post, Put, Req } from "@nestjs/common";
import { PermModule } from "@murafaa/auth";
import {
  advanceList,
  attendanceMonth,
  attendanceMonthQuery,
  attendanceToday,
  candidateList,
  createAdvanceBody,
  createCandidateBody,
  createdCase,
  createEmployeeBody,
  createLeaveBody,
  createRequestBody,
  decideRequestBody,
  employeeDetail,
  employeeList,
  ErrorCode,
  grantAccountBody,
  idParams,
  leaveList,
  moveCandidateBody,
  orgChart,
  payrollRunDetail,
  payrollRunList,
  requestList,
  runPayrollBody,
  saudization,
  setAttendanceBody,
  updateEmployeeBody,
  wpsFile,
} from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import { RequirePermission } from "../../common/permissions/permission.decorators.js";
import { ZodBody, ZodParams, ZodQuery, ZodResponse } from "../../common/zod/zod.decorators.js";
import { EmployeesService } from "./employees.service.js";
import { PayrollService } from "./payroll.service.js";
import { RecruitmentService } from "./recruitment.service.js";
import { HrRecordsService } from "./records.service.js";

function caller(req: FastifyRequest) {
  if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
  return { p: req.principal, meta: { ip: req.ip, requestId: String(req.id) } };
}

type Id = z.infer<typeof idParams>;

/**
 * الموارد البشرية (docs/04 module HR): view reads, edit records the day-to-day
 * (employees, advances, leaves, requests, attendance, payroll, recruitment),
 * full grants system accounts and ends service.
 */
@Controller("hr")
export class HrController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly records: HrRecordsService,
    private readonly payroll: PayrollService,
    private readonly recruitment: RecruitmentService,
  ) {}

  // ── Employees ──

  @RequirePermission(PermModule.HR, "view")
  @Get("employees")
  @ZodResponse(employeeList)
  employees() {
    return this.employeesService.list();
  }

  @RequirePermission(PermModule.HR, "view")
  @Get("employees/:id")
  @ZodResponse(employeeDetail)
  employee(@ZodParams(idParams) params: Id) {
    return this.employeesService.detail(params.id);
  }

  @RequirePermission(PermModule.HR, "edit")
  @Post("employees")
  @ZodResponse(createdCase)
  createEmployee(
    @ZodBody(createEmployeeBody) body: z.infer<typeof createEmployeeBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.employeesService.create(p, body, meta);
  }

  @RequirePermission(PermModule.HR, "edit")
  @Put("employees/:id")
  @HttpCode(200)
  async updateEmployee(
    @ZodParams(idParams) params: Id,
    @ZodBody(updateEmployeeBody) body: z.infer<typeof updateEmployeeBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.employeesService.update(p, params.id, body, meta);
    return null;
  }

  @RequirePermission(PermModule.HR, "delete")
  @Post("employees/:id/account")
  @ZodResponse(createdCase)
  grantAccount(
    @ZodParams(idParams) params: Id,
    @ZodBody(grantAccountBody) body: z.infer<typeof grantAccountBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.employeesService.grantAccount(p, params.id, body, meta);
  }

  @RequirePermission(PermModule.HR, "delete")
  @Post("employees/:id/terminate")
  @HttpCode(200)
  async terminate(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    await this.employeesService.terminate(p, params.id, meta);
    return null;
  }

  @RequirePermission(PermModule.HR, "view")
  @Get("org")
  @ZodResponse(orgChart)
  org() {
    return this.employeesService.orgChart();
  }

  @RequirePermission(PermModule.HR, "view")
  @Get("saudization")
  @ZodResponse(saudization)
  saudization() {
    return this.employeesService.saudization();
  }

  // ── Advances, leaves, requests ──

  @RequirePermission(PermModule.HR, "view")
  @Get("advances")
  @ZodResponse(advanceList)
  advances() {
    return this.records.advances();
  }

  @RequirePermission(PermModule.HR, "edit")
  @Post("advances")
  @ZodResponse(createdCase)
  createAdvance(
    @ZodBody(createAdvanceBody) body: z.infer<typeof createAdvanceBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.records.createAdvance(p, body, meta);
  }

  @RequirePermission(PermModule.HR, "view")
  @Get("leaves")
  @ZodResponse(leaveList)
  leaves() {
    return this.records.leaves();
  }

  @RequirePermission(PermModule.HR, "edit")
  @Post("leaves")
  @ZodResponse(createdCase)
  createLeave(
    @ZodBody(createLeaveBody) body: z.infer<typeof createLeaveBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.records.createLeave(p, body, meta);
  }

  @RequirePermission(PermModule.HR, "view")
  @Get("requests")
  @ZodResponse(requestList)
  requests() {
    return this.records.requests();
  }

  @RequirePermission(PermModule.HR, "edit")
  @Post("requests")
  @ZodResponse(createdCase)
  createRequest(
    @ZodBody(createRequestBody) body: z.infer<typeof createRequestBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.records.createRequest(p, body, meta);
  }

  @RequirePermission(PermModule.HR, "edit")
  @Post("requests/:id/decide")
  @HttpCode(200)
  async decideRequest(
    @ZodParams(idParams) params: Id,
    @ZodBody(decideRequestBody) body: z.infer<typeof decideRequestBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.records.decideRequest(p, params.id, body, meta);
    return null;
  }

  // ── Attendance ──

  @RequirePermission(PermModule.HR, "view")
  @Get("attendance/today")
  @ZodResponse(attendanceToday)
  attendanceToday() {
    return this.records.attendanceToday();
  }

  @RequirePermission(PermModule.HR, "view")
  @Get("attendance/month")
  @ZodResponse(attendanceMonth)
  attendanceMonth(@ZodQuery(attendanceMonthQuery) query: z.infer<typeof attendanceMonthQuery>) {
    return this.records.attendanceMonth(query.month);
  }

  /** Today's status for one employee (the id is the employee's). */
  @RequirePermission(PermModule.HR, "edit")
  @Put("attendance/:id")
  @HttpCode(200)
  async setAttendance(
    @ZodParams(idParams) params: Id,
    @ZodBody(setAttendanceBody) body: z.infer<typeof setAttendanceBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.records.setAttendance(p, params.id, body.status, meta);
    return null;
  }

  @RequirePermission(PermModule.HR, "edit")
  @Post("attendance/:id/clock-out")
  @HttpCode(200)
  async clockOut(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    await this.records.clockOut(p, params.id, meta);
    return null;
  }

  // ── Payroll and WPS ──

  @RequirePermission(PermModule.HR, "view")
  @Get("payroll")
  @ZodResponse(payrollRunList)
  payrollRuns() {
    return this.payroll.list();
  }

  @RequirePermission(PermModule.HR, "edit")
  @Post("payroll")
  @ZodResponse(createdCase)
  runPayroll(
    @ZodBody(runPayrollBody) body: z.infer<typeof runPayrollBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.payroll.run(p, body, meta);
  }

  @RequirePermission(PermModule.HR, "view")
  @Get("payroll/:id")
  @ZodResponse(payrollRunDetail)
  payrollRun(@ZodParams(idParams) params: Id) {
    return this.payroll.detail(params.id);
  }

  @RequirePermission(PermModule.HR, "view")
  @Get("payroll/:id/wps")
  @ZodResponse(wpsFile)
  wps(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    return this.payroll.wps(p, params.id, meta);
  }

  // ── Recruitment ──

  @RequirePermission(PermModule.HR, "view")
  @Get("candidates")
  @ZodResponse(candidateList)
  candidates() {
    return this.recruitment.list();
  }

  @RequirePermission(PermModule.HR, "edit")
  @Post("candidates")
  @ZodResponse(createdCase)
  createCandidate(
    @ZodBody(createCandidateBody) body: z.infer<typeof createCandidateBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.recruitment.create(p, body, meta);
  }

  @RequirePermission(PermModule.HR, "edit")
  @Post("candidates/:id/move")
  @HttpCode(200)
  async moveCandidate(
    @ZodParams(idParams) params: Id,
    @ZodBody(moveCandidateBody) body: z.infer<typeof moveCandidateBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.recruitment.move(p, params.id, body.direction, meta);
    return null;
  }

  @RequirePermission(PermModule.HR, "edit")
  @Post("candidates/:id/delete")
  @HttpCode(200)
  async removeCandidate(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    await this.recruitment.remove(p, params.id, meta);
    return null;
  }
}
