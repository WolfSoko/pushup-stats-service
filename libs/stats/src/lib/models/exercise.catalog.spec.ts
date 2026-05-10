import {
  EXERCISE_CATALOG,
  EXERCISE_CATEGORIES,
  exercisesByCategory,
  findExerciseCategory,
  findExerciseDefinition,
} from './exercise.catalog';

describe('EXERCISE_CATEGORIES', () => {
  it('declares each category id at most once', () => {
    const ids = EXERCISE_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses XLIFF i18n keys for every category name', () => {
    for (const cat of EXERCISE_CATEGORIES) {
      expect(cat.nameKey).toMatch(/^@@/);
    }
  });
});

describe('EXERCISE_CATALOG', () => {
  it('declares each exercise id at most once', () => {
    const ids = EXERCISE_CATALOG.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points every exercise at a known category', () => {
    const known = new Set(EXERCISE_CATEGORIES.map((c) => c.id));
    for (const def of EXERCISE_CATALOG) {
      expect(known.has(def.categoryId)).toBe(true);
    }
  });

  it('uses XLIFF i18n keys for every catalog name', () => {
    for (const def of EXERCISE_CATALOG) {
      expect(def.nameKey).toMatch(/^@@/);
    }
  });

  it('keeps min < max for every catalog entry', () => {
    for (const def of EXERCISE_CATALOG) {
      expect(def.min).toBeLessThan(def.max);
    }
  });

  it('includes the phase-0 sit-ups and squats exercises', () => {
    const ids = new Set(EXERCISE_CATALOG.map((d) => d.id));
    expect(ids.has('abs.situps')).toBe(true);
    expect(ids.has('legs.squats')).toBe(true);
  });

  it('includes the additional abs and legs exercises', () => {
    const ids = new Set(EXERCISE_CATALOG.map((d) => d.id));
    for (const id of [
      'abs.crunches',
      'abs.legraises',
      'abs.russiantwist',
      'abs.mountainclimbers',
      'legs.lunges',
      'legs.glutebridge',
      'legs.calfraises',
      'legs.jumpsquats',
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('exposes plank.standard as the time-measurement entry point', () => {
    const plank = EXERCISE_CATALOG.find((d) => d.id === 'plank.standard');
    expect(plank?.measurement).toBe('time');
    expect(plank?.unit).toBe('s');
  });

  it('exposes cardio.running as the first distance-time exercise', () => {
    const running = EXERCISE_CATALOG.find((d) => d.id === 'cardio.running');
    expect(running?.measurement).toBe('distance-time');
    expect(running?.unit).toBe('m');
    expect(running?.categoryId).toBe('cardio');
    expect(running?.min).toBeGreaterThan(0);
    expect(running?.max).toBeGreaterThanOrEqual(50_000);
  });
});

describe('findExerciseDefinition', () => {
  it('returns a known catalog entry by id', () => {
    expect(findExerciseDefinition('abs.situps')?.categoryId).toBe('abs');
  });

  it('returns null for unknown ids', () => {
    expect(findExerciseDefinition('does-not-exist')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(findExerciseDefinition('')).toBeNull();
    expect(findExerciseDefinition(null)).toBeNull();
    expect(findExerciseDefinition(undefined)).toBeNull();
  });
});

describe('findExerciseCategory', () => {
  it('returns a known category by id', () => {
    expect(findExerciseCategory('abs')?.nameKey).toBe(
      '@@exercise.category.abs'
    );
  });

  it('returns null for unknown ids', () => {
    expect(findExerciseCategory('does-not-exist')).toBeNull();
  });
});

describe('exercisesByCategory', () => {
  it('groups every catalog entry under its category', () => {
    const map = exercisesByCategory();
    const abs = map.get('abs') ?? [];
    const legs = map.get('legs') ?? [];
    expect(abs.map((d) => d.id)).toContain('abs.situps');
    expect(legs.map((d) => d.id)).toContain('legs.squats');
  });

  it('declares a bucket for every known category, even when empty', () => {
    const map = exercisesByCategory();
    for (const cat of EXERCISE_CATEGORIES) {
      expect(map.has(cat.id)).toBe(true);
    }
  });
});
