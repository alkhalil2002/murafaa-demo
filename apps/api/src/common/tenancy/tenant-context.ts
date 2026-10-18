import { AsyncLocalStorage } from "node:async_hooks";
import type { Principal } from "./principal.js";

/** The principal for the request currently being handled, available to any service it calls. */
export const tenantContext = new AsyncLocalStorage<Principal>();
