import { describe, expect, it } from 'vitest';

import { planDayExpansion } from './plan-day-expansion';
import { DayRow } from './training-plan-detail.models';

function row(dayIndex: number, isCompleted = false): DayRow {
  return {
    day: {
      dayIndex,
      kind: 'main',
      targetReps: 30,
      description: 'Tag ' + dayIndex,
    },
    weekIndex: 1,
    isToday: false,
    isCompleted,
    isSkipped: false,
    isFuture: false,
    isCheckoff: false,
    exercises: [],
    pushupTypes: [],
  };
}

describe('planDayExpansion', () => {
  it('should collapse a finished day and leave an open one expanded', () => {
    // given
    const expansion = planDayExpansion();

    // when / then
    expect(expansion.isExpanded(row(1, true))).toBe(false);
    expect(expansion.isExpanded(row(2))).toBe(true);
  });

  it('should open a finished day the user clicked', () => {
    // given
    const expansion = planDayExpansion();

    // when
    expansion.toggle(1);

    // then
    expect(expansion.isExpanded(row(1, true))).toBe(true);
  });

  it('should collapse an open day the user clicked', () => {
    // given
    const expansion = planDayExpansion();

    // when
    expansion.toggle(2);

    // then
    expect(expansion.isExpanded(row(2))).toBe(false);
  });

  it('should return a day to its default on a second click', () => {
    // given
    const expansion = planDayExpansion();

    // when
    expansion.toggle(1);
    expansion.toggle(1);

    // then
    expect(expansion.isExpanded(row(1, true))).toBe(false);
  });

  it('should track each day on its own', () => {
    // given
    const expansion = planDayExpansion();

    // when
    expansion.toggle(1);

    // then
    expect(expansion.isExpanded(row(1, true))).toBe(true);
    expect(expansion.isExpanded(row(3, true))).toBe(false);
  });

  it('should fold a day away as soon as it counts as completed', () => {
    // given — the same day, before and after it closes
    const expansion = planDayExpansion();

    // when / then
    expect(expansion.isExpanded(row(4))).toBe(true);
    expect(expansion.isExpanded(row(4, true))).toBe(false);
  });
});
