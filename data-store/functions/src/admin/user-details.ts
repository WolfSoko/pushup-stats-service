/**
 * Admin per-user detail projection — pure helpers. The `adminGetUserDetails`
 * callable (in `functions-admin-user-details.ts`) owns the Firestore/Auth I/O
 * and feeds the raw docs through these; keeping the shaping pure makes the
 * publicProfile / active-plan extraction unit-testable without the Admin SDK.
 */

export interface AdminActivePlan {
  planId: string;
  /** ISO date (YYYY-MM-DD) the user started the plan, when stored. */
  startDate: string | null;
}

export interface AdminUserDetails {
  uid: string;
  displayName: string | null;
  email: string | null;
  anonymous: boolean;
  role: string | null;
  /** Account creation time (from Auth metadata). */
  createdAt: string | null;
  entryCount: number;
  lastEntry: string | null;
  /** `true` only when the user has explicitly opted into a public profile. */
  publicProfile: boolean;
  /** The currently active training plan, or `null` when none is active. */
  activePlan: AdminActivePlan | null;
}

/** Validates the `adminGetUserDetails` payload: a single non-empty `uid`. */
export function validateGetUserDetailsPayload(
  data: unknown
): { valid: true; uid: string } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'payload must be an object' };
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.uid !== 'string' || obj.uid.trim().length === 0) {
    return { valid: false, error: 'uid missing or empty' };
  }
  return { valid: true, uid: obj.uid.trim() };
}

/**
 * `true` iff the `userConfigs/{uid}` doc has opted into a public profile
 * (`ui.publicProfile === true`). Mirrors `isPublicProfileAllowed` — anything
 * else (missing config, missing flag, non-boolean) is treated as private.
 */
export function readPublicProfile(config: unknown): boolean {
  if (!config || typeof config !== 'object') return false;
  const ui = (config as Record<string, unknown>).ui;
  if (!ui || typeof ui !== 'object') return false;
  return (ui as Record<string, unknown>).publicProfile === true;
}

/**
 * Project a `userTrainingPlans/{uid}` doc to {@link AdminActivePlan}, or
 * `null` when there is no *active* plan. A completed/abandoned plan doc still
 * exists (it's a single overwritten doc per user), so the `status === 'active'`
 * check matters — otherwise the header would show a stale finished plan.
 */
export function readActivePlan(doc: unknown): AdminActivePlan | null {
  if (!doc || typeof doc !== 'object') return null;
  const obj = doc as Record<string, unknown>;
  const planId = typeof obj.planId === 'string' ? obj.planId : '';
  if (obj.status !== 'active' || planId.length === 0) return null;
  return {
    planId,
    startDate: typeof obj.startDate === 'string' ? obj.startDate : null,
  };
}
