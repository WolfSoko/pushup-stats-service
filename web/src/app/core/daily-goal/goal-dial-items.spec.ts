import type { DailyGoalItemView } from '../daily-goal.helpers';
import { toGoalDialItems } from './goal-dial-items';

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

const nothingPending = () => false;

describe('toGoalDialItems', () => {
  it('should label an open goal with the amount still missing', () => {
    // given / when
    const [dial] = toGoalDialItems([item()], nothingPending);

    // then
    expect(dial.label).toBe('Liegestütze +60');
    expect(dial.disabled).toBe(false);
    expect(dial.busy).toBe(false);
  });

  it('should render a reached goal as a disabled, label-only entry', () => {
    // given / when
    const [dial] = toGoalDialItems(
      [item({ value: 100, remaining: 0, reached: true })],
      nothingPending
    );

    // then
    expect(dial.label).toBe('Liegestütze');
    expect(dial.reached).toBe(true);
    expect(dial.disabled).toBe(true);
  });

  it('should disable a goal that needs a manual entry', () => {
    // given / when
    const [dial] = toGoalDialItems([item({ fillable: false })], nothingPending);

    // then
    expect(dial.disabled).toBe(true);
  });

  it('should flag a goal whose write is in flight as busy but keep it enabled', () => {
    // given / when
    const [dial, other] = toGoalDialItems(
      [item(), item({ id: 'g2' })],
      (id) => id === 'g1'
    );

    // then
    expect(dial.busy).toBe(true);
    expect(dial.disabled).toBe(false);
    expect(other.busy).toBe(false);
  });
});
