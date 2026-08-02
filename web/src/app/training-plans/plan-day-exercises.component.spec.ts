import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { PlanDayExercisesComponent } from './plan-day-exercises.component';
import { DayExerciseRow } from './training-plan-detail.models';

function row(overrides: Partial<DayExerciseRow> = {}): DayExerciseRow {
  return {
    itemIndex: 0,
    name: 'Kniebeugen',
    target: '45',
    logged: '15',
    sets: '15 · 15 · 15',
    percent: 33,
    quantified: true,
    done: false,
    auto: false,
    ...overrides,
  };
}

async function setup(exercises: DayExerciseRow[], interactive = true) {
  const logExercise = vitest.fn();
  const toggleExercise = vitest.fn();
  await render(PlanDayExercisesComponent, {
    inputs: { exercises, interactive },
    on: { logExercise, toggleExercise },
  });
  return { logExercise, toggleExercise };
}

describe('PlanDayExercisesComponent', () => {
  it('should render one row per exercise with its progress', async () => {
    // given / when
    await setup([row(), row({ itemIndex: 1, name: 'Plank', target: '1:30' })]);
    // then
    expect(screen.getByText('Kniebeugen')).toBeTruthy();
    expect(screen.getByText('Plank')).toBeTruthy();
    expect(screen.getByText('/ 45')).toBeTruthy();
  });

  it('should emit a log request for the clicked exercise', async () => {
    // given
    const { logExercise } = await setup([row({ itemIndex: 2 })]);
    // when
    await userEvent.click(screen.getByRole('button'));
    // then
    expect(logExercise).toHaveBeenCalledWith(2);
  });

  it('should emit a tick when the checkbox is checked', async () => {
    // given
    const { toggleExercise } = await setup([row({ itemIndex: 1 })]);
    // when
    await userEvent.click(screen.getByRole('checkbox'));
    // then
    expect(toggleExercise).toHaveBeenCalledWith({ itemIndex: 1, done: true });
  });

  it('should emit an un-tick for an exercise that was ticked by hand', async () => {
    // given
    const { toggleExercise } = await setup([row({ done: true })]);
    // when
    await userEvent.click(screen.getByRole('checkbox'));
    // then
    expect(toggleExercise).toHaveBeenCalledWith({ itemIndex: 0, done: false });
  });

  it('should lock the checkbox of an exercise fulfilled by logged entries', async () => {
    // given / when
    await setup([row({ done: true, auto: true })]);
    // then — un-ticking it would be undone by the next mirror update
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(
      true
    );
  });

  it('should offer no actions on a read-only day', async () => {
    // given / when
    await setup([row()], false);
    // then
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(
      true
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('should hide the log action for an exercise that is already done', async () => {
    // given / when
    await setup([row({ done: true })]);
    // then
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('should show a placeholder instead of numbers for an unquantified exercise', async () => {
    // given / when
    await setup([
      row({ name: 'Burpees', quantified: false, target: '', logged: '' }),
    ]);
    // then — no log action either, there is nothing to write
    expect(screen.getByText('nach Vorgabe')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('should render nothing when the day prescribes no exercises', async () => {
    // given / when
    await setup([]);
    // then
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
