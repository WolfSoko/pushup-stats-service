import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthStore, type User } from '@pu-auth/auth';

import { CallableFunctionsService } from '../../admin/callable-functions.service';
import { ReferralService } from '../referral.service';
import { ReferralClaimHook } from './referral-claim.hook';

describe('ReferralClaimHook', () => {
  const user = { uid: 'newcomer-1' } as User;

  function setup(
    pending: string | null,
    callable = vitest.fn(),
    signedIn: string | null = null
  ) {
    const clear = vitest.fn();
    const referralMock = { pending: signal(pending), clear };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ReferralClaimHook,
        { provide: ReferralService, useValue: referralMock },
        {
          provide: CallableFunctionsService,
          useValue: { call: () => callable },
        },
        {
          provide: AuthStore,
          useValue: { user: signal(signedIn ? { uid: signedIn } : null) },
        },
      ],
    });
    return { hook: TestBed.inject(ReferralClaimHook), callable, clear };
  }

  it('should hand a pending invitation to the server', async () => {
    // given
    const callable = vitest.fn().mockResolvedValue({ data: { ok: true } });
    const { hook, clear } = setup('inviter-1', callable);

    // when
    await hook.onAuthenticated(user);

    // then
    expect(callable).toHaveBeenCalledWith({ referrerUid: 'inviter-1' });
    expect(clear).toHaveBeenCalled();
  });

  it('should do nothing without an invitation', async () => {
    // given
    const { hook, callable, clear } = setup(null);

    // when
    await hook.onAuthenticated(user);

    // then
    expect(callable).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  describe('Following your own invite link while signed in', () => {
    it('should drop the invitation without waiting for the next sign-in', async () => {
      // given — a restored session never runs the post-auth hooks, so the
      // banner sat on the user's own pages for good
      const { clear } = setup('wolf-1', vitest.fn(), 'wolf-1');

      // when the effect sees the signed-in user
      TestBed.tick();

      // then
      expect(clear).toHaveBeenCalled();
    });

    it('should keep an invitation from somebody else', async () => {
      // given — a real invitation still belongs to the next sign-up
      const { clear } = setup('inviter-1', vitest.fn(), 'wolf-1');

      // when
      TestBed.tick();

      // then
      expect(clear).not.toHaveBeenCalled();
    });

    it('should do nothing while nobody is signed in', async () => {
      // given
      const { clear } = setup('inviter-1');

      // when
      TestBed.tick();

      // then
      expect(clear).not.toHaveBeenCalled();
    });
  });

  it('should never claim the user own link', async () => {
    // given
    const { hook, callable, clear } = setup('newcomer-1');

    // when
    await hook.onAuthenticated(user);

    // then
    expect(callable).not.toHaveBeenCalled();
    expect(clear).toHaveBeenCalled();
  });

  it('should swallow a failed claim and stop retrying it', async () => {
    // given — a login must never fail over an invitation
    const callable = vitest.fn().mockRejectedValue(new Error('offline'));
    const { hook, clear } = setup('inviter-1', callable);

    // when / then
    await expect(hook.onAuthenticated(user)).resolves.toBeUndefined();
    expect(clear).toHaveBeenCalled();
  });
});
