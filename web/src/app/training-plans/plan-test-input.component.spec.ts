import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { PlanTestInputComponent } from './plan-test-input.component';

interface Setup {
  submitted: number[];
  cleared: number;
}

async function setup(
  inputs: Partial<{
    result: number | null;
    recommended: number;
    scalesPlan: boolean;
    factor: number;
    interactive: boolean;
  }> = {}
): Promise<Setup> {
  const state: Setup = { submitted: [], cleared: 0 };
  await render(PlanTestInputComponent, {
    inputs: {
      result: null,
      recommended: 0,
      scalesPlan: true,
      factor: 1,
      interactive: true,
      ...inputs,
    },
    on: {
      submitResult: (reps: number) => state.submitted.push(reps),
      clearResult: () => state.cleared++,
    },
  });
  return state;
}

const byTestId = (id: string): HTMLElement =>
  document.querySelector(`[data-testid="${id}"]`) as HTMLElement;

const repsField = (): HTMLInputElement =>
  byTestId('plan-test-reps') as HTMLInputElement;

describe('PlanTestInputComponent', () => {
  it('should offer a result field on a test day that prescribes nothing', async () => {
    // given the opening test of a plan with no recommended figure —
    // the case that previously rendered no input at all
    await setup({ recommended: 0 });

    // then there is somewhere to put the measured maximum
    expect(repsField()).toBeTruthy();
    expect(byTestId('plan-test-submit')).toBeTruthy();
  });

  it('should emit the entered result', async () => {
    // given an empty field
    const state = await setup();

    // when the user types their maximum and submits
    await userEvent.type(repsField(), '37');
    await userEvent.click(byTestId('plan-test-submit'));

    // then the parent is handed the number to persist
    expect(state.submitted).toEqual([37]);
  });

  it('should submit on Enter', async () => {
    // given an empty field
    const state = await setup();

    // when the user finishes with the keyboard
    await userEvent.type(repsField(), '24{Enter}');

    // then the result is recorded without reaching for the button
    expect(state.submitted).toEqual([24]);
  });

  it('should refuse a result that is not a usable rep count', async () => {
    // given an empty field
    const state = await setup();

    // when the user types something nonsensical
    await userEvent.type(repsField(), '0');

    // then the submit stays closed and the reason is shown
    expect(
      byTestId('plan-test-submit').getAttribute('disabled')
    ).not.toBeNull();
    expect(byTestId('plan-test-error')).toBeTruthy();
    expect(state.submitted).toEqual([]);
  });

  it('should not offer submission while the field is empty', async () => {
    // given / when
    await setup();

    // then there is nothing to submit, and no error scolding the user yet
    expect(
      byTestId('plan-test-submit').getAttribute('disabled')
    ).not.toBeNull();
    expect(byTestId('plan-test-error')).toBeNull();
  });

  it('should prefill an existing result so a revision starts from it', async () => {
    // given a test already taken at 30
    await setup({ result: 30 });

    // then the field carries it and the button offers an update
    expect(repsField().value).toBe('30');
    expect(byTestId('plan-test-submit').textContent).toContain('Aktualisieren');
  });

  it('should offer to discard an existing result', async () => {
    // given a recorded result
    const state = await setup({ result: 30 });

    // when the user discards it
    await userEvent.click(byTestId('plan-test-clear'));

    // then the parent is asked to drop it
    expect(state.cleared).toBe(1);
  });

  it('should not offer to discard when there is nothing recorded', async () => {
    // given an untaken test
    await setup({ result: null });

    // then
    expect(byTestId('plan-test-clear')).toBeNull();
  });

  it('should explain that the result adjusts the following days', async () => {
    // given the plan's opening test, untaken
    await setup({ scalesPlan: true, result: null });

    // then the user is told what recording it does — and what skipping does
    expect(
      screen.getByText(/passt die Vorgaben der folgenden Tage an/)
    ).toBeTruthy();
    expect(screen.getByText(/normalen Planwerte/)).toBeTruthy();
  });

  it('should report the adjustment a recorded result put in force', async () => {
    // given a result that moved the plan to 150 %
    await setup({ scalesPlan: true, result: 30, factor: 1.5 });

    // then the effect is stated in the user's own terms
    expect(screen.getByText(/150/)).toBeTruthy();
  });

  it('should stay silent about scaling on the closing test', async () => {
    // given the final test — nothing follows it to rescale
    await setup({ scalesPlan: false, result: null });

    // then no promise is made about later days
    expect(screen.queryByText(/folgenden Tage/)).toBeNull();
  });

  it('should show the recommended figure when the day names one', async () => {
    // given a test day recommending 100
    await setup({ recommended: 100 });

    // then it reads as a reference, not as the answer
    expect(screen.getByText(/Richtwert/)).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
  });

  it('should stay read-only for a future day or an inactive plan', async () => {
    // given a non-interactive render
    await setup({ interactive: false, result: 30 });

    // then nothing can be written from here
    expect(repsField().disabled).toBe(true);
    expect(
      byTestId('plan-test-submit').getAttribute('disabled')
    ).not.toBeNull();
    expect(byTestId('plan-test-clear')).toBeNull();
  });
});
