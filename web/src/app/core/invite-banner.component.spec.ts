import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { PublicProfileApiService } from '@pu-stats/data-access';
import type { PublicProfile } from '@pu-stats/models';

import { InviteBannerComponent } from './invite-banner.component';
import { ReferralService } from './referral.service';

describe('InviteBannerComponent', () => {
  async function renderBanner(
    pending: string | null,
    profile: Partial<PublicProfile> | null
  ) {
    await render(InviteBannerComponent, {
      providers: [
        { provide: ReferralService, useValue: { pending: signal(pending) } },
        {
          provide: PublicProfileApiService,
          useValue: {
            getProfile: vitest.fn().mockResolvedValue(profile),
          },
        },
      ],
    });
  }

  it('should name the inviter when their profile is public', async () => {
    // given
    await renderBanner('inviter-1', { displayName: 'Wolf' });

    // then — one sentence, with the space: Angular drops whitespace-only
    // text nodes between elements, which once produced "Wolfhat dich"
    expect(await screen.findByText('Wolf')).toBeTruthy();
    expect(document.body.textContent).toContain(
      'Wolf hat dich zu Pushup Tracker eingeladen.'
    );
  });

  it('should stay anonymous when the inviter has no public profile', async () => {
    // given — getProfile returns null for users who did not opt in
    await renderBanner('inviter-1', null);

    // then
    expect(document.body.textContent).toContain(
      'Du wurdest zu Pushup Tracker eingeladen.'
    );
  });

  it('should render nothing without an invitation', async () => {
    // given
    await renderBanner(null, { displayName: 'Wolf' });

    // then
    expect(document.querySelector('.invite-banner')).toBeNull();
  });
});
