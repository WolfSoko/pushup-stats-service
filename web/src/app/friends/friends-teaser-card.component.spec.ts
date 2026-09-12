import { PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { UserContextService } from '@pu-auth/auth';
import { render, screen } from '@testing-library/angular';

import { InviteService } from '../core/invite.service';
import { ChallengesApiService } from './challenges-api.service';
import {
  FriendsApiService,
  type FriendRow,
  type FriendsBoardEntry,
} from './friends-api.service';
import { FriendsTeaserCardComponent } from './friends-teaser-card.component';

describe('FriendsTeaserCardComponent', () => {
  const friend: FriendRow = {
    id: 'me__b',
    uid: 'b',
    since: '2026-09-01T10:00:00.000Z',
    displayName: 'Bob',
  };

  function entry(over: Partial<FriendsBoardEntry>): FriendsBoardEntry {
    return {
      uid: 'x',
      displayName: 'X',
      value: 0,
      isViewer: false,
      cheers: 0,
      cheered: false,
      ...over,
    };
  }

  async function renderCard(options: {
    friends?: FriendRow[];
    incoming?: FriendRow[];
    board?: FriendsBoardEntry[];
    challenges?: unknown[];
    guest?: boolean;
    uid?: string;
  }) {
    const api = {
      list: vitest.fn().mockResolvedValue({
        friends: options.friends ?? [],
        incoming: options.incoming ?? [],
        outgoing: [],
      }),
      board: vitest.fn().mockResolvedValue(options.board ?? []),
    };
    const challengesApi = {
      list: vitest.fn().mockResolvedValue(options.challenges ?? []),
    };
    const invite = { inviteFriend: vitest.fn().mockResolvedValue('native') };
    const { fixture } = await render(FriendsTeaserCardComponent, {
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: FriendsApiService, useValue: api },
        { provide: ChallengesApiService, useValue: challengesApi },
        { provide: InviteService, useValue: invite },
        {
          provide: UserContextService,
          useValue: {
            userIdSafe: () => options.uid ?? 'me',
            isGuest: () => options.guest ?? false,
          },
        },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    return { api, challengesApi, invite, fixture };
  }

  it('should invite when the user has no friends yet', async () => {
    // given
    const { invite } = await renderCard({});

    // when
    screen.getByTestId('dashboard-friends-invite').click();

    // then
    expect(invite.inviteFriend).toHaveBeenCalled();
    expect(document.body.textContent).toContain('Trainier mit Freunden');
  });

  it('should show the standing and the top of the weekly board', async () => {
    // given
    const { api } = await renderCard({
      friends: [friend],
      board: [
        entry({ uid: 'b', displayName: 'Bob', value: 900 }),
        entry({ uid: 'me', displayName: 'Me', value: 300, isViewer: true }),
        entry({ uid: 'c', displayName: 'Cy', value: 100 }),
        entry({ uid: 'd', displayName: 'Di', value: 50 }),
      ],
    });

    // then — a preview that must not reset the friends page's period
    expect(api.board).toHaveBeenCalledWith('week');
    expect(
      screen.getByTestId('dashboard-friends-standing').textContent
    ).toContain('Platz 2 von 4');
    expect(screen.getAllByTestId('dashboard-friends-row')).toHaveLength(3);
    expect(screen.queryByTestId('dashboard-friends-invite')).toBeNull();
  });

  it('should say so when the user leads', async () => {
    // given
    await renderCard({
      friends: [friend],
      board: [
        entry({ uid: 'me', value: 900, isViewer: true }),
        entry({ uid: 'b', value: 300 }),
      ],
    });

    // then
    expect(document.body.textContent).toContain('Du führst diese Woche');
  });

  it('should count the requests waiting for an answer', async () => {
    // given
    await renderCard({
      incoming: [friend, { ...friend, id: 'me__c', uid: 'c' }],
    });

    // then
    expect(
      screen.getByTestId('dashboard-friends-pending').textContent
    ).toContain('2 Anfragen warten');
  });

  it('should word a single request in the singular', async () => {
    // given
    await renderCard({ incoming: [friend] });

    // then
    expect(
      screen.getByTestId('dashboard-friends-pending').textContent
    ).toContain('Eine Anfrage wartet');
  });

  it('should mention running challenges without asking for their sums', async () => {
    // given
    const { challengesApi } = await renderCard({
      friends: [friend],
      challenges: [
        { id: 'c1', status: 'active', entries: [], viewerInvited: false },
        { id: 'c2', status: 'active', entries: [], viewerInvited: false },
      ],
    });

    // then
    expect(challengesApi.list).toHaveBeenCalledWith({ progress: false });
    expect(
      screen.getByTestId('dashboard-friends-challenges').textContent
    ).toContain('2 Challenges laufen');
  });

  it('should put a waiting invitation before running challenges', async () => {
    // given
    await renderCard({
      friends: [friend],
      challenges: [
        { id: 'c1', status: 'active', entries: [], viewerInvited: false },
        { id: 'c2', status: 'active', entries: [], viewerInvited: true },
      ],
    });

    // then
    expect(
      screen.getByTestId('dashboard-friends-invitations').textContent
    ).toContain('Eine Challenge-Einladung wartet');
    expect(screen.queryByTestId('dashboard-friends-challenges')).toBeNull();
  });

  it('should render nothing for a guest and ask the server nothing', async () => {
    // given
    const { api } = await renderCard({ guest: true });

    // then
    expect(screen.queryByTestId('dashboard-friends-card')).toBeNull();
    expect(api.list).not.toHaveBeenCalled();
  });
});
