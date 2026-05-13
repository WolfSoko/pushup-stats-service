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

  it('ships the dialog-supported movement-pattern categories', () => {
    const ids = new Set(EXERCISE_CATEGORIES.map((c) => c.id));
    // `carry` (distance) and `strength` (weight) stay declared in
    // ExerciseCategoryId but are intentionally absent from
    // EXERCISE_CATEGORIES until the training-entry dialog grows
    // weight + distance form support — see catalog header comment.
    for (const id of [
      'push',
      'pull',
      'squat',
      'hinge',
      'lunge',
      'core',
      'cardio',
      'mobility',
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('omits weight/distance categories until dialog gains support', () => {
    const ids = new Set(EXERCISE_CATEGORIES.map((c) => c.id));
    expect(ids.has('carry')).toBe(false);
    expect(ids.has('strength')).toBe(false);
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

  it('keeps legacy core ids stable so existing Firestore docs resolve', () => {
    const ids = new Set(EXERCISE_CATALOG.map((d) => d.id));
    // `abs.*` and `plank.*` ids predate the movement-pattern restructure
    // (moved into the `core` category, ids untouched).
    expect(ids.has('abs.situps')).toBe(true);
    expect(ids.has('abs.crunches')).toBe(true);
    expect(ids.has('abs.legraises')).toBe(true);
    expect(ids.has('abs.russiantwist')).toBe(true);
    expect(ids.has('abs.mountainclimbers')).toBe(true);
    expect(ids.has('plank.standard')).toBe(true);
  });

  it('keeps legacy lower-body ids stable', () => {
    const ids = new Set(EXERCISE_CATALOG.map((d) => d.id));
    // `legs.*` ids predate the squat/hinge/lunge split — kept stable,
    // only categorisation moved.
    expect(ids.has('legs.squats')).toBe(true);
    expect(ids.has('legs.lunges')).toBe(true);
    expect(ids.has('legs.glutebridge')).toBe(true);
    expect(ids.has('legs.calfraises')).toBe(true);
    expect(ids.has('legs.jumpsquats')).toBe(true);
  });

  it('exposes plank.standard as a time-measurement core exercise', () => {
    const plank = EXERCISE_CATALOG.find((d) => d.id === 'plank.standard');
    expect(plank?.measurement).toBe('time');
    expect(plank?.unit).toBe('s');
    expect(plank?.categoryId).toBe('core');
  });

  it('exposes cardio.running as the first distance-time exercise', () => {
    const running = EXERCISE_CATALOG.find((d) => d.id === 'cardio.running');
    expect(running?.measurement).toBe('distance-time');
    expect(running?.unit).toBe('m');
    expect(running?.categoryId).toBe('cardio');
    expect(running?.min).toBeGreaterThan(0);
    expect(running?.max).toBeGreaterThanOrEqual(50_000);
  });

  it('ships pull/hinge/mobility exercises', () => {
    const ids = new Set(EXERCISE_CATALOG.map((d) => d.id));
    expect(ids.has('pull.pullups')).toBe(true);
    expect(ids.has('pull.rows')).toBe(true);
    expect(ids.has('hinge.singlelegRdl')).toBe(true);
    expect(ids.has('mobility.stretching')).toBe(true);
  });

  it('does not yet ship distance- or weight-measured catalog entries', () => {
    // The training-entry dialog only renders `reps` / `time` /
    // `distance-time` form rows. Surfacing `distance` (carry) or
    // `weight` (strength) catalog entries before the dialog gains
    // those input shapes would route users into a save-error path.
    for (const def of EXERCISE_CATALOG) {
      expect(def.measurement).not.toBe('distance');
      expect(def.measurement).not.toBe('weight');
    }
  });

  it('attaches variants to compound exercises that benefit from them', () => {
    const pullups = EXERCISE_CATALOG.find((d) => d.id === 'pull.pullups');
    expect(pullups?.variants?.length).toBeGreaterThan(0);
    const plank = EXERCISE_CATALOG.find((d) => d.id === 'plank.standard');
    expect(plank?.variants?.length).toBeGreaterThan(0);
    const lunges = EXERCISE_CATALOG.find((d) => d.id === 'legs.lunges');
    expect(lunges?.variants?.length).toBeGreaterThan(0);
  });
});

describe('findExerciseDefinition', () => {
  it('resolves a legacy core id to the core category', () => {
    expect(findExerciseDefinition('abs.situps')?.categoryId).toBe('core');
  });

  it('resolves a legacy lower-body id to its movement pattern', () => {
    expect(findExerciseDefinition('legs.squats')?.categoryId).toBe('squat');
    expect(findExerciseDefinition('legs.lunges')?.categoryId).toBe('lunge');
    expect(findExerciseDefinition('legs.glutebridge')?.categoryId).toBe(
      'hinge'
    );
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
    expect(findExerciseCategory('core')?.nameKey).toBe(
      '@@exercise.category.core'
    );
    expect(findExerciseCategory('squat')?.nameKey).toBe(
      '@@exercise.category.squat'
    );
  });

  it('returns null for unknown ids', () => {
    expect(findExerciseCategory('does-not-exist')).toBeNull();
  });
});

describe('exercisesByCategory', () => {
  it('groups every catalog entry under its category', () => {
    const map = exercisesByCategory();
    const core = map.get('core') ?? [];
    const squat = map.get('squat') ?? [];
    const lunge = map.get('lunge') ?? [];
    expect(core.map((d) => d.id)).toContain('abs.situps');
    expect(squat.map((d) => d.id)).toContain('legs.squats');
    expect(lunge.map((d) => d.id)).toContain('legs.lunges');
  });

  it('declares a bucket for every known category, even when empty', () => {
    const map = exercisesByCategory();
    for (const cat of EXERCISE_CATEGORIES) {
      expect(map.has(cat.id)).toBe(true);
    }
  });
});
