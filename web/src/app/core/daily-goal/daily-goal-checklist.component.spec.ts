import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import type { DailyGoalItemView } from '../daily-goal.helpers';
import { DailyGoalChecklistComponent } from './daily-goal-checklist.component';

function item(overrides: Partial<DailyGoalItemView> = {}): DailyGoalItemView {
  return {
    id: 'g1',
    exerciseId: 'pushup',
    exerciseName: 'Liegestütze',
    measurement: 'reps',
    unit: 'reps',
    target: 100,
    value: 40,
    remaining: 60,
    targetDisplay: '100',
    progressDisplay: '40',
    remainingDisplay: '60',
    percent: 40,
    reached: false,
    fillable: true,
    ...overrides,
  };
}

async function setup(
  items: DailyGoalItemView[],
  interactive = true,
  pending: ReadonlySet<string> = new Set()
) {
  const complete = vitest.fn();
  await render(DailyGoalChecklistComponent, {
    inputs: { items, interactive, pending },
    on: { complete },
  });
  return { complete };
}

describe('DailyGoalChecklistComponent', () => {
  it('should render one row per goal with progress, target and share', async () => {
    // given / when
    await setup([
      item(),
      item({
        id: 'g2',
        exerciseName: 'Plank',
        progressDisplay: '1:00',
        targetDisplay: '2:00',
        percent: 50,
      }),
    ]);

    // then
    const rows = document.querySelectorAll('[data-testid="daily-goal-item"]');
    expect(rows.length).toBe(2);
    expect(screen.getByText('Liegestütze')).toBeTruthy();
    expect(document.body.textContent).toContain('40 / 100');
    expect(document.body.textContent).toContain('· 40%');
  });

  it('should emit the goal when its checkbox is ticked', async () => {
    // given
    const { complete } = await setup([item({ id: 'squats' })]);

    // when
    await userEvent.click(screen.getByRole('checkbox'));

    // then
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'squats' })
    );
  });

  it('should lock a reached goal as checked', async () => {
    // given / when
    await setup([
      item({ value: 100, remaining: 0, percent: 100, reached: true }),
    ]);

    // then — goals are scored from entries, un-ticking would not stick
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(true);
  });

  it('should disable the check-off of a goal that needs a manual entry', async () => {
    // given / when
    await setup([item({ fillable: false })]);

    // then
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(
      true
    );
  });

  it('should disable a goal whose check-off write is in flight', async () => {
    // given / when
    await setup([item()], true, new Set(['g1']));

    // then
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(
      true
    );
  });

  it('should render a read-only list without checkboxes', async () => {
    // given / when
    await setup([item()], false);

    // then
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText('Liegestütze')).toBeTruthy();
  });
});
