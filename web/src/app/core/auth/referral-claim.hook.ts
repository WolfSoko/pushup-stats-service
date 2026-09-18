import { effect, inject, Injectable, Injector } from '@angular/core';
import { AuthStore, PostAuthHook, type User } from '@pu-auth/auth';

import { CallableFunctionsService } from '../../admin/callable-functions.service';
import { FriendInviteApiService } from '../friend-invite-api.service';
import { FriendInviteService } from '../friend-invite.service';
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
 * A shared link carries two things: `?ref=` attributes the signup, and
 * `?fi=` is the invite token that turns the link into a friend request
 * from whoever sent it. They are redeemed independently because they
 * expire differently — the referral only counts inside the account's
 * first week, the token works for an existing account too.
 *
 * Runs on every sign-in, not just the first — the callables decide
 * whether a claim still counts. Whatever the verdict, the pending values
 * are dropped afterwards: retrying forever would mean every later login
 * re-asks a question the server already answered.
 */
@Injectable()
export class ReferralClaimHook implements PostAuthHook {
  private readonly referral = inject(ReferralService);
  private readonly friendInvite = inject(FriendInviteService);
  private readonly inviteApi = inject(FriendInviteApiService);
  private readonly callables = inject(CallableFunctionsService);
  private readonly injector = inject(Injector);

  /**
   * What is already on its way, so the post-auth hook and the effect
   * below never claim the same value twice.
   */
  private claiming: string | null = null;
  private claimingInvite: string | null = null;

  constructor() {
    // A restored session never runs the post-auth hooks, so an invitation
    // captured there had nobody to claim it: the user's own link left the
    // "X hat dich eingeladen" banner on their pages for good, and a
    // friend's link did nothing at all until the next sign-in. Read
    // lazily: `AuthStore` depends on the `AuthService` that constructs
    // this hook, so injecting it as a field would close a DI cycle.
    effect(() => {
      const user = this.injector.get(AuthStore, null)?.user();
      const pending = this.referral.pending();
      const token = this.friendInvite.pending();
      if (!user) return;
      if (pending === user.uid) this.referral.clear();
      // A guest has not joined yet. `signInAnonymously` deliberately runs
      // no post-auth hooks so the invitation survives until they upgrade
      // — claiming (and therefore dropping) it here would undo that.
      if (user.isAnonymous) return;
      if (pending && pending !== user.uid) void this.claim(pending);
      if (token) void this.claimInvite(token);
    });
  }

  async onAuthenticated(user: User): Promise<void> {
    const referrerUid = this.referral.pending();
    const token = this.friendInvite.pending();
    // Own link: nothing to attribute, and no need to bother the server.
    if (referrerUid === user.uid) this.referral.clear();
    else if (referrerUid) await this.claim(referrerUid);
    if (token) await this.claimInvite(token);
  }

  private async claim(referrerUid: string): Promise<void> {
    if (this.claiming === referrerUid) return;
    this.claiming = referrerUid;
    try {
      await this.claimReferral(referrerUid);
    } finally {
      this.referral.clear();
    }
  }

  /**
   * The friend request the same link implies, redeemed from its own
   * token. Independent of the referral above: that one attributes a
   * signup and expires with the account's first week, this one works for
   * an existing account too. A fresh signup redeems both — `claimReferral`
   * opens the friendship itself, and the server then refuses this one as
   * already pending, which costs a round trip and nothing else.
   */
  private async claimInvite(token: string): Promise<void> {
    if (this.claimingInvite === token) return;
    this.claimingInvite = token;
    try {
      await this.inviteApi.claim(token);
    } catch {
      // Same reasoning as the referral: the friends page still has the
      // "Freund hinzufügen" button if this never lands.
    } finally {
      this.friendInvite.clear();
    }
  }

  private async claimReferral(referrerUid: string): Promise<void> {
    try {
      await this.callables.call<{ referrerUid: string }, ClaimResponse>(
        'claimReferral'
      )({ referrerUid });
    } catch {
      // An invitation is a nice-to-have; a failed claim must never leave
      // the user staring at an error after a successful login.
    }
  }
}
