import { LiveDataStore } from '@pu-stats/data-access-state';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { render, screen } from '@testing-library/angular';
import { of } from 'rxjs';

import {
  ChallengesApiService,
  type ChallengeView,
} from './challenges-api.service';
import { ChallengesSectionComponent } from './challenges-section.component';
import { ChallengesStore } from './challenges.store';
import type { FriendRow } from './friends-api.service';

describe('ChallengesSectionComponent', () => {
  const friend: FriendRow = {
    id: 'me__b',
    uid: 'b',
    since: '2026-09-01T10:00:00.000Z',
    displayName: 'Bob',
    photoURL: null,
  };

  const challenge: ChallengeView = {
    id: 'c1',
    createdBy: 'me',
    exerciseId: 'pushup',
    target: 500,
    from: '2026-09-14',
    to: '2099-12-31',
    status: 'active',
    entries: [
      { uid: 'b', displayName: 'Bob', value: 320, isViewer: false },
      { uid: 'me', displayName: 'Me', value: 100, isViewer: true },
    ],
    invited: [],
    viewerInvited: false,
  };

  const invitation: ChallengeView = {
    ...challenge,
    id: 'c2',
    entries: [],
    invited: [{ uid: 'me', displayName: 'Me' }],
    viewerInvited: true,
  };

  async function renderSection(
    challenges: ChallengeView[],
    friends: FriendRow[] = [friend],
    dialogResult: unknown = null
  ) {
    const api = {
      list: vitest.fn().mockResolvedValue(challenges),
      create: vitest.fn().mockResolvedValue({ ok: true }),
      respond: vitest.fn().mockResolvedValue({ ok: true }),
      leave: vitest.fn().mockResolvedValue({ ok: true }),
    };
    const dialog = {
      open: vitest
        .fn()
        .mockReturnValue({ afterClosed: () => of(dialogResult) }),
    };
    const live = {
      updateTick: signal(0),
      exerciseEntriesLoaded: signal(false),
    };
    const { fixture } = await render(ChallengesSectionComponent, {
      inputs: { friends },
      providers: [
        { provide: ChallengesApiService, useValue: api },
        { provide: MatDialog, useValue: dialog },
        { provide: LiveDataStore, useValue: live },
      ],
    });
    // The page loads the store; the section only renders it.
    await fixture.debugElement.injector.get(ChallengesStore).reload();
    fixture.detectChanges();
    return { api, dialog, fixture, live };
  }

  it('should re-read the challenges when a workout is logged', async () => {
    // given
    const { api, fixture, live } = await renderSection([challenge]);
    live.exerciseEntriesLoaded.set(true);
    live.updateTick.set(1);
    await fixture.whenStable();
    api.list.mockClear();

    // when
    live.updateTick.set(2);
    await fixture.whenStable();

    // then
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  it('should say so and offer a retry when the list could not be loaded', async () => {
    // given — the first read fails, the retry succeeds
    const { api, fixture } = await renderSection([challenge]);
    api.list.mockRejectedValueOnce(new Error('offline'));
    await fixture.debugElement.injector.get(ChallengesStore).reload();
    fixture.detectChanges();
    expect(screen.getByTestId('challenges-load-failed')).toBeTruthy();

    // when
    screen.getByTestId('challenges-retry').click();
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(api.list).toHaveBeenCalledTimes(3);
    expect(screen.queryByTestId('challenges-load-failed')).toBeNull();
  });

  it('should show each participant with progress against the target', async () => {
    // given
    await renderSection([challenge]);

    // then
    const rows = screen.getAllByTestId('challenge-participant');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Bob');
    expect(rows[0].textContent).toContain('320 / 500');
    expect(rows[1].textContent).toContain('Du');
    expect(screen.getByTestId('challenge-meta').textContent).toContain('Noch');
  });

  it('should put invitations first and answer them', async () => {
    // given
    const { api } = await renderSection([challenge, invitation]);

    // then — the invitation shows no numbers and sits on top
    const cards = screen.getAllByTestId('challenge-card');
    expect(cards[0].textContent).toContain('Du bist eingeladen');
    expect(
      cards[0].querySelector('[data-testid="challenge-participant"]')
    ).toBeNull();

    // when
    screen.getByTestId('challenge-accept').click();

    // then
    expect(api.respond).toHaveBeenCalledWith('c2', true);
  });

  it('should offer starting one only with friends to invite', async () => {
    // given
    await renderSection([], []);

    // then
    expect(
      (screen.getByTestId('challenge-start') as HTMLButtonElement).disabled
    ).toBe(true);
    expect(document.body.textContent).toContain('Noch keine Challenge');
  });

  it('should create what the dialog returns', async () => {
    // given
    const input = {
      friendUids: ['b'],
      exerciseId: 'pushup',
      exerciseName: 'Liegestütze',
      target: 500,
      days: 7,
    };
    const { api, dialog, fixture } = await renderSection([], [friend], input);

    // when — the dialog is dynamic-imported, so wait for the call itself
    screen.getByTestId('challenge-start').click();
    await vitest.waitFor(() => expect(api.create).toHaveBeenCalledWith(input), {
      timeout: 10000,
    });
    await fixture.whenStable();

    // then
    expect(dialog.open).toHaveBeenCalled();
  });

  it('should let a participant leave', async () => {
    // given
    const { api } = await renderSection([challenge]);

    // when
    screen.getByTestId('challenge-leave').click();

    // then
    expect(api.leave).toHaveBeenCalledWith('c1');
  });

  it('should explain a refused answer', async () => {
    // given
    const { api, fixture } = await renderSection([invitation]);
    api.respond.mockResolvedValue({ ok: false, reason: 'ended' });

    // when
    screen.getByTestId('challenge-decline').click();
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(document.body.textContent).toContain('schon vorbei');
  });
  it('should show the pressed answer button busy until the re-read lands', async () => {
    // given — an answer the server has not confirmed yet
    let answer: (result: { ok: boolean }) => void = () => undefined;
    const { api, fixture } = await renderSection([invitation]);
    api.respond.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      })
    );

    // when
    screen.getByTestId('challenge-decline').click();
    fixture.detectChanges();

    // then — decline spins, accept on the same card does not
    expect(
      screen.getByTestId('challenge-decline').getAttribute('aria-busy')
    ).toBe('true');
    expect(
      screen.getByTestId('challenge-accept').getAttribute('aria-busy')
    ).toBeNull();

    // when
    answer({ ok: true });
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(
      screen.getByTestId('challenge-decline').getAttribute('aria-busy')
    ).toBeNull();
  });

  it('should show the start button busy while the challenge is created', async () => {
    // given — the dialog answers at once, the server does not
    let answer: (result: { ok: boolean }) => void = () => undefined;
    const input = {
      friendUids: ['b'],
      exerciseId: 'pushup',
      exerciseName: 'Liegestütze',
      target: 500,
      days: 7,
    };
    const { api, fixture } = await renderSection([], [friend], input);
    api.create.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      })
    );

    // when — the dialog is dynamic-imported, so wait for the call itself
    screen.getByTestId('challenge-start').click();
    await vitest.waitFor(() => expect(api.create).toHaveBeenCalledWith(input), {
      timeout: 10000,
    });
    fixture.detectChanges();

    // then
    expect(
      screen.getByTestId('challenge-start').getAttribute('aria-busy')
    ).toBe('true');

    // when
    answer({ ok: true });
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(
      screen.getByTestId('challenge-start').getAttribute('aria-busy')
    ).toBeNull();
  });

  it('should show the retry button busy while the list is re-read', async () => {
    // given — the first read fails, the retry hangs
    let answer: (list: ChallengeView[]) => void = () => undefined;
    const { api, fixture } = await renderSection([challenge]);
    api.list.mockRejectedValueOnce(new Error('offline'));
    await fixture.debugElement.injector.get(ChallengesStore).reload();
    fixture.detectChanges();
    api.list.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      })
    );

    // when
    screen.getByTestId('challenges-retry').click();
    fixture.detectChanges();

    // then
    expect(
      screen.getByTestId('challenges-retry').getAttribute('aria-busy')
    ).toBe('true');

    // when
    answer([challenge]);
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(screen.queryByTestId('challenges-load-failed')).toBeNull();
  });
});
