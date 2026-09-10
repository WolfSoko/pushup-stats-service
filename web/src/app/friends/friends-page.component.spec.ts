import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';

import { InviteService } from '../core/invite.service';
import { FriendsApiService, type FriendRow } from './friends-api.service';
import { FriendsPageComponent } from './friends-page.component';

describe('FriendsPageComponent', () => {
  function row(over: Partial<FriendRow> = {}): FriendRow {
    return {
      id: 'a__b',
      uid: 'b',
      since: '2026-09-01T10:00:00.000Z',
      displayName: 'Wolf',
      ...over,
    };
  }

  async function renderPage(
    lists: Partial<{
      friends: FriendRow[];
      incoming: FriendRow[];
      outgoing: FriendRow[];
    }> = {},
    overrides: Partial<Record<'respond' | 'remove', unknown>> = {}
  ) {
    const api = {
      list: vitest.fn().mockResolvedValue({
        friends: lists.friends ?? [],
        incoming: lists.incoming ?? [],
        outgoing: lists.outgoing ?? [],
      }),
      request: vitest.fn().mockResolvedValue({ ok: true }),
      respond: vitest.fn().mockResolvedValue({ ok: true }),
      remove: vitest.fn().mockResolvedValue({ ok: true }),
      ...overrides,
    };
    const invite = { inviteFriend: vitest.fn().mockResolvedValue('native') };
    const { fixture } = await render(FriendsPageComponent, {
      providers: [
        provideRouter([]),
        { provide: FriendsApiService, useValue: api },
        { provide: InviteService, useValue: invite },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    return { api, invite, fixture };
  }

  it('should list confirmed friends with a link to their profile', async () => {
    // given
    await renderPage({ friends: [row({ displayName: 'Wolf' })] });

    // then
    const link = screen.getByRole('link', { name: 'Wolf' });
    expect(link.getAttribute('href')).toBe('/u/b');
  });

  it('should put requests that want an answer on the page', async () => {
    // given
    const { api } = await renderPage({
      incoming: [row({ id: 'x__y', displayName: 'Ada' })],
    });

    // when
    screen.getByTestId('friend-accept').click();

    // then
    expect(api.respond).toHaveBeenCalledWith('x__y', true);
  });

  it('should let the user end a friendship', async () => {
    // given
    const { api } = await renderPage({ friends: [row()] });

    // when
    screen.getByTestId('friend-remove').click();

    // then
    expect(api.remove).toHaveBeenCalledWith('a__b');
  });

  it('should offer inviting someone when the list is empty', async () => {
    // given
    const { invite } = await renderPage();

    // when
    screen.getByRole('button', { name: /Freunde einladen/ }).click();

    // then
    expect(invite.inviteFriend).toHaveBeenCalled();
    expect(document.body.textContent).toContain('Noch keine Freunde');
  });

  it('should explain a refusal in words', async () => {
    // given — the server said the request was already declined
    const { fixture } = await renderPage(
      { friends: [row()] },
      {
        remove: vitest
          .fn()
          .mockResolvedValue({ ok: false, reason: 'not-found' }),
      }
    );

    // when
    screen.getByTestId('friend-remove').click();
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(document.body.textContent).toContain('nicht mehr offen');
  });

  it('should show who is still waiting on an answer', async () => {
    // given
    await renderPage({ outgoing: [row({ displayName: 'Grace' })] });

    // then
    expect(document.body.textContent).toContain('Grace');
    expect(document.body.textContent).toContain('wartet noch');
  });

  it('should label a friend without a display name', async () => {
    // given
    await renderPage({ friends: [row({ displayName: null })] });

    // then
    expect(document.body.textContent).toContain('Ohne Namen');
  });
});
