import { Injectable } from "@nestjs/common";
import { type OfficePolicy, seedPolicy } from "@murafaa/auth";

/**
 * Resolves an office's permission policy. Until the editable permission tables
 * land, every office uses the docs/04 seed. When they do, load from the DB per
 * request (or behind a cache invalidated across instances), never a
 * process-local cache that other Cloud Run instances can't see.
 */
@Injectable()
export class PolicyService {
  private readonly seed = seedPolicy();

  async forOffice(_officeId: string): Promise<OfficePolicy> {
    return this.seed;
  }
}
