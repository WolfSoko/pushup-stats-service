import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import type { SessionMode } from '@pu-stats/models';

import { SessionIntroComponent } from './session-intro.component';
import type { SessionStepRow } from './training-session.rows';

function row(overrides: Partial<SessionStepRow> = {}): SessionStepRow {
  return {
    itemIndex: 0,
    name: 'Plank',
    icon: 'horizontal_rule',
    target: '0:50',
    roundTarget: '0:50',
    round: 1,
    roundTotal: 1,
    logged: '0',
    sets: '',
    percent: 0,
    quantified: true,
    done: false,
    tool: 'hold-timer',
    ...overrides,
  };
}

async function setup(
  rows: SessionStepRow[] = [
    row(),
    row({ itemIndex: 1, name: 'Russian Twist', target: '20', tool: 'manual' }),
  ],
  restSec = 60,
  mode: SessionMode = 'sequential',
  roundTotal = 1
) {
  const restSecChange = vitest.fn();
  const modeChange = vitest.fn();
  const start = vitest.fn();
  await render(SessionIntroComponent, {
    inputs: {
      rows,
      restSec,
      mode,
      roundTotal,
      description: 'Zirkel: 3 Runden',
    },
    on: { restSecChange, start, modeChange },
  });
  return { restSecChange, modeChange, start };
}

const byTestId = (id: string): HTMLElement =>
  document.querySelector(`[data-testid="${id}"]`) as HTMLElement;

/** The toggle's own button — `data-testid` lands on the Material host. */
const modeButton = (mode: string): HTMLElement =>
  document.querySelector(
    `[data-testid="session-mode-${mode}"] button`
  ) as HTMLElement;

describe('SessionIntroComponent', () => {
  it('should list every exercise of the day with its target', async () => {
    // given / when
    await setup();

    // then
    expect(screen.getByText('Plank')).toBeTruthy();
    expect(screen.getByText('0:50')).toBeTruthy();
    expect(screen.getByText('Russian Twist')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
  });

  it('should render the day description', async () => {
    // given / when
    await setup();

    // then
    expect(screen.getByText('Zirkel: 3 Runden')).toBeTruthy();
  });

  it('should mark exercises that are already done', async () => {
    // given / when
    await setup([row({ done: true })]);

    // then
    expect(byTestId('session-intro-done')).toBeTruthy();
  });

  it('should show the current rest duration', async () => {
    // given / when
    await setup(undefined, 90);

    // then
    expect(screen.getByText('1:30')).toBeTruthy();
  });

  it('should emit the rest duration the user picked', async () => {
    // given
    const { restSecChange } = await setup();
    const slider = byTestId('session-rest-slider') as HTMLInputElement;

    // when
    slider.value = '30';
    slider.dispatchEvent(new Event('change', { bubbles: true }));

    // then
    expect(restSecChange).toHaveBeenCalledWith(30);
  });

  it('should emit the start request', async () => {
    // given
    const { start } = await setup();

    // when
    await userEvent.click(byTestId('session-start'));

    // then
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('should offer both orderings and preselect the current one', async () => {
    // given / when
    await setup(undefined, 60, 'circuit');

    // then
    expect(screen.getByText('Übung für Übung')).toBeTruthy();
    expect(
      byTestId('session-mode-circuit').classList.contains(
        'mat-button-toggle-checked'
      )
    ).toBe(true);
  });

  it('should emit the ordering the user picked', async () => {
    // given
    const { modeChange } = await setup();

    // when
    await userEvent.click(modeButton('circuit'));

    // then
    expect(modeChange).toHaveBeenCalledWith('circuit');
  });

  it('should name the number of rounds a circuit will walk', async () => {
    // given / when
    await setup(undefined, 60, 'circuit', 3);

    // then
    expect(byTestId('session-mode-hint').textContent).toContain('3 Runden');
  });

  it('should say so when a circuit of this day would be a single round', async () => {
    // given / when
    await setup(undefined, 60, 'circuit', 1);

    // then
    expect(byTestId('session-mode-hint').textContent).toContain('einer Runde');
  });
});
