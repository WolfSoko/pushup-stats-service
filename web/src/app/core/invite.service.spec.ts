import { LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UserContextService } from '@pu-auth/auth';
import type { UserConfig } from '@pu-stats/models';

import { InviteService } from './invite.service';
import { ShareService } from './share.service';
import { UserConfigStore } from './user-config.store';

describe('InviteService', () => {
  function setup(config: Partial<UserConfig>) {
    const share = vitest.fn().mockResolvedValue('native');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: LOCALE_ID, useValue: 'de' },
        { provide: ShareService, useValue: { share } },
        { provide: UserContextService, useValue: { userIdSafe: () => 'me-1' } },
        {
          provide: UserConfigStore,
          useValue: { config: signal(config as UserConfig) },
        },
      ],
    });
    return { service: TestBed.inject(InviteService), share };
  }

  it('should invite through the public profile when the user has one', async () => {
    // given
    const { service, share } = setup({ ui: { publicProfile: true } });

    // when
    await service.inviteFriend();

    // then
    expect(share.mock.calls[0][0].url).toBe(
      'https://pushup-stats.com/de/u/me-1?ref=me-1'
    );
  });

  it('should invite to the landing page without a public profile', async () => {
    // given
    const { service, share } = setup({});

    // when
    await service.inviteFriend();

    // then
    expect(share.mock.calls[0][0].url).toBe(
      'https://pushup-stats.com/de?ref=me-1'
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
});
