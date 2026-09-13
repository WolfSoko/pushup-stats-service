import { PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';

import { UserContextService } from '@pu-auth/auth';
import { ChallengeSpotlightComponent } from './challenge-spotlight.component';
import {
  ChallengesApiService,
  type ChallengeView,
} from './challenges-api.service';

describe('ChallengeSpotlightComponent', () => {
  const running: ChallengeView = {
    id: 'c1',
    createdBy: 'me',
    exerciseId: 'pushup',
    target: 500,
    from: '2026-09-14',
    to: '2099-12-31',
    status: 'active',
    entries: [
      { uid: 'me', displayName: 'Me', value: 120, isViewer: true },
      { uid: 'b', displayName: 'Bob', value: 80, isViewer: false },
    ],
    invited: [],
    viewerInvited: false,
  };
  const soonest: ChallengeView = { ...running, id: 'c0', to: '2099-01-01' };
  const invitation: ChallengeView = {
    ...running,
    id: 'c2',
    createdBy: 'b',
    entries: [],
    invited: [{ uid: 'me', displayName: 'Me' }],
    viewerInvited: true,
  };

  async function renderSpotlight(
    challenges: ChallengeView[],
    options: { guest?: boolean; platform?: string } = {}
  ) {
    const api = {
      list: vitest.fn().mockResolvedValue(challenges),
      respond: vitest.fn().mockResolvedValue({ ok: true }),
      leave: vitest.fn().mockResolvedValue({ ok: true }),
    };
    const { fixture } = await render(ChallengeSpotlightComponent, {
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
        { provide: ChallengesApiService, useValue: api },
        {
          provide: UserContextService,
          useValue: {
            userIdSafe: () => 'me',
            isGuest: () => options.guest === true,
          },
        },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    return { api, fixture };
  }

  it('should show the running challenge that ends soonest, with progress', async () => {
    // given
    const { api } = await renderSpotlight([running, soonest]);

    // then — counted first, then summed because something is running
    expect(api.list).toHaveBeenNthCalledWith(1, { progress: false });
    expect(api.list).toHaveBeenNthCalledWith(2, undefined);
    expect(screen.getByTestId('dashboard-challenge').textContent).toContain(
      'Freunde-Challenge'
    );
    expect(screen.getAllByTestId('challenge-participant')).toHaveLength(2);
    expect(screen.getByTestId('dashboard-challenge-more')).toBeTruthy();
  });

  it('should put an invitation before anything running', async () => {
    // given
    await renderSpotlight([running, invitation]);

    // then
    expect(screen.getByTestId('dashboard-challenge').textContent).toContain(
      'Challenge-Einladung'
    );
    expect(screen.getByTestId('challenge-accept')).toBeTruthy();
  });

  it('should let the user accept right there', async () => {
    // given
    const { api, fixture } = await renderSpotlight([invitation]);
    api.list.mockResolvedValue([{ ...invitation, viewerInvited: false }]);

    // when
    screen.getByTestId('challenge-accept').click();
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(api.respond).toHaveBeenCalledWith('c2', true);
    expect(screen.queryByTestId('challenge-accept')).toBeNull();
  });

  it('should not ask for sums when nothing is running', async () => {
    // given
    const { api } = await renderSpotlight([]);

    // then
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('dashboard-challenge')).toBeNull();
  });

  it('should render nothing for a guest and ask the server nothing', async () => {
    // given
    const { api } = await renderSpotlight([running], { guest: true });

    // then
    expect(api.list).not.toHaveBeenCalled();
    expect(screen.queryByTestId('dashboard-challenge')).toBeNull();
  });

  it('should not ask the server during a server render', async () => {
    // given
    const { api } = await renderSpotlight([running], { platform: 'server' });

    // then
    expect(api.list).not.toHaveBeenCalled();
  });
});
