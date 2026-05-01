import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { type PublicProfile } from '@pu-stats/models';

/**
 * Thin wrapper around the `getPublicProfile` callable Cloud Function.
 *
 * The function is intentionally invokable without auth: it powers the
 * `/u/:uid` public route and the dynamic OG image endpoint. Privacy is
 * enforced server-side — only users with `ui.publicProfile === true` get
 * a projection back; everyone else surfaces as `not-found`.
 */
@Injectable({ providedIn: 'root' })
export class PublicProfileApiService {
  private readonly functions = inject(Functions);

  /**
   * Fetches the public profile projection. Returns `null` when the requested
   * user does not exist or has not opted in — callers MUST treat both as a
   * 404 to avoid leaking account existence.
   */
  async getProfile(uid: string): Promise<PublicProfile | null> {
    const callable = httpsCallable<{ uid: string }, PublicProfile>(
      this.functions,
      'getPublicProfile'
    );
    try {
      const result = await callable({ uid });
      return result.data ?? null;
    } catch (err) {
      // Distinguish opt-out / nonexistent (treat as null) from other errors.
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }
}

function isNotFoundError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: unknown }).code;
  // FirebaseError carries `functions/not-found`; also accept the bare HttpsError code.
  return code === 'functions/not-found' || code === 'not-found';
}
