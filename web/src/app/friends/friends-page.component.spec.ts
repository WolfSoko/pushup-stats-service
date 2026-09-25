import { LiveDataStore } from '@pu-stats/data-access-state';
import { computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { nextMacrotask } from '@pu-stats/testing';
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
      photoURL: null,
      ...over,
    };
  }

  /**
   * The invite link as the dialog renders it. `findBy` rather than
   * `getBy`: the dialog is dynamic-imported, which no fixture tick waits
   * for — resolving it after teardown throws on a destroyed injector.
   */
  async function link(): Promise<string> {
    const field = await screen.findByTestId('invite-link');
    return (field as HTMLInputElement).value;
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
    const inviteToken = signal<string | null>('tok-AAAAAAAAAAAAAAAA');
    const invite = {
      inviteFriend: vitest.fn().mockResolvedValue('native'),
      inviteUrl: signal('https://pushup-stats.com/de/u/me?ref=me&fi=tok'),
      canAddFriend: computed(() => inviteToken() !== null),
      ensureToken: vitest
        .fn()
        .mockImplementation(() => Promise.resolve(inviteToken())),
    };
    const live = {
      updateTick: signal(0),
      exerciseEntriesLoaded: signal(false),
    };
    const { fixture } = await render(FriendsPageComponent, {
      providers: [
        provideRouter([]),
        { provide: LiveDataStore, useValue: live },
        { provide: FriendsApiService, useValue: api },
        { provide: ChallengesApiService, useValue: challengesApi },
        { provide: InviteService, useValue: invite },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    return { api, invite, inviteToken, fixture, live };
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

  it('should show a friend’s picture in the list', async () => {
    // given
    await renderPage({
      friends: [row({ photoURL: 'https://example.test/wolf.jpg' })],
    });

    // then
    expect(screen.getByTestId('friend-avatar-photo').getAttribute('src')).toBe(
      'https://example.test/wolf.jpg'
    );
  });

  it('should fall back to the initial for a friend without a picture', async () => {
    // given
    await renderPage({ friends: [row({ displayName: 'Wolf' })] });

    // then
    expect(screen.getByTestId('friend-avatar-initial').textContent).toBe('W');
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

  it('should show the accept button busy until the request is answered and the lists re-read', async () => {
    // given — an answer the server has not confirmed yet
    let answer: (result: { ok: boolean }) => void = () => undefined;
    const { api, fixture } = await renderPage(
      { incoming: [row({ id: 'x__y', displayName: 'Ada' })] },
      {
        respond: vitest.fn().mockReturnValue(
          new Promise((resolve) => {
            answer = resolve;
          })
        ),
      }
    );

    // when
    screen.getByTestId('friend-accept').click();
    fixture.detectChanges();

    // then — accept spins, decline on the same card does not
    expect(screen.getByTestId('friend-accept').getAttribute('aria-busy')).toBe(
      'true'
    );
    expect(
      screen.getByTestId('friend-decline').getAttribute('aria-busy')
    ).toBeNull();

    // when — confirmed; the re-read no longer lists the request
    api.list.mockResolvedValue({
      friends: [row({ id: 'x__y', displayName: 'Ada' })],
      incoming: [],
      outgoing: [],
    });
    answer({ ok: true });
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(screen.queryByTestId('friend-accept')).toBeNull();
    expect(
      screen.getByTestId('friend-remove').getAttribute('aria-busy')
    ).toBeNull();
  });

  it('should show only the pressed remove button busy while the friendship ends', async () => {
    // given — two friends, one removal left hanging
    const { fixture } = await renderPage(
      { friends: [row(), row({ id: 'a__c', uid: 'c', displayName: 'Cara' })] },
      { remove: vitest.fn().mockReturnValue(new Promise(() => undefined)) }
    );

    // when
    screen.getAllByTestId('friend-remove')[0].click();
    fixture.detectChanges();

    // then
    const buttons = screen.getAllByTestId('friend-remove');
    expect(buttons[0].getAttribute('aria-busy')).toBe('true');
    expect(buttons[1].getAttribute('aria-busy')).toBeNull();
  });

  it('should show the withdraw button busy while the request is taken back', async () => {
    // given
    let answer: (result: { ok: boolean }) => void = () => undefined;
    const { fixture } = await renderPage(
      { outgoing: [row({ id: 'a__d', uid: 'd' })] },
      {
        remove: vitest.fn().mockReturnValue(
          new Promise((resolve) => {
            answer = resolve;
          })
        ),
      }
    );

    // when
    screen.getByTestId('friend-withdraw').click();
    fixture.detectChanges();

    // then
    expect(
      screen.getByTestId('friend-withdraw').getAttribute('aria-busy')
    ).toBe('true');

    // when
    answer({ ok: true });
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(
      screen.getByTestId('friend-withdraw').getAttribute('aria-busy')
    ).toBeNull();
  });

  it('should offer inviting someone when the list is empty', async () => {
    // given
    await renderPage();

    // when
    screen.getByRole('button', { name: /Freunde einladen/ }).click();

    // then
    expect(await link()).toBe('https://pushup-stats.com/de/u/me?ref=me&fi=tok');
    expect(document.body.textContent).toContain('Noch keine Freunde');
  });

  it('should still offer adding a friend once the list has someone in it', async () => {
    // given — the invite button used to live in the empty state alone, so
    // a first friend left no way to gain a second
    await renderPage({ friends: [row()] });

    // when
    screen.getByTestId('friends-add').click();

    // then
    expect(await link()).toBe('https://pushup-stats.com/de/u/me?ref=me&fi=tok');
  });

  it('should hand the link to the share sheet', async () => {
    // given
    const { invite } = await renderPage();

    // when
    screen.getByTestId('friends-add').click();
    (await screen.findByTestId('invite-share')).click();

    // then
    expect(invite.inviteFriend).toHaveBeenCalled();
  });

  it('should show the share button busy until the share sheet has been handed the link', async () => {
    // given — the token is still being minted
    let answer: (result: string) => void = () => undefined;
    const { invite, fixture } = await renderPage();
    invite.inviteFriend.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      })
    );

    // when
    screen.getByTestId('friends-add').click();
    const share = await screen.findByTestId('invite-share');
    share.click();
    fixture.detectChanges();

    // then
    expect(share.getAttribute('aria-busy')).toBe('true');

    // when
    answer('native');
    await nextMacrotask();
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(share.getAttribute('aria-busy')).toBeNull();
  });

  it('should not offer a link the server refused to mint a token for', async () => {
    // given — a guest: their account does not outlive the session, so a
    // link tied to it would leave the recipient asking a dead uid
    const { inviteToken } = await renderPage();
    inviteToken.set(null);

    // when
    screen.getByTestId('friends-add').click();

    // then
    await screen.findByTestId('invite-unavailable');
    expect(screen.queryByTestId('invite-link')).toBeNull();
    expect(screen.queryByTestId('invite-share')).toBeNull();
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

  it('should re-read everything when the tab becomes visible again', async () => {
    // given
    const { api, fixture } = await renderPage({ friends: [row()] });
    const challengesApi = fixture.debugElement.injector.get(
      ChallengesApiService
    ) as unknown as { list: ReturnType<typeof vitest.fn> };
    api.list.mockClear();
    api.board.mockClear();
    challengesApi.list.mockClear();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });

    // when
    document.dispatchEvent(new Event('visibilitychange'));
    await fixture.whenStable();

    // then
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.board).toHaveBeenCalledTimes(1);
    expect(challengesApi.list).toHaveBeenCalledTimes(1);
  });

  it('should re-read the board when a workout is logged', async () => {
    // given
    const { api, fixture, live } = await renderPage({ friends: [row()] });
    live.exerciseEntriesLoaded.set(true);
    live.updateTick.set(1);
    await fixture.whenStable();
    api.board.mockClear();

    // when
    live.updateTick.set(2);
    await fixture.whenStable();

    // then
    expect(api.board).toHaveBeenCalledTimes(1);
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

    it('should show the tapped flame busy while its cheer is away', async () => {
      // given — a send the server has not answered yet
      let answer: (result: { ok: boolean }) => void = () => undefined;
      const { fixture } = await renderPage(
        { friends: [row()] },
        {
          cheer: vitest.fn().mockReturnValue(
            new Promise((resolve) => {
              answer = resolve;
            })
          ),
        },
        entries
      );

      // when
      screen.getByTestId('board-cheer').click();
      await fixture.whenStable();
      fixture.detectChanges();

      // then — still the flame, now busy, and not tappable a second time
      const button = screen.getByTestId('board-cheer') as HTMLButtonElement;
      expect(button.textContent).toContain('whatshot');
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(button.disabled).toBe(false);
      expect(button.getAttribute('aria-label')).toBe(
        'Anfeuerung wird gesendet'
      );

      // when — the server answers and the board is re-read
      answer({ ok: true });
      // the answer starts a chain — re-read, then clear — that only a
      // turn of the event loop drains, not a single stability check
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
      fixture.detectChanges();

      // then — it comes to rest, and only then, lit even though this
      // mock's re-read still says "not cheered"
      expect(
        screen.getByTestId('board-cheer').getAttribute('aria-busy')
      ).toBeNull();
      expect(screen.getByTestId('board-cheer').textContent).toContain(
        'local_fire_department'
      );
    });

    it('should leave the other friends flames still while one cheer is away', async () => {
      // given — two friends to cheer, one send left hanging
      const third = {
        uid: 'c',
        displayName: 'Cara',
        value: 600,
        isViewer: false,
        cheers: 0,
        cheered: false,
      };
      const { fixture } = await renderPage(
        { friends: [row()] },
        { cheer: vitest.fn().mockReturnValue(new Promise(() => undefined)) },
        [entries[0], third, entries[1]]
      );

      // when — Bob's button is the one tapped
      screen.getAllByTestId('board-cheer')[0].click();
      await fixture.whenStable();
      fixture.detectChanges();

      // then — Cara's flame neither turns nor locks
      const buttons = screen.getAllByTestId('board-cheer');
      expect(buttons[0].getAttribute('aria-busy')).toBe('true');
      expect(buttons[1].getAttribute('aria-busy')).toBeNull();
      expect((buttons[1] as HTMLButtonElement).disabled).toBe(false);
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

    it('should show training days with their unit by default', async () => {
      // given
      await renderPage({ friends: [row()] }, {}, [
        { ...entries[0], value: 5 },
        { ...entries[1], value: 1 },
      ]);

      // then
      expect(
        screen.getAllByTestId('board-value').map((el) => el.textContent?.trim())
      ).toEqual(['5 Tage', '1 Tag']);
    });

    it('should switch the board to the streak when picked', async () => {
      // given
      const { api, fixture } = await renderPage(
        { friends: [row()] },
        {},
        entries
      );
      api.board.mockClear();

      // when
      (screen.getByTestId('board-comparison') as HTMLElement).click();
      await fixture.whenStable();
      (screen.getByRole('option', { name: 'Streak' }) as HTMLElement).click();
      await fixture.whenStable();

      // then — no period for a streak, so the chips are gone too
      expect(api.board).toHaveBeenLastCalledWith('week', { metric: 'streak' });
      fixture.detectChanges();
      expect(screen.queryByRole('option', { name: 'Gesamt' })).toBeNull();
    });

    it('should switch the board to XP across all exercises when picked', async () => {
      // given
      const { api, fixture } = await renderPage(
        { friends: [row()] },
        {},
        entries
      );
      api.board.mockClear();

      // when
      (screen.getByTestId('board-comparison') as HTMLElement).click();
      await fixture.whenStable();
      (
        screen.getByRole('option', { name: 'XP (alle Übungen)' }) as HTMLElement
      ).click();
      await fixture.whenStable();
      fixture.detectChanges();

      // then — XP has a today bucket, so the "Heute" chip appears
      expect(api.board).toHaveBeenLastCalledWith('week', { metric: 'xp' });
      expect(screen.getByRole('option', { name: 'Heute' })).toBeTruthy();
    });

    it('should link every name on the board to that profile', async () => {
      // given
      await renderPage({ friends: [row()] }, {}, entries);

      // then — the viewer's own row too, like the public leaderboard
      const names = screen.getAllByTestId('board-name');
      expect(names.map((a) => a.getAttribute('href'))).toEqual([
        '/u/b',
        '/u/me',
      ]);
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
      expect(api.board).toHaveBeenCalledWith('allTime', { metric: 'days' });
    });

    it('should stay away with nobody to compare against', async () => {
      // given — a board of one is not a comparison
      await renderPage({ friends: [row()] }, {}, [entries[1]]);

      // then
      expect(screen.queryAllByTestId('board-row')).toHaveLength(0);
    });
  });
});
