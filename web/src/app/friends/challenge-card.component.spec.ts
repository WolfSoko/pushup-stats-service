import { render, screen } from '@testing-library/angular';

import { ChallengeCardComponent } from './challenge-card.component';
import type { ChallengeView } from './challenges-api.service';

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
      { uid: 'b', displayName: 'Bob', value: 320, isViewer: false },
      { uid: 'me', displayName: null, value: 100, isViewer: true },
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
});
