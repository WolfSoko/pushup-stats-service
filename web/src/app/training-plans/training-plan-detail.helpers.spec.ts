import {
  detectPushupTypes,
  findPlanBySlug,
  localizePushupType,
  localizePushupTypeSlug,
  TrainingPlan,
  TrainingPlanDay,
} from '@pu-stats/models';
import {
  buildWeeks,
  formatSets,
  messageForLogResult,
  pushupTypeChipsForDay,
  PlanProgress,
} from './training-plan-detail.helpers';

const LOCALE = 'de';

function day(overrides: Partial<TrainingPlanDay>): TrainingPlanDay {
  return {
    dayIndex: 1,
    kind: 'main',
    targetReps: 10,
    description: '',
    ...overrides,
  };
}

function planWith(days: TrainingPlanDay[]): TrainingPlan {
  return {
    id: 'test-v1',
    slug: 'test',
    title: 'Test',
    summary: 'Summary',
    level: 'beginner',
    totalDays: days.length,
    days,
  };
}

function noProgress(): PlanProgress {
  return { currentDay: null, completed: new Set(), skipped: new Set() };
}

describe('formatSets', () => {
  it('should join sets with a middot inside parentheses', () => {
    // given a multi-set decomposition
    const sets = [15, 12, 10];
    // when formatting it
    const result = formatSets(sets);
    // then it renders the dotted, parenthesised form
    expect(result).toBe('(15 · 12 · 10)');
  });

  it('should render a single-element set without separators', () => {
    // given / when / then
    expect(formatSets([20])).toBe('(20)');
  });

  it('should render an empty set as empty parentheses', () => {
    // given / when / then
    expect(formatSets([])).toBe('()');
  });
});

describe('pushupTypeChipsForDay', () => {
  it('should return no chips for rest days regardless of description', () => {
    // given a rest day whose description mentions a known variant
    const restDay = day({
      kind: 'rest',
      targetReps: 0,
      description: 'Archer-Liegestütze zur Erholung',
    });
    // when resolving its chips
    const chips = pushupTypeChipsForDay(restDay, LOCALE);
    // then none are produced
    expect(chips).toEqual([]);
  });

  it('should map every detected pushup type to a localized chip', () => {
    // given a description carrying at least one detectable variant
    const description = 'Archer-Liegestütze und Diamant-Liegestütze';
    const detected = detectPushupTypes(description);
    const subject = day({ kind: 'main', description });
    // when resolving chips
    const chips = pushupTypeChipsForDay(subject, LOCALE);
    // then there is one chip per detected type with localized fields
    expect(detected.length).toBeGreaterThan(0);
    expect(chips.length).toBe(detected.length);
    detected.forEach((type, i) => {
      const localized = localizePushupType(type, LOCALE);
      expect(chips[i]).toEqual({
        slug: localizePushupTypeSlug(type, LOCALE),
        name: localized.name,
        summary: localized.summary,
      });
    });
  });

  it('should return no chips when the description matches no known type', () => {
    // given a description with no recognisable variant
    const subject = day({
      kind: 'main',
      description: 'xxxyyyzzz nothing here',
    });
    // when resolving chips
    const chips = pushupTypeChipsForDay(subject, LOCALE);
    // then none are produced
    expect(chips).toEqual([]);
  });
});

describe('buildWeeks', () => {
  it('should group days into 1-based seven-day week buckets', () => {
    // given a 10-day plan
    const days = Array.from({ length: 10 }, (_, i) =>
      day({ dayIndex: i + 1, description: '' })
    );
    // when building weeks with no active progress
    const weeks = buildWeeks(planWith(days), noProgress(), LOCALE);
    // then days 1-7 are week 1 and 8-10 are week 2
    expect(weeks.map((w) => w.weekIndex)).toEqual([1, 2]);
    expect(weeks[0].rows.map((r) => r.day.dayIndex)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(weeks[1].rows.map((r) => r.day.dayIndex)).toEqual([8, 9, 10]);
  });

  it('should return an empty array for a plan with no days', () => {
    // given / when / then
    expect(buildWeeks(planWith([]), noProgress(), LOCALE)).toEqual([]);
  });

  it('should flag today, completed, skipped and future from progress', () => {
    // given a 4-day plan with progress where today is day 2
    const days = [1, 2, 3, 4].map((d) => day({ dayIndex: d }));
    const progress: PlanProgress = {
      currentDay: 2,
      completed: new Set([1]),
      skipped: new Set([3]),
    };
    // when building weeks
    const rows = buildWeeks(planWith(days), progress, LOCALE)[0].rows;
    // then each row reflects its status relative to the current day
    expect(rows[0]).toMatchObject({ isCompleted: true, isFuture: false });
    expect(rows[1]).toMatchObject({ isToday: true, isFuture: false });
    expect(rows[2]).toMatchObject({ isSkipped: true, isFuture: true });
    expect(rows[3]).toMatchObject({ isFuture: true, isToday: false });
  });

  it('should never flag any day as today or future when currentDay is null', () => {
    // given a plan viewed without an active progress (currentDay null)
    const days = [1, 2, 3].map((d) => day({ dayIndex: d }));
    // when building weeks
    const rows = buildWeeks(planWith(days), noProgress(), LOCALE)[0].rows;
    // then no row is marked today or future
    expect(rows.every((r) => !r.isToday && !r.isFuture)).toBe(true);
  });

  it('should sort week buckets ascending even if days arrive unordered', () => {
    // given days listed out of order spanning two weeks
    const days = [day({ dayIndex: 9 }), day({ dayIndex: 1 })];
    // when building weeks
    const weeks = buildWeeks(planWith(days), noProgress(), LOCALE);
    // then the buckets come back in ascending week order
    expect(weeks.map((w) => w.weekIndex)).toEqual([1, 2]);
  });

  it('should attach pushup-type chips to non-rest rows and none to rest rows', () => {
    // given a real catalog plan with type-rich descriptions
    const plan = findPlanBySlug('one-arm-12w');
    expect(plan).not.toBeNull();
    if (!plan) return;
    // when building weeks
    const weeks = buildWeeks(plan, noProgress(), LOCALE);
    const allRows = weeks.flatMap((w) => w.rows);
    // then rest rows carry no chips and at least one non-rest row does
    expect(allRows.some((r) => r.pushupTypes.length > 0)).toBe(true);
    expect(
      allRows
        .filter((r) => r.day.kind === 'rest')
        .every((r) => r.pushupTypes.length === 0)
    ).toBe(true);
  });
});

describe('messageForLogResult', () => {
  it('should return a message for a freshly logged day', () => {
    // given / when / then
    expect(messageForLogResult('logged')).toBeTruthy();
  });

  it('should return a message when the day was already logged', () => {
    // given / when / then
    expect(messageForLogResult('already-logged')).toBeTruthy();
  });

  it('should return a message when data is not ready yet', () => {
    // given / when / then
    expect(messageForLogResult('not-ready')).toBeTruthy();
  });

  it('should return null for silent outcomes (in-flight, noop)', () => {
    // given / when / then
    expect(messageForLogResult('in-flight')).toBeNull();
    expect(messageForLogResult('noop')).toBeNull();
  });
});
