import { PLATFORM_ID } from '@angular/core';
import { render, screen } from '@testing-library/angular';

import {
  ChallengesApiService,
  type ChallengeView,
} from './challenges-api.service';
import { FriendsApiService, type FriendRow } from './friends-api.service';
import { FriendRequestBadgeComponent } from './friend-request-badge.component';

describe('FriendRequestBadgeComponent', () => {
  const request: FriendRow = {
    id: 'a__b',
    uid: 'b',
    since: '2026-09-14T10:00:00.000Z',
    displayName: 'Ada',
    photoURL: null,
  };

  const invitation: Partial<ChallengeView> = {
    id: 'c1',
    status: 'active',
    entries: [],
    viewerInvited: true,
  };

  async function renderBadge(
    incoming: FriendRow[],
    platform = 'browser',
    challenges: Partial<ChallengeView>[] = []
  ) {
    const api = {
      list: vitest
        .fn()
        .mockResolvedValue({ friends: [], incoming, outgoing: [] }),
      board: vitest.fn().mockResolvedValue([]),
    };
    const challengesApi = {
      list: vitest.fn().mockResolvedValue(challenges),
    };
    const { fixture } = await render(FriendRequestBadgeComponent, {
      providers: [
        { provide: FriendsApiService, useValue: api },
        { provide: ChallengesApiService, useValue: challengesApi },
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    return { api, challengesApi };
  }

  it('should show how many requests are waiting', async () => {
    // given
    await renderBadge([request, { ...request, id: 'a__c', uid: 'c' }]);

    // then
    expect(screen.getByTestId('friend-request-badge').textContent).toBe('2');
  });

  it('should stay away when nothing is waiting', async () => {
    // given
    await renderBadge([]);

    // then
    expect(screen.queryByTestId('friend-request-badge')).toBeNull();
  });

  it('should show an envelope while a challenge invitation waits', async () => {
    // given
    const { challengesApi } = await renderBadge([], 'browser', [
      invitation,
      { ...invitation, id: 'c2', viewerInvited: false },
    ]);

    // then — counted without progress, this is only a hint
    expect(challengesApi.list).toHaveBeenCalledWith({ progress: false });
    expect(
      screen.getByTestId('challenge-invite-badge').getAttribute('aria-label')
    ).toBe('Eine Challenge-Einladung wartet');
    expect(screen.queryByTestId('friend-request-badge')).toBeNull();
  });

  it('should show both when requests and invitations wait', async () => {
    // given
    await renderBadge([request], 'browser', [
      invitation,
      { ...invitation, id: 'c2' },
    ]);

    // then
    expect(
      screen.getByTestId('challenge-invite-badge').getAttribute('aria-label')
    ).toBe('2 Challenge-Einladungen warten');
    expect(screen.getByTestId('friend-request-badge').textContent).toBe('1');
  });

  it('should keep the envelope away without invitations', async () => {
    // given — a running challenge is not an open question
    await renderBadge([], 'browser', [{ ...invitation, viewerInvited: false }]);

    // then
    expect(screen.queryByTestId('challenge-invite-badge')).toBeNull();
  });

  it('should not ask the server during a server render', async () => {
    // given
    const { api, challengesApi } = await renderBadge([request], 'server');

    // then
    expect(api.list).not.toHaveBeenCalled();
    expect(challengesApi.list).not.toHaveBeenCalled();
  });
});
