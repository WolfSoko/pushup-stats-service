import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import {
  PlanTestInputComponent,
  TestResultSubmit,
} from './plan-test-input.component';
import { DayTestField } from './training-plan-detail.models';

function field(overrides: Partial<DayTestField> = {}): DayTestField {
  return {
    itemIndex: 0,
    name: 'Liegestütze',
    result: null,
    recommended: '',
    unit: 'Wdh.',
    isTime: false,
    max: 2000,
    percent: 100,
    ...overrides,
  };
}

/** The three-measurement shape of a Core Foundations baseline. */
function coreFields(): DayTestField[] {
  return [
    field({ itemIndex: 0, name: 'Plank', unit: 's', isTime: true, max: 10000 }),
    field({ itemIndex: 1, name: 'Liegestütze' }),
    field({
      itemIndex: 2,
      name: 'Hollow Hold',
      unit: 's',
      isTime: true,
      max: 10000,
    }),
  ];
}

interface Harness {
  submitted: TestResultSubmit[];
  cleared: number[];
}

async function setup(
  fields: DayTestField[] = [field()],
  inputs: { scalesPlan?: boolean; interactive?: boolean } = {}
): Promise<Harness> {
  const state: Harness = { submitted: [], cleared: [] };
  await render(PlanTestInputComponent, {
    inputs: { fields, scalesPlan: true, interactive: true, ...inputs },
    on: {
      submitResult: (e: TestResultSubmit) => state.submitted.push(e),
      clearResult: (i: number) => state.cleared.push(i),
    },
  });
  return state;
}

const byTestId = (id: string): HTMLElement =>
  document.querySelector(`[data-testid="${id}"]`) as HTMLElement;

const repsField = (i: number): HTMLInputElement =>
  byTestId(`plan-test-reps-${i}`) as HTMLInputElement;

describe('PlanTestInputComponent', () => {
  it('should offer one field per measurable exercise of the day', async () => {
    // given a baseline measuring a plank hold, pushups and a hollow hold —
    // the case that previously rendered a single pushup field
    await setup(coreFields());

    // then each measurement can be entered on its own
    expect(repsField(0)).toBeTruthy();
    expect(repsField(1)).toBeTruthy();
    expect(repsField(2)).toBeTruthy();
    expect(screen.getByText('Plank')).toBeTruthy();
    expect(screen.getByText('Hollow Hold')).toBeTruthy();
  });

  it('should label each field with its own unit', async () => {
    // given a mix of holds and rep counts
    await setup(coreFields());

    // then seconds are not presented as repetitions
    expect(screen.getAllByText('s')).toHaveLength(2);
    expect(screen.getByText('Wdh.')).toBeTruthy();
  });

  it('should emit the entered value with the field it belongs to', async () => {
    // given the three-field baseline
    const state = await setup(coreFields());

    // when the user fills the pushup field
    await userEvent.type(repsField(1), '37');
    await userEvent.click(byTestId('plan-test-submit-1'));

    // then the parent learns which measurement this was
    expect(state.submitted).toEqual([{ itemIndex: 1, value: 37 }]);
  });

  it('should keep the fields independent', async () => {
    // given the three-field baseline
    const state = await setup(coreFields());

    // when two different measurements are entered
    await userEvent.type(repsField(0), '45');
    await userEvent.click(byTestId('plan-test-submit-0'));
    await userEvent.type(repsField(2), '30');
    await userEvent.click(byTestId('plan-test-submit-2'));

    // then neither overwrites the other
    expect(state.submitted).toEqual([
      { itemIndex: 0, value: 45 },
      { itemIndex: 2, value: 30 },
    ]);
  });

  it('should submit on Enter', async () => {
    const state = await setup();
    await userEvent.type(repsField(0), '24{Enter}');
    expect(state.submitted).toEqual([{ itemIndex: 0, value: 24 }]);
  });

  it('should accept a hold beyond the rep ceiling', async () => {
    // given a plank field, whose ceiling is a duration
    const state = await setup([
      field({
        itemIndex: 0,
        name: 'Plank',
        unit: 's',
        isTime: true,
        max: 10000,
      }),
    ]);

    // when a long hold is entered
    await userEvent.type(repsField(0), '2400');
    await userEvent.click(byTestId('plan-test-submit-0'));

    // then it is not rejected as an implausible rep count
    expect(state.submitted).toEqual([{ itemIndex: 0, value: 2400 }]);
  });

  it('should refuse a value that is not usable', async () => {
    const state = await setup();
    await userEvent.type(repsField(0), '0');

    expect(
      byTestId('plan-test-submit-0').getAttribute('disabled')
    ).not.toBeNull();
    expect(byTestId('plan-test-error-0')).toBeTruthy();
    expect(state.submitted).toEqual([]);
  });

  it('should not scold the user before they type', async () => {
    await setup();
    expect(
      byTestId('plan-test-submit-0').getAttribute('disabled')
    ).not.toBeNull();
    expect(byTestId('plan-test-error-0')).toBeNull();
  });

  it('should prefill an existing value so a revision starts from it', async () => {
    await setup([field({ result: 30 })]);
    expect(repsField(0).value).toBe('30');
    expect(byTestId('plan-test-submit-0').textContent).toContain(
      'Aktualisieren'
    );
  });

  it('should discard only the value it was asked to', async () => {
    // given two recorded measurements
    const state = await setup([
      field({
        itemIndex: 0,
        name: 'Plank',
        result: 45,
        unit: 's',
        isTime: true,
      }),
      field({ itemIndex: 1, name: 'Liegestütze', result: 12 }),
    ]);

    // when the second is discarded
    await userEvent.click(byTestId('plan-test-clear-1'));

    // then the first is untouched
    expect(state.cleared).toEqual([1]);
    expect(byTestId('plan-test-clear-0')).toBeTruthy();
  });

  it('should not offer to discard what was never recorded', async () => {
    await setup();
    expect(byTestId('plan-test-clear-0')).toBeNull();
  });

  it('should explain what recording does while a field is still open', async () => {
    // given a baseline only partly filled in
    await setup([field({ itemIndex: 0, result: 30 }), field({ itemIndex: 1 })]);

    // then the user is told what the results do — and what skipping does
    expect(
      screen.getByText(/passen die Vorgaben der folgenden Tage an/)
    ).toBeTruthy();
    expect(screen.getByText(/normalen Planwerte/)).toBeTruthy();
  });

  it('should report the adjustment each measurement put in force', async () => {
    // given a fully recorded baseline that moved two exercises differently
    await setup([
      field({
        itemIndex: 0,
        name: 'Plank',
        result: 60,
        percent: 200,
        unit: 's',
        isTime: true,
      }),
      field({ itemIndex: 1, name: 'Liegestütze', result: 15, percent: 150 }),
    ]);

    // then the effect is stated per exercise, not as one number
    expect(screen.getByText(/Plank 200 %/)).toBeTruthy();
    expect(screen.getByText(/Liegestütze 150 %/)).toBeTruthy();
  });

  it('should not promise scaling for a measurement the plan cannot use', async () => {
    // given a recorded value the plan defines no baseline for
    await setup([field({ result: 30, percent: null })]);

    // then it is reported as noted, not as an adjustment
    expect(screen.getByText(/Planwerte bleiben unverändert/)).toBeTruthy();
  });

  it('should stay silent about scaling on the closing test', async () => {
    // given the final test — nothing follows it to rescale
    await setup([field()], { scalesPlan: false });
    expect(screen.queryByText(/folgenden Tage/)).toBeNull();
  });

  it('should show the recommended figure when the day names one', async () => {
    await setup([field({ recommended: '100' })]);
    expect(screen.getByText(/Richtwert/)).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
  });

  it('should stay read-only for a future day or an inactive plan', async () => {
    await setup([field({ result: 30 })], { interactive: false });
    expect(repsField(0).disabled).toBe(true);
    expect(
      byTestId('plan-test-submit-0').getAttribute('disabled')
    ).not.toBeNull();
    expect(byTestId('plan-test-clear-0')).toBeNull();
  });
});
