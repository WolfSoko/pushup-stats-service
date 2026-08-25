import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { SessionRestComponent } from './session-rest.component';
import type { SessionStepRow } from './training-session.rows';

const NEXT: SessionStepRow = {
  itemIndex: 1,
  name: 'Russian Twist',
  icon: 'sports_gymnastics',
  target: '20',
  logged: '0',
  sets: '',
  percent: 0,
  quantified: true,
  done: false,
  tool: 'manual',
};

async function setup(
  inputs: {
    remainingSec?: number;
    totalSec?: number;
    next?: SessionStepRow | null;
  } = {}
) {
  const nudge = vitest.fn();
  const skipRest = vitest.fn();
  await render(SessionRestComponent, {
    inputs: {
      remainingSec: inputs.remainingSec ?? 45,
      totalSec: inputs.totalSec ?? 60,
      next: inputs.next === undefined ? NEXT : inputs.next,
    },
    on: { nudge, skipRest },
  });
  return { nudge, skipRest };
}

const byTestId = (id: string): HTMLElement =>
  document.querySelector(`[data-testid="${id}"]`) as HTMLElement;

describe('SessionRestComponent', () => {
  it('should render the remaining rest as a countdown', async () => {
    // given / when
    await setup({ remainingSec: 45 });

    // then
    expect(screen.getByText('0:45')).toBeTruthy();
  });

  it('should announce the exercise the rest leads into', async () => {
    // given / when
    await setup();

    // then
    expect(screen.getByText(/Als Nächstes: Russian Twist/)).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
  });

  it('should render without an upcoming exercise', async () => {
    // given / when
    await setup({ next: null });

    // then
    expect(screen.queryByText(/Als Nächstes/)).toBeNull();
  });

  it('should emit a positive nudge when the rest is extended', async () => {
    // given
    const { nudge } = await setup();

    // when
    await userEvent.click(byTestId('session-rest-extend'));

    // then
    expect(nudge).toHaveBeenCalledWith(15);
  });

  it('should emit a negative nudge when the rest is shortened', async () => {
    // given
    const { nudge } = await setup();

    // when
    await userEvent.click(byTestId('session-rest-shorten'));

    // then
    expect(nudge).toHaveBeenCalledWith(-15);
  });

  it('should emit a request to continue immediately', async () => {
    // given
    const { skipRest } = await setup();

    // when
    await userEvent.click(byTestId('session-skip-rest'));

    // then
    expect(skipRest).toHaveBeenCalledTimes(1);
  });
});
