import { purgeUserData, type PurgeDeps, type PurgeResult } from './purge';

export interface AuthDeleter {
  deleteUser(uid: string): Promise<void>;
}

export interface DeleteAccountDeps extends PurgeDeps {
  readonly auth: AuthDeleter;
}

/**
 * Firebase itself refuses a client-side account deletion when the sign-in
 * is older than five minutes (`auth/requires-recent-login`). The callable
 * runs with Admin rights, so it re-applies the same rule on the token's
 * `auth_time` — a stolen, hours-old ID token must not be enough.
 */
export const RECENT_LOGIN_WINDOW_SEC = 5 * 60;

/**
 * Whether the caller may delete their account right now. Guests are
 * exempt from the recent-login rule: an anonymous account cannot sign in
 * again, so the rule would lock its data in for good.
 */
export function mayDeleteOwnAccount(
  token: { auth_time?: unknown; firebase?: { sign_in_provider?: unknown } },
  nowMs: number
): boolean {
  if (token.firebase?.sign_in_provider === 'anonymous') return true;
  return isRecentLogin(token.auth_time, nowMs);
}

export function isRecentLogin(authTimeSec: unknown, nowMs: number): boolean {
  if (typeof authTimeSec !== 'number' || !Number.isFinite(authTimeSec)) {
    return false;
  }
  return nowMs / 1000 - authTimeSec <= RECENT_LOGIN_WINDOW_SEC;
}

function isUserNotFound(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === 'auth/user-not-found';
}

/**
 * Purges the data first and deletes the Auth user last: if anything fails,
 * the account still exists and the user (or admin) can simply try again.
 * The purge's tombstone expires on its own, so a surviving account gets its
 * normal entry-trigger behaviour back.
 */
export async function deleteAccountWithData(
  deps: DeleteAccountDeps,
  uid: string
): Promise<PurgeResult> {
  const result = await purgeUserData(deps, uid);
  try {
    await deps.auth.deleteUser(uid);
  } catch (err) {
    if (isUserNotFound(err)) return result;
    throw err;
  }
  return result;
}
