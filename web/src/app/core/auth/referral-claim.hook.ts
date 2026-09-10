import { inject, Injectable } from '@angular/core';
import { PostAuthHook, type User } from '@pu-auth/auth';

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
 */
@Injectable()
export class ReferralClaimHook implements PostAuthHook {
  private readonly referral = inject(ReferralService);
  private readonly callables = inject(CallableFunctionsService);

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
