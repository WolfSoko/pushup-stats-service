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
    expansion.toggle(row(1, true));

    // then
    expect(expansion.isExpanded(row(1, true))).toBe(true);
  });

  it('should collapse an open day the user clicked', () => {
    // given
    const expansion = planDayExpansion();

    // when
    expansion.toggle(row(2));

    // then
    expect(expansion.isExpanded(row(2))).toBe(false);
  });

  it('should return a day to its default on a second click', () => {
    // given
    const expansion = planDayExpansion();

    // when
    expansion.toggle(row(1, true));
    expansion.toggle(row(1, true));

    // then
    expect(expansion.isExpanded(row(1, true))).toBe(false);
  });

  it('should hold a day the user opened open when it stops counting as completed', () => {
    // given — the user opened a finished day and unticks an exercise in it
    const expansion = planDayExpansion();
    expansion.toggle(row(1, true));

    // when the day is no longer completed
    // then it must not snap shut under the user's hands
    expect(expansion.isExpanded(row(1))).toBe(true);
  });

  it('should keep a day the user collapsed shut when it becomes completed', () => {
    // given — the user collapsed an open day and then finishes it
    const expansion = planDayExpansion();
    expansion.toggle(row(2));

    // when / then
    expect(expansion.isExpanded(row(2, true))).toBe(false);
  });

  it('should track each day on its own', () => {
    // given
    const expansion = planDayExpansion();

    // when
    expansion.toggle(row(1, true));

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
