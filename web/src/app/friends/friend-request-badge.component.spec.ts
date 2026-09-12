import { PLATFORM_ID } from '@angular/core';
import { render, screen } from '@testing-library/angular';

import { FriendsApiService, type FriendRow } from './friends-api.service';
import { FriendRequestBadgeComponent } from './friend-request-badge.component';

describe('FriendRequestBadgeComponent', () => {
  const request: FriendRow = {
    id: 'a__b',
    uid: 'b',
    since: '2026-09-14T10:00:00.000Z',
    displayName: 'Ada',
  };

  async function renderBadge(incoming: FriendRow[], platform = 'browser') {
    const api = {
      list: vitest
        .fn()
        .mockResolvedValue({ friends: [], incoming, outgoing: [] }),
      board: vitest.fn().mockResolvedValue([]),
    };
    const { fixture } = await render(FriendRequestBadgeComponent, {
      providers: [
        { provide: FriendsApiService, useValue: api },
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    return { api };
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

  it('should not ask the server during a server render', async () => {
    // given
    const { api } = await renderBadge([request], 'server');

    // then
    expect(api.list).not.toHaveBeenCalled();
  });
});
