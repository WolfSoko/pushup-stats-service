import {
  buildExercisePickerGroups,
  filterExercisePickerGroups,
  initialSuggestedExerciseId,
  normalizeSearch,
  RECENT_SUGGESTION_LIMIT,
} from './exercise-picker.groups';

describe('buildExercisePickerGroups', () => {
  it('should list catalog categories when nothing is suggested', () => {
    // given / when
    const groups = buildExercisePickerGroups();

    // then
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.map((g) => g.key)).toContain('core');
    expect(groups.map((g) => g.key)).not.toContain('planned');
    expect(groups.map((g) => g.key)).not.toContain('recent');
  });

  it('should put planned exercises first, then recent ones', () => {
    // given / when
    const groups = buildExercisePickerGroups({
      plannedExerciseIds: ['legs.squats'],
      recentExerciseIds: ['abs.situps'],
    });

    // then
    expect(groups[0].key).toBe('planned');
    expect(groups[0].options.map((o) => o.id)).toEqual(['legs.squats']);
    expect(groups[1].key).toBe('recent');
    expect(groups[1].options.map((o) => o.id)).toEqual(['abs.situps']);
  });

  it('should keep suggested exercises in their category group as well', () => {
    // given / when
    const groups = buildExercisePickerGroups({
      plannedExerciseIds: ['abs.situps'],
    });

    // then
    const core = groups.find((g) => g.key === 'core');
    expect(core?.options.map((o) => o.id)).toContain('abs.situps');
  });

  it('should drop unknown and duplicate suggestion ids', () => {
    // given / when
    const groups = buildExercisePickerGroups({
      plannedExerciseIds: ['abs.situps', 'abs.situps', 'gone.exercise'],
    });

    // then
    expect(groups[0].options.map((o) => o.id)).toEqual(['abs.situps']);
  });

  it('should not repeat a planned exercise in the recent group', () => {
    // given / when
    const groups = buildExercisePickerGroups({
      plannedExerciseIds: ['pushup'],
      recentExerciseIds: ['pushup', 'abs.situps'],
    });

    // then
    expect(groups[1].key).toBe('recent');
    expect(groups[1].options.map((o) => o.id)).toEqual(['abs.situps']);
  });

  it('should cap the recent group', () => {
    // given
    const recentExerciseIds = [
      'pushup',
      'abs.situps',
      'abs.crunches',
      'abs.legraises',
      'legs.squats',
      'legs.lunges',
      'pull.pullups',
    ];

    // when
    const groups = buildExercisePickerGroups({ recentExerciseIds });

    // then
    expect(groups[0].key).toBe('recent');
    expect(groups[0].options).toHaveLength(RECENT_SUGGESTION_LIMIT);
  });
});

describe('filterExercisePickerGroups', () => {
  const groups = buildExercisePickerGroups({
    plannedExerciseIds: ['legs.squats'],
  });

  it('should return every group for an empty query', () => {
    // given / when
    const filtered = filterExercisePickerGroups('  ', groups);

    // then
    expect(filtered).toHaveLength(groups.length);
  });

  it('should match the exercise name ignoring case and umlauts', () => {
    // given / when
    const filtered = filterExercisePickerGroups('kniebeug', groups);

    // then
    const ids = filtered.flatMap((g) => g.options.map((o) => o.id));
    expect(ids).toContain('legs.squats');
  });

  it('should require every token to match', () => {
    // given / when
    const filtered = filterExercisePickerGroups('russian twist', groups);

    // then
    const ids = filtered.flatMap((g) => g.options.map((o) => o.id));
    expect(ids).toEqual(['abs.russiantwist']);
  });

  it('should match on the category name', () => {
    // given / when
    const filtered = filterExercisePickerGroups('rumpf', groups);

    // then
    expect(filtered.every((g) => g.options.length > 0)).toBe(true);
    const ids = filtered.flatMap((g) => g.options.map((o) => o.id));
    expect(ids).toContain('abs.situps');
  });

  it('should drop groups without a match', () => {
    // given / when
    const filtered = filterExercisePickerGroups('zzzz', groups);

    // then
    expect(filtered).toEqual([]);
  });
});

describe('initialSuggestedExerciseId', () => {
  it('should prefer the first planned exercise', () => {
    // given / when
    const id = initialSuggestedExerciseId({
      plannedExerciseIds: ['legs.squats'],
      recentExerciseIds: ['abs.situps'],
    });

    // then
    expect(id).toBe('legs.squats');
  });

  it('should fall back to the most recent exercise', () => {
    // given / when
    const id = initialSuggestedExerciseId({
      plannedExerciseIds: ['gone.exercise'],
      recentExerciseIds: ['abs.situps'],
    });

    // then
    expect(id).toBe('abs.situps');
  });

  it('should fall back to pushups without any suggestion', () => {
    // given / when / then
    expect(initialSuggestedExerciseId()).toBe('pushup');
  });
});

describe('normalizeSearch', () => {
  it('should fold umlauts, sharp s and whitespace', () => {
    // given / when / then
    expect(normalizeSearch('  Füße  Straße ')).toBe('fusse strasse');
  });
});
