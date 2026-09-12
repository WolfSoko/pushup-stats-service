import { effect, inject, Injectable, Injector } from '@angular/core';
import { AuthStore, PostAuthHook, type User } from '@pu-auth/auth';

import { CallableFunctionsService } from '../../admin/callable-functions.service';
import { ReferralService } from '../referral.service';

interface ClaimResponse {
  ok: boolean;
  reason?: string;
  invitedCount?: number;
}

/**
 * Hands a captured invitation to the server once the invited user has a
 * real account.
 *
 * Runs on every sign-in, not just the first — the callable is the one
 * deciding whether a claim still counts, and it refuses a second
 * attribution for the same account. Whatever the verdict, the pending
 * invitation is dropped afterwards: retrying forever would mean every
 * later login re-asks a question the server already answered.
 *
 * It also cleans up after a user who followed their own invite link while
 * already signed in — see the effect below.
 */
@Injectable()
export class ReferralClaimHook implements PostAuthHook {
  private readonly referral = inject(ReferralService);
  private readonly callables = inject(CallableFunctionsService);
  private readonly injector = inject(Injector);

  constructor() {
    // A restored session never runs the post-auth hooks, so an invitation
    // captured from the user's own link stayed pending forever — and with
    // it the "X hat dich eingeladen" banner on their own pages. Read
    // lazily: `AuthStore` depends on the `AuthService` that constructs
    // this hook, so injecting it as a field would close a DI cycle.
    effect(() => {
      const uid = this.injector.get(AuthStore, null)?.user()?.uid;
      if (uid && this.referral.pending() === uid) this.referral.clear();
    });
  }

  async onAuthenticated(user: User): Promise<void> {
    const referrerUid = this.referral.pending();
    if (!referrerUid) return;
    // Own link: nothing to claim, and no need to bother the server.
    if (referrerUid === user.uid) {
      this.referral.clear();
      return;
    }
    try {
      await this.callables.call<{ referrerUid: string }, ClaimResponse>(
        'claimReferral'
      )({ referrerUid });
    } catch {
      // An invitation is a nice-to-have; a failed claim must never leave
      // the user staring at an error after a successful login.
    } finally {
      this.referral.clear();
    }
  }
}
