import { PUSHUP_QUICK_ADD_EXERCISE_ID } from '@pu-stats/models';
import {
  buildQuickAddButtons,
  toQuickAddViewModel,
} from './quick-add-view-model';

describe('toQuickAddViewModel', () => {
  it('should compose the pushup sentinel label from the exercise display name', () => {
    // given the legacy pushup sentinel in reps mode
    const vm = toQuickAddViewModel(
      {
        reps: 10,
        inSpeedDial: false,
        exerciseId: PUSHUP_QUICK_ADD_EXERCISE_ID,
        mode: 'reps',
      },
      0
    );
    // then
    expect(vm.key).toBe('slot:0');
    expect(vm.exerciseId).toBe('pushup');
    expect(vm.reps).toBe(10);
    expect(vm.label).toBe(`+10 ${vm.exerciseLabel}`);
    expect(vm.exerciseLabel.length).toBeGreaterThan(0);
  });

  it('should resolve a catalog exercise reps label', () => {
    // given a rep-based catalog exercise
    const vm = toQuickAddViewModel(
      { reps: 15, inSpeedDial: false, exerciseId: 'legs.squats', mode: 'reps' },
      2
    );
    // then
    expect(vm.key).toBe('slot:2');
    expect(vm.exerciseId).toBe('legs.squats');
    expect(vm.label).toBe(`+15 ${vm.exerciseLabel}`);
  });

  it('should drop the reps prefix for auto-count mode', () => {
    // given an auto-count-capable exercise in auto-count mode
    const vm = toQuickAddViewModel(
      {
        reps: 0,
        inSpeedDial: false,
        exerciseId: 'legs.squats',
        mode: 'auto-count',
      },
      1
    );
    // then
    expect(vm.mode).toBe('auto-count');
    expect(vm.label).toBe(vm.exerciseLabel);
  });
});

describe('buildQuickAddButtons', () => {
  it('should fall back to three default pushup buttons (10/20/30) when none configured', () => {
    // given no configured quick-adds
    const buttons = buildQuickAddButtons([]);
    // then
    expect(buttons).toHaveLength(3);
    expect(buttons.map((b) => b.reps)).toEqual([10, 20, 30]);
    expect(buttons.map((b) => b.key)).toEqual(['slot:0', 'slot:1', 'slot:2']);
    expect(buttons.every((b) => b.exerciseId === 'pushup')).toBe(true);
  });

  it('should map configured quick-adds preserving slot order', () => {
    // given
    const buttons = buildQuickAddButtons([
      { reps: 5, inSpeedDial: false, exerciseId: 'pushup', mode: 'reps' },
      { reps: 25, inSpeedDial: false, exerciseId: 'legs.squats', mode: 'reps' },
    ]);
    // then
    expect(buttons).toHaveLength(2);
    expect(buttons[0].reps).toBe(5);
    expect(buttons[1].exerciseId).toBe('legs.squats');
    expect(buttons[1].key).toBe('slot:1');
  });
});
