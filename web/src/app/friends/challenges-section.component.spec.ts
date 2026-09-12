import { MatDialog } from '@angular/material/dialog';
import { render, screen } from '@testing-library/angular';
import { of } from 'rxjs';

import {
  ChallengesApiService,
  type ChallengeView,
} from './challenges-api.service';
import { ChallengesSectionComponent } from './challenges-section.component';
import type { FriendRow } from './friends-api.service';

describe('ChallengesSectionComponent', () => {
  const friend: FriendRow = {
    id: 'me__b',
    uid: 'b',
    since: '2026-09-01T10:00:00.000Z',
    displayName: 'Bob',
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
  };

  async function renderSection(
    challenges: ChallengeView[],
    friends: FriendRow[] = [friend],
    dialogResult: unknown = null
  ) {
    const api = {
      list: vitest.fn().mockResolvedValue(challenges),
      create: vitest.fn().mockResolvedValue({ ok: true }),
      leave: vitest.fn().mockResolvedValue({ ok: true }),
    };
    const dialog = {
      open: vitest
        .fn()
        .mockReturnValue({ afterClosed: () => of(dialogResult) }),
    };
    const { fixture } = await render(ChallengesSectionComponent, {
      inputs: { friends },
      providers: [
        { provide: ChallengesApiService, useValue: api },
        { provide: MatDialog, useValue: dialog },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    return { api, dialog, fixture };
  }

  it('should show each participant with progress against the target', async () => {
    // given
    const { fixture } = await renderSection([challenge]);
    const { ChallengesStore } = await import('./challenges.store');
    await fixture.debugElement.injector.get(ChallengesStore).reload();
    fixture.detectChanges();

    // then
    const rows = screen.getAllByTestId('challenge-participant');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Bob');
    expect(rows[0].textContent).toContain('320 / 500');
    expect(rows[1].textContent).toContain('Du');
    expect(screen.getByTestId('challenge-meta').textContent).toContain('Noch');
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
    await vitest.waitFor(() => expect(api.create).toHaveBeenCalledWith(input));
    await fixture.whenStable();

    // then
    expect(dialog.open).toHaveBeenCalled();
  });

  it('should let a participant leave', async () => {
    // given
    const { api, fixture } = await renderSection([challenge]);
    const { ChallengesStore } = await import('./challenges.store');
    await fixture.debugElement.injector.get(ChallengesStore).reload();
    fixture.detectChanges();

    // when
    screen.getByTestId('challenge-leave').click();

    // then
    expect(api.leave).toHaveBeenCalledWith('c1');
  });
});
