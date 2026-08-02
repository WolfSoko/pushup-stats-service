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

  it('should not emit when a row is un-ticked', async () => {
    // given an interactive row
    const { complete } = await setup([item()]);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;

    // when a change event arrives with checked=false
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));

    // then nothing is logged — un-ticking cannot un-log an entry
    expect(complete).not.toHaveBeenCalled();
  });

  it('should lock a reached goal as checked', async () => {
    // given / when
    const { complete } = await setup([
      item({ value: 100, remaining: 0, percent: 100, reached: true }),
    ]);

    // then — goals are scored from entries, un-ticking would not stick.
    // The row stays focusable (`disabledInteractive`) so its tooltip is
    // reachable, so the guard is asserted through the emit, not the DOM.
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(checkbox.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(checkbox);
    expect(complete).not.toHaveBeenCalled();
  });

  it('should refuse the check-off of a goal that needs a manual entry', async () => {
    // given a goal that cannot be filled with one click
    const { complete } = await setup([item({ fillable: false })]);

    // when
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(checkbox);

    // then
    expect(complete).not.toHaveBeenCalled();
  });

  it('should refuse a goal whose check-off write is in flight', async () => {
    // given a pending write for this goal
    const { complete } = await setup([item()], true, new Set(['g1']));

    // when
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(checkbox);

    // then a double tap cannot write the gap twice
    expect(complete).not.toHaveBeenCalled();
  });

  it('should render a read-only list without checkboxes', async () => {
    // given / when
    await setup([item()], false);

    // then
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText('Liegestütze')).toBeTruthy();
  });
});
