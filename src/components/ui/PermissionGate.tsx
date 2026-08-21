import * as React from 'react';
import type { PermModule } from '@prisma/client';
import type { AppSession } from '@/lib/auth/types';
import { canAction } from '@/lib/permissions/guard';
import type { PermAction } from '@/lib/permissions/engine';

export interface PermissionGateProps {
  session: AppSession;
  module: PermModule;
  /** Defaults to `view` — the weakest grant that justifies showing anything. */
  action?: PermAction;
  children: React.ReactNode;
  /** Rendered instead of `children` when the grant is missing. Default: nothing. */
  fallback?: React.ReactNode;
}

/**
 * Hides UI a role has no grant for.
 *
 * THIS IS NOT ENFORCEMENT. Per the permissions guardrail (docs/04), the UI
 * only hides and the server denies — every action behind this gate must still
 * call `requireModule`/`requireCaseAccess` on the server. Using this component
 * as the only check is a security bug.
 *
 * It is an async Server Component because `canAction` loads the office policy.
 * For client-side hiding, resolve the boolean on the server and pass it down.
 */
export async function PermissionGate({
  session,
  module,
  action = 'view',
  children,
  fallback = null,
}: PermissionGateProps) {
  const allowed = await canAction(session, module, action);
  return <>{allowed ? children : fallback}</>;
}
