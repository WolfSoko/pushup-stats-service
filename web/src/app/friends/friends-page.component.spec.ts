import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';

import { InviteService } from '../core/invite.service';
import { ChallengesApiService } from './challenges-api.service';
import {
  FriendsApiService,
  type FriendRow,
  type FriendsBoardEntry,
} from './friends-api.service';
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
    overrides: Partial<Record<'respond' | 'remove' | 'cheer', unknown>> = {},
    boardEntries?: ReadonlyArray<FriendsBoardEntry>,
    challenges: unknown[] = []
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
      board: vitest.fn().mockResolvedValue(boardEntries ?? []),
      cheer: vitest.fn().mockResolvedValue({ ok: true }),
      ...overrides,
    };
    const challengesApi = { list: vitest.fn().mockResolvedValue(challenges) };
    const invite = { inviteFriend: vitest.fn().mockResolvedValue('native') };
    const { fixture } = await render(FriendsPageComponent, {
      providers: [
        provideRouter([]),
        { provide: FriendsApiService, useValue: api },
        { provide: ChallengesApiService, useValue: challengesApi },
        { provide: InviteService, useValue: invite },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    return { api, invite, fixture };
  }

  it('should show a challenge even before the friends list has arrived', async () => {
    // given — the friends call failed, but the invitation is there
    await renderPage(
      {},
      {},
      [],
      [
        {
          id: 'c1',
          createdBy: 'b',
          exerciseId: 'pushup',
          target: 500,
          from: '2026-09-14',
          to: '2099-12-31',
          status: 'active',
          entries: [],
          invited: [{ uid: 'me', displayName: null }],
          viewerInvited: true,
        },
      ]
    );

    // then
    expect(screen.getAllByTestId('challenge-card')).toHaveLength(1);
  });

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

  describe('the board', () => {
    const entries: FriendsBoardEntry[] = [
      {
        uid: 'b',
        displayName: 'Bob',
        value: 900,
        isViewer: false,
        cheers: 2,
        cheered: false,
      },
      {
        uid: 'me',
        displayName: 'Wolf',
        value: 300,
        isViewer: true,
        cheers: 0,
        cheered: false,
      },
    ];

    it('should let the viewer cheer a friend, once', async () => {
      // given
      const { api, fixture } = await renderPage(
        { friends: [row()] },
        {},
        entries
      );
      api.board.mockResolvedValue([
        { ...entries[0], cheered: true, cheers: 3 },
        entries[1],
      ]);

      // when — only Bob's row has a button; the viewer cannot cheer themselves
      const buttons = screen.getAllByTestId('board-cheer');
      expect(buttons).toHaveLength(1);
      buttons[0].click();
      await fixture.whenStable();
      fixture.detectChanges();

      // then
      expect(api.cheer).toHaveBeenCalledWith('b');
      expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByTestId('board-cheers').textContent).toContain('3');
    });

    it('should explain a cheer the server refused', async () => {
      // given
      const { fixture } = await renderPage(
        { friends: [row()] },
        {
          cheer: vitest
            .fn()
            .mockResolvedValue({ ok: false, reason: 'already' }),
        },
        entries
      );

      // when
      screen.getByTestId('board-cheer').click();
      await fixture.whenStable();
      fixture.detectChanges();

      // then
      expect(document.body.textContent).toContain('Heute schon angefeuert');
    });

    it('should rank the group and mark the viewer', async () => {
      // given
      await renderPage({ friends: [row()] }, {}, entries);

      // then
      const rows = screen.getAllByTestId('board-row');
      expect(rows).toHaveLength(2);
      expect(rows[0].textContent).toContain('Bob');
      expect(rows[1].textContent).toContain('Du');
    });

    it('should reload the board when the period changes', async () => {
      // given
      const { api, fixture } = await renderPage(
        { friends: [row()] },
        {},
        entries
      );
      api.board.mockClear();

      // when — the chips are a listbox; click the "Gesamt" option
      (screen.getByRole('option', { name: 'Gesamt' }) as HTMLElement).click();
      await fixture.whenStable();

      // then
      expect(api.board).toHaveBeenCalledWith('allTime');
    });

    it('should stay away with nobody to compare against', async () => {
      // given — a board of one is not a comparison
      await renderPage({ friends: [row()] }, {}, [entries[1]]);

      // then
      expect(screen.queryAllByTestId('board-row')).toHaveLength(0);
    });
  });
});
