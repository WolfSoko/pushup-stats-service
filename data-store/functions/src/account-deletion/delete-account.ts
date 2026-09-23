import { purgeUserData, type PurgeDeps, type PurgeResult } from './purge';
import { DELETED_ACCOUNTS_COLLECTION } from './tombstone';

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
 * Purges the data first and deletes the Auth user last: if the purge
 * fails, the account still exists and the user (or admin) can simply try
 * again. If only the Auth deletion fails, the tombstone is withdrawn so the
 * surviving account's future entry deletions keep updating its stats.
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
    await deps.db.collection(DELETED_ACCOUNTS_COLLECTION).doc(uid).delete();
    throw err;
  }
  return result;
}
