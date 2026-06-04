import {
  EXERCISE_CATALOG,
  EXERCISE_CATEGORIES,
  PUSHUP_DEFINITION,
  exercisesByCategory,
  findExerciseCategory,
  findExerciseDefinition,
} from './exercise.catalog';
import { AUTO_COUNT_QUICK_ADD_EXERCISE_IDS } from './user-config.models';
import { PUSHUP_REPS_MAX, PUSHUP_REPS_MIN } from './pushup.models';

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
    // `pushup` is kept as a dedicated bucket separate from `push`
    // because the app is called "PushUps" — Liegestütze are the
    // headline workout and deserve their own dashboard card.
    // `carry` (distance) and `strength` (weight) stay declared in
    // ExerciseCategoryId but are intentionally absent from
    // EXERCISE_CATEGORIES until the training-entry dialog grows
    // weight + distance form support — see catalog header comment.
    for (const id of [
      'pushup',
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

  it('ships push (non-pushup) / pull / hinge / mobility exercises', () => {
    const ids = new Set(EXERCISE_CATALOG.map((d) => d.id));
    expect(ids.has('push.dips')).toBe(true);
    expect(ids.has('push.benchdips')).toBe(true);
    expect(ids.has('push.handstandhold')).toBe(true);
    expect(ids.has('pull.pullups')).toBe(true);
    expect(ids.has('pull.rows')).toBe(true);
    expect(ids.has('hinge.singlelegRdl')).toBe(true);
    expect(ids.has('mobility.stretching')).toBe(true);
  });

  it('keeps pushup variants out of the new push category', () => {
    // Liegestütze stay on the legacy `pushups` Firestore collection
    // via `PushupRecord`; the `push` catalog category is reserved for
    // non-pushup pressing movements (dips, handstand). The catalog
    // must not double-list any pushup variant under push.dips* or
    // similar.
    const pushIds = EXERCISE_CATALOG.filter((d) => d.categoryId === 'push').map(
      (d) => d.id
    );
    for (const id of pushIds) {
      expect(id.startsWith('push.')).toBe(true);
      expect(id).not.toMatch(/pushup/i);
    }
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

describe('auto-count / hold-timer catalog capabilities', () => {
  it('should mark exactly pushups, situps, squats and pullups with an autoCountProfileId', () => {
    // given / when
    const profiles = EXERCISE_CATALOG.filter((d) => d.autoCountProfileId).map(
      (d) => [d.id, d.autoCountProfileId]
    );
    // then
    expect(profiles.sort()).toEqual([
      ['abs.situps', 'situp'],
      ['legs.squats', 'squat'],
      ['pull.pullups', 'pullup'],
      ['pushup', 'pushup'],
    ]);
  });

  it('should use only auto-count profile ids the web AutoCountExerciseId union supports', () => {
    // given — the union is type-only in web/auto-count, so this bounded set
    // is the catalog-side half of the contract; the orchestration spec
    // covers the round-trip through autoCountProfileForCatalogId.
    const allowed = new Set(['pushup', 'squat', 'pullup', 'situp']);
    // when / then
    for (const def of EXERCISE_CATALOG) {
      if (def.autoCountProfileId) {
        expect(allowed.has(def.autoCountProfileId)).toBe(true);
      }
    }
  });

  it('should mark plank and hollow hold with a time-measured holdTimerProfileId', () => {
    // given / when / then
    expect(findExerciseDefinition('plank.standard')?.holdTimerProfileId).toBe(
      'plank'
    );
    expect(findExerciseDefinition('core.hollowhold')?.holdTimerProfileId).toBe(
      'hollowhold'
    );
    const allowed = new Set(['plank', 'hollowhold']);
    for (const def of EXERCISE_CATALOG) {
      if (def.holdTimerProfileId) {
        expect(def.measurement).toBe('time');
        expect(allowed.has(def.holdTimerProfileId)).toBe(true);
      }
    }
  });

  it('should keep AUTO_COUNT_QUICK_ADD_EXERCISE_IDS derivable from the catalog flags', () => {
    // given the catalog auto-count flags, when the quick-add subset is
    // derived, then it equals every catalog exercise that declares a camera
    // profile — pushup is now one of them, so no hand-maintained drift.
    const derived = EXERCISE_CATALOG.filter((d) => d.autoCountProfileId)
      .map((d) => d.id)
      .sort();
    expect([...AUTO_COUNT_QUICK_ADD_EXERCISE_IDS].sort()).toEqual(derived);
  });
});

describe('PUSHUP_DEFINITION', () => {
  it('should resolve the pushup id through the catalog lookup', () => {
    // given the pushup exercise id
    // when resolved through the shared catalog lookup
    const def = findExerciseDefinition('pushup');
    // then it returns the first-class pushup definition, so consumers can
    // treat Liegestütze like any other reps exercise instead of branching
    expect(def).toBe(PUSHUP_DEFINITION);
    expect(def?.categoryId).toBe('pushup');
    expect(def?.measurement).toBe('reps');
    expect(def?.unit).toBe('reps');
    expect(def?.min).toBe(PUSHUP_REPS_MIN);
    expect(def?.max).toBe(PUSHUP_REPS_MAX);
    expect(def?.nameKey).toMatch(/^@@/);
  });

  it('should list pushup as a first-class member of EXERCISE_CATALOG', () => {
    // given the "available exercises" array iterated by the dashboard, goal
    // picker, leaderboard rebuild, rules-allowlist codegen, and display-name
    // registry
    // when scanning it for the pushup exercise
    // then it is present exactly once — post-cutover pushups live in
    // exerciseEntries and surface like every other exercise
    expect(EXERCISE_CATALOG.filter((d) => d.id === 'pushup')).toHaveLength(1);
  });

  it('should give pushup the camera "pushup" autoCountProfileId', () => {
    // given the camera 'pushup' profile the original app shipped
    // when inspecting the definition
    // then it carries the matching autoCountProfileId, so the auto-count
    // derivation treats pushup as a normal catalog auto-count exercise
    expect(PUSHUP_DEFINITION.autoCountProfileId).toBe('pushup');
  });
});
