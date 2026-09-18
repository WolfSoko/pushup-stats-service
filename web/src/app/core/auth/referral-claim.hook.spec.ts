import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthStore, type User } from '@pu-auth/auth';

import { CallableFunctionsService } from '../../admin/callable-functions.service';
import { FriendInviteApiService } from '../friend-invite-api.service';
import { FriendInviteService } from '../friend-invite.service';
import { ReferralService } from '../referral.service';
import { ReferralClaimHook } from './referral-claim.hook';

describe('ReferralClaimHook', () => {
  const user = { uid: 'newcomer-1' } as User;
  const TOKEN = 'tok-AAAAAAAAAAAAAAAA';

  /** Lets the hook's in-flight claims settle before anything is asserted. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  function setup(
    options: {
      pending?: string | null;
      token?: string | null;
      signedIn?: string | null;
      isAnonymous?: boolean;
      claimReferral?: ReturnType<typeof vitest.fn>;
      claimInvite?: ReturnType<typeof vitest.fn>;
    } = {}
  ) {
    const {
      pending = null,
      token = null,
      signedIn = null,
      isAnonymous = false,
    } = options;
    const clear = vitest.fn();
    const clearInvite = vitest.fn();
    const claimReferral =
      options.claimReferral ??
      vitest.fn().mockResolvedValue({ data: { ok: true } });
    const claimInvite =
      options.claimInvite ?? vitest.fn().mockResolvedValue(true);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ReferralClaimHook,
        {
          provide: ReferralService,
          useValue: { pending: signal(pending), clear },
        },
        {
          provide: FriendInviteService,
          useValue: { pending: signal(token), clear: clearInvite },
        },
        { provide: FriendInviteApiService, useValue: { claim: claimInvite } },
        {
          provide: CallableFunctionsService,
          useValue: { call: () => claimReferral },
        },
        {
          provide: AuthStore,
          useValue: {
            user: signal(signedIn ? { uid: signedIn, isAnonymous } : null),
          },
        },
      ],
    });
    return {
      hook: TestBed.inject(ReferralClaimHook),
      claimReferral,
      claimInvite,
      clear,
      clearInvite,
    };
  }

  describe('The signup attribution', () => {
    it('should hand a pending invitation to the server', async () => {
      // given
      const { hook, claimReferral, clear } = setup({ pending: 'inviter-1' });

      // when
      await hook.onAuthenticated(user);

      // then
      expect(claimReferral).toHaveBeenCalledWith({ referrerUid: 'inviter-1' });
      expect(clear).toHaveBeenCalled();
    });

    it('should do nothing without an invitation', async () => {
      // given
      const { hook, claimReferral, claimInvite, clear } = setup();

      // when
      await hook.onAuthenticated(user);

      // then
      expect(claimReferral).not.toHaveBeenCalled();
      expect(claimInvite).not.toHaveBeenCalled();
      expect(clear).not.toHaveBeenCalled();
    });

    it('should never claim the user own link', async () => {
      // given
      const { hook, claimReferral, clear } = setup({ pending: 'newcomer-1' });

      // when
      await hook.onAuthenticated(user);

      // then
      expect(claimReferral).not.toHaveBeenCalled();
      expect(clear).toHaveBeenCalled();
    });

    it('should swallow a failed claim and stop retrying it', async () => {
      // given — a login must never fail over an invitation
      const { hook, clear } = setup({
        pending: 'inviter-1',
        claimReferral: vitest.fn().mockRejectedValue(new Error('offline')),
      });

      // when / then
      await expect(hook.onAuthenticated(user)).resolves.toBeUndefined();
      expect(clear).toHaveBeenCalled();
    });
  });

  describe('The friend request the link implies', () => {
    it('should redeem the token, not the inviter uid', async () => {
      // given — the uid is public, so it could never prove the inviter
      // meant this person; the token is what does
      const { hook, claimInvite, clearInvite } = setup({
        pending: 'inviter-1',
        token: TOKEN,
      });

      // when
      await hook.onAuthenticated(user);

      // then
      expect(claimInvite).toHaveBeenCalledWith(TOKEN);
      expect(clearInvite).toHaveBeenCalled();
    });

    it('should redeem it for an account past the referral window', async () => {
      // given — the whole point: an existing user following a friend's
      // link is 'too-late' for the referral and used to get nothing
      const { hook, claimInvite } = setup({
        pending: 'inviter-1',
        token: TOKEN,
        claimReferral: vitest
          .fn()
          .mockResolvedValue({ data: { ok: false, reason: 'too-late' } }),
      });

      // when
      await hook.onAuthenticated(user);

      // then
      expect(claimInvite).toHaveBeenCalledWith(TOKEN);
    });

    it('should redeem a token even without a referral to attribute', async () => {
      // given — a link whose `?ref=` was already claimed on this account
      const { hook, claimReferral, claimInvite } = setup({ token: TOKEN });

      // when
      await hook.onAuthenticated(user);

      // then
      expect(claimReferral).not.toHaveBeenCalled();
      expect(claimInvite).toHaveBeenCalledWith(TOKEN);
    });

    it('should swallow a failed redemption', async () => {
      // given
      const { hook, clearInvite } = setup({
        token: TOKEN,
        claimInvite: vitest.fn().mockRejectedValue(new Error('offline')),
      });

      // when / then
      await expect(hook.onAuthenticated(user)).resolves.toBeUndefined();
      expect(clearInvite).toHaveBeenCalled();
    });
  });

  describe('Following an invite link while already signed in', () => {
    it('should drop the user own invitation without waiting for the next sign-in', async () => {
      // given — a restored session never runs the post-auth hooks, so the
      // banner sat on the user's own pages for good
      const { clear } = setup({ pending: 'wolf-1', signedIn: 'wolf-1' });

      // when the effect sees the signed-in user
      TestBed.tick();

      // then
      expect(clear).toHaveBeenCalled();
    });

    it('should redeem a friend token right away', async () => {
      // given — no sign-in is coming; the session is already restored
      const { claimInvite, clearInvite } = setup({
        token: TOKEN,
        signedIn: 'wolf-1',
      });

      // when
      TestBed.tick();
      await settle();

      // then
      expect(claimInvite).toHaveBeenCalledWith(TOKEN);
      expect(clearInvite).toHaveBeenCalled();
    });

    it('should redeem it only once when the sign-in hook runs too', async () => {
      // given
      const { hook, claimInvite } = setup({
        token: TOKEN,
        signedIn: 'wolf-1',
      });

      // when both paths fire for the same token
      TestBed.tick();
      await hook.onAuthenticated({ uid: 'wolf-1' } as User);
      await settle();

      // then
      expect(claimInvite).toHaveBeenCalledTimes(1);
    });

    it('should do nothing while nobody is signed in', async () => {
      // given
      const { claimReferral, claimInvite, clear } = setup({
        pending: 'inviter-1',
        token: TOKEN,
      });

      // when
      TestBed.tick();
      await settle();

      // then
      expect(claimReferral).not.toHaveBeenCalled();
      expect(claimInvite).not.toHaveBeenCalled();
      expect(clear).not.toHaveBeenCalled();
    });

    it('should keep a guest invitation for the account they upgrade to', async () => {
      // given — `signInAnonymously` runs no post-auth hooks on purpose, so
      // claiming here would drop both halves before the signup they
      // belong to
      const { claimReferral, claimInvite, clear, clearInvite } = setup({
        pending: 'inviter-1',
        token: TOKEN,
        signedIn: 'guest-1',
        isAnonymous: true,
      });

      // when
      TestBed.tick();
      await settle();

      // then
      expect(claimReferral).not.toHaveBeenCalled();
      expect(claimInvite).not.toHaveBeenCalled();
      expect(clear).not.toHaveBeenCalled();
      expect(clearInvite).not.toHaveBeenCalled();
    });
  });
});
