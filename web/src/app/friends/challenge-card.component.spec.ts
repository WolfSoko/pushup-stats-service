import { MatSnackBar } from '@angular/material/snack-bar';
import { render, screen } from '@testing-library/angular';

import { ChallengeCardComponent } from './challenge-card.component';
import type { ChallengeView } from './challenges-api.service';
import { FriendsApiService } from './friends-api.service';

describe('ChallengeCardComponent', () => {
  const base: ChallengeView = {
    id: 'c1',
    createdBy: 'a',
    exerciseId: 'pushup',
    target: 500,
    from: '2026-09-14',
    to: '2099-12-31',
    status: 'active',
    entries: [
      {
        uid: 'b',
        displayName: 'Bob',
        value: 320,
        isViewer: false,
        canCheer: false,
        cheered: false,
      },
      {
        uid: 'me',
        displayName: null,
        value: 100,
        isViewer: true,
        canCheer: false,
        cheered: false,
      },
    ],
    invited: [{ uid: 'c', displayName: 'Cy' }],
    viewerInvited: false,
  };

  async function renderCard(challenge: ChallengeView) {
    const accept = vitest.fn();
    const leave = vitest.fn();
    await render(ChallengeCardComponent, {
      inputs: { challenge },
      on: { accept, leave },
    });
    return { accept, leave };
  }

  it('should offer a cheer only for the rows the server marked', async () => {
    // given — Bob is a friend, the viewer's own row gets nothing
    const cheer = vitest.fn().mockResolvedValue({ ok: true });
    const { fixture } = await render(ChallengeCardComponent, {
      inputs: {
        challenge: {
          ...base,
          entries: [{ ...base.entries[0], canCheer: true }, base.entries[1]],
        },
      },
      providers: [{ provide: FriendsApiService, useValue: { cheer } }],
    });
    const buttons = screen.getAllByTestId(
      'cheer-button'
    ) as HTMLButtonElement[];
    expect(buttons).toHaveLength(1);

    // when
    buttons[0].click();
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(cheer).toHaveBeenCalledWith('b');
    expect(buttons[0].disabled).toBe(true);
  });

  it('should explain a refused cheer and keep the flame tappable', async () => {
    // given
    const open = vitest.fn();
    const cheer = vitest
      .fn()
      .mockResolvedValue({ ok: false, reason: 'not-friends' });
    const { fixture } = await render(ChallengeCardComponent, {
      inputs: {
        challenge: {
          ...base,
          entries: [{ ...base.entries[0], canCheer: true }, base.entries[1]],
        },
      },
      providers: [
        { provide: FriendsApiService, useValue: { cheer } },
        { provide: MatSnackBar, useValue: { open } },
      ],
    });
    const button = screen.getByTestId('cheer-button') as HTMLButtonElement;

    // when
    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(open).toHaveBeenCalledWith(
      'Das geht nur unter bestätigten Freunden.',
      undefined,
      { duration: 4000 }
    );
    expect(button.disabled).toBe(false);
  });

  it('should show no flames when nobody can be cheered', async () => {
    // given
    await renderCard(base);

    // then
    expect(screen.queryByTestId('cheer-button')).toBeNull();
  });

  it('should warn when the progress could not be read', async () => {
    // given
    await renderCard({ ...base, progressUnavailable: true });

    // then
    expect(screen.getByTestId('challenge-progress-unavailable')).toBeTruthy();
  });

  it('should show progress and who has not answered yet', async () => {
    // given
    await renderCard(base);

    // then
    expect(screen.getAllByTestId('challenge-participant')).toHaveLength(2);
    expect(screen.getByTestId('challenge-invited').textContent).toContain('Cy');
    expect(screen.queryByTestId('challenge-accept')).toBeNull();
  });

  it('should ask an invitee to decide before showing anything', async () => {
    // given
    const { accept } = await renderCard({
      ...base,
      entries: [],
      viewerInvited: true,
    });

    // when
    screen.getByTestId('challenge-accept').click();

    // then
    expect(accept).toHaveBeenCalledWith('c1');
    expect(screen.queryByTestId('challenge-leave')).toBeNull();
    expect(screen.queryByTestId('challenge-invited')).toBeNull();
  });

  it('should not let an invitee join a challenge that is over', async () => {
    // given
    await renderCard({ ...base, status: 'ended', viewerInvited: true });

    // then
    expect(
      (screen.getByTestId('challenge-accept') as HTMLButtonElement).disabled
    ).toBe(true);
    expect(screen.getByTestId('challenge-meta').textContent).toContain(
      'Beendet'
    );
  });
  it('should mark only the button whose action is in flight as busy', async () => {
    // given
    await render(ChallengeCardComponent, {
      inputs: {
        challenge: { ...base, viewerInvited: true },
        busyKeys: new Set(['accept:c1']),
      },
    });

    // then
    expect(
      screen.getByTestId('challenge-accept').getAttribute('aria-busy')
    ).toBe('true');
    expect(
      screen.getByTestId('challenge-decline').getAttribute('aria-busy')
    ).toBeNull();
  });
});
