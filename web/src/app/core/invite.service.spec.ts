import { LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UserContextService } from '@pu-auth/auth';
import type { UserConfig } from '@pu-stats/models';

import { FriendInviteApiService } from './friend-invite-api.service';
import { InviteService } from './invite.service';
import { ShareService } from './share.service';
import { UserConfigStore } from './user-config.store';

describe('InviteService', () => {
  function setup(
    config: Partial<UserConfig>,
    token: string | null = 'tok-AAAAAAAAAAAAAAAA'
  ) {
    const share = vitest.fn().mockResolvedValue('native');
    const create = vitest.fn().mockResolvedValue(token);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: LOCALE_ID, useValue: 'de' },
        { provide: ShareService, useValue: { share } },
        { provide: FriendInviteApiService, useValue: { create } },
        { provide: UserContextService, useValue: { userIdSafe: () => 'me-1' } },
        {
          provide: UserConfigStore,
          useValue: { config: signal(config as UserConfig) },
        },
      ],
    });
    return { service: TestBed.inject(InviteService), share, create };
  }

  it('should invite through the public profile when the user has one', async () => {
    // given
    const { service, share } = setup({ ui: { publicProfile: true } });

    // when
    await service.inviteFriend();

    // then
    expect(share.mock.calls[0][0].url).toBe(
      'https://pushup-stats.com/de/u/me-1?ref=me-1&fi=tok-AAAAAAAAAAAAAAAA'
    );
  });

  it('should invite to the landing page without a public profile', async () => {
    // given
    const { service, share } = setup({});

    // when
    await service.inviteFriend();

    // then
    expect(share.mock.calls[0][0].url).toBe(
      'https://pushup-stats.com/de?ref=me-1&fi=tok-AAAAAAAAAAAAAAAA'
    );
  });

  it('should ask someone to join rather than report a result', async () => {
    // given
    const { service, share } = setup({});

    // when
    await service.inviteFriend();

    // then — the copy is an invitation, not a brag
    expect(share.mock.calls[0][0].text).toContain('Trainier mit mir');
  });

  it('should surface how many accounts joined through the link', () => {
    // given
    const { service } = setup({ referral: { invitedCount: 4 } });

    // when / then
    expect(service.invitedCount()).toBe(4);
  });

  it('should report no invites for a user who never invited anyone', () => {
    // when / then
    expect(setup({}).service.invitedCount()).toBe(0);
  });

  describe('The invite token', () => {
    it('should still share a referral link when no token could be minted', async () => {
      // given — a guest, or a server that refused; sharing must not break
      const { service, share } = setup({}, null);

      // when
      await service.inviteFriend();

      // then
      expect(share.mock.calls[0][0].url).toBe(
        'https://pushup-stats.com/de?ref=me-1'
      );
      expect(service.canAddFriend()).toBe(false);
    });

    it('should survive a failing mint rather than block the share sheet', async () => {
      // given
      const { service, share } = setup({});
      TestBed.inject(FriendInviteApiService).create = vitest
        .fn()
        .mockRejectedValue(new Error('offline'));

      // when / then
      await expect(service.inviteFriend()).resolves.toBe('native');
      expect(share.mock.calls[0][0].url).toBe(
        'https://pushup-stats.com/de?ref=me-1'
      );
    });

    it('should mint once and reuse it', async () => {
      // given — a link already shared has to keep working, and parallel
      // callers must not each start their own round trip
      const { service, create } = setup({});

      // when
      await Promise.all([
        service.ensureToken(),
        service.ensureToken(),
        service.inviteFriend(),
      ]);
      await service.ensureToken();

      // then
      expect(create).toHaveBeenCalledTimes(1);
      expect(service.canAddFriend()).toBe(true);
    });
  });
});
