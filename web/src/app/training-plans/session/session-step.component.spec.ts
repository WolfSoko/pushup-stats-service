import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { SessionStepComponent } from './session-step.component';
import type { SessionStepRow } from './training-session.rows';

function row(overrides: Partial<SessionStepRow> = {}): SessionStepRow {
  return {
    itemIndex: 0,
    name: 'Liegestütze',
    icon: 'fitness_center',
    target: '15',
    roundTarget: '15',
    round: 1,
    roundTotal: 1,
    logged: '0',
    sets: '',
    percent: 0,
    quantified: true,
    done: false,
    tool: 'auto-count',
    ...overrides,
  };
}

async function setup(overrides: Partial<SessionStepRow> = {}, busy = false) {
  const capture = vitest.fn();
  const enterByHand = vitest.fn();
  const logAsPrescribed = vitest.fn();
  const checkOff = vitest.fn();
  const skip = vitest.fn();
  await render(SessionStepComponent, {
    inputs: { row: row(overrides), position: 2, total: 3, busy },
    on: { capture, enterByHand, logAsPrescribed, checkOff, skip },
  });
  return { capture, enterByHand, logAsPrescribed, checkOff, skip };
}

const byTestId = (id: string): HTMLElement =>
  document.querySelector(`[data-testid="${id}"]`) as HTMLElement;

describe('SessionStepComponent', () => {
  it('should render the exercise, its target and the position in the day', async () => {
    // given / when
    await setup();

    // then
    expect(screen.getByText('Liegestütze')).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
    expect(screen.getByText(/Übung 2 von 3/)).toBeTruthy();
  });

  it('should offer the camera as the primary tool for a counted exercise', async () => {
    // given / when
    await setup({ tool: 'auto-count' });

    // then
    expect(byTestId('session-capture').textContent).toContain(
      'Mit Kamera zählen'
    );
  });

  it('should offer the timer as the primary tool for a hold', async () => {
    // given / when
    await setup({ tool: 'hold-timer', target: '0:50' });

    // then
    expect(byTestId('session-capture').textContent).toContain('Timer starten');
  });

  it('should offer the stopwatch as the primary tool for a timed exercise without a hold profile', async () => {
    // given
    await setup({ tool: 'stopwatch', target: '0:30' });

    // then
    expect(byTestId('session-capture').textContent).toContain(
      'Stoppuhr starten'
    );
    expect(byTestId('session-by-hand')).toBeTruthy();
  });

  it('should not duplicate the entry dialog when it is already the primary tool', async () => {
    // given / when
    await setup({ tool: 'manual' });

    // then
    expect(byTestId('session-capture').textContent).toContain('Eintragen');
    expect(byTestId('session-by-hand')).toBeNull();
  });

  it('should offer manual entry alongside a camera tool', async () => {
    // given / when
    await setup({ tool: 'auto-count' });

    // then
    expect(byTestId('session-by-hand')).toBeTruthy();
  });

  it('should emit the capture request', async () => {
    // given
    const { capture } = await setup();

    // when
    await userEvent.click(byTestId('session-capture'));

    // then
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('should emit the as-prescribed request', async () => {
    // given
    const { logAsPrescribed } = await setup();

    // when
    await userEvent.click(byTestId('session-log-prescribed'));

    // then
    expect(logAsPrescribed).toHaveBeenCalledTimes(1);
  });

  it('should emit the check-off request', async () => {
    // given
    const { checkOff } = await setup();

    // when
    await userEvent.click(byTestId('session-check-off'));

    // then
    expect(checkOff).toHaveBeenCalledTimes(1);
  });

  it('should emit the skip request', async () => {
    // given
    const { skip } = await setup();

    // when
    await userEvent.click(byTestId('session-skip'));

    // then
    expect(skip).toHaveBeenCalledTimes(1);
  });

  it('should show partial progress towards the target', async () => {
    // given / when
    await setup({ logged: '8', percent: 53 });

    // then
    expect(screen.getByText(/Bereits geschafft: 8 \/ 15/)).toBeTruthy();
  });

  it('should hide the progress bar before anything is logged', async () => {
    // given / when
    await setup({ percent: 0 });

    // then
    expect(screen.queryByText(/Bereits geschafft/)).toBeNull();
  });

  it('should render the set breakdown when the plan prescribes one', async () => {
    // given / when
    await setup({ sets: '15 · 12 · 10' });

    // then
    expect(screen.getByText(/Sätze: 15 · 12 · 10/)).toBeTruthy();
  });

  it('should offer the as-prescribed action for a quantified exercise', async () => {
    // given / when
    await setup({ quantified: true });

    // then
    expect(byTestId('session-log-prescribed')).toBeTruthy();
  });

  it('should offer no as-prescribed action for an unquantified exercise', async () => {
    // given / when
    await setup({ quantified: false, target: '' });

    // then
    expect(screen.getByText('nach Vorgabe')).toBeTruthy();
    expect(byTestId('session-log-prescribed')).toBeNull();
  });

  it('should disable every action while a capture is in flight', async () => {
    // given / when
    await setup({}, true);

    // then
    expect(byTestId('session-capture').hasAttribute('disabled')).toBe(true);
    expect(byTestId('session-skip').hasAttribute('disabled')).toBe(true);
  });

  it('should show the round instead of the exercise position in a circuit', async () => {
    // given / when
    await setup({ round: 2, roundTotal: 3, roundTarget: '10', target: '20' });

    // then
    expect(byTestId('session-step-round').textContent).toContain(
      'Runde 2 von 3'
    );
    expect(screen.queryByText(/Übung 2 von 3/)).toBeNull();
  });

  it('should ask for the round portion, not the whole day', async () => {
    // given / when
    await setup({ round: 2, roundTotal: 3, roundTarget: '10', target: '20' });

    // then
    expect(screen.getByText('10')).toBeTruthy();
  });
});
