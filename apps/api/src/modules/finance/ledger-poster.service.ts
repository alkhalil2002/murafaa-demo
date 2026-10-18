import { Injectable } from "@nestjs/common";
import type { Tx } from "@murafaa/database";
import { type Posting, postJournal } from "./ledger.js";

/**
 * The finance module's door for other modules that post to the ledger (HR
 * advances and payroll): the journal stays owned by finance, the caller's
 * transaction keeps the business change and its entry atomic.
 */
@Injectable()
export class LedgerPoster {
  post(tx: Tx, officeId: string, userId: string, posting: Posting) {
    return postJournal(tx, officeId, userId, posting);
  }
}
