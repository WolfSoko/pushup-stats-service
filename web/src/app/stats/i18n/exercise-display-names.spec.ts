import type { ExerciseVariant } from '@pu-stats/models';

import {
  categoryDisplayName,
  exerciseDisplayName,
  kindDisplayName,
  variantDisplayName,
} from './exercise-display-names';

describe('exerciseDisplayName', () => {
  it('resolves a known catalog id to its localized display name', () => {
    // `$localize` returns the source-locale string in the test runtime
    // (no locale runtime is loaded), so we assert on the German source.
    expect(exerciseDisplayName('abs.situps')).toBe('Sit-ups');
    expect(exerciseDisplayName('pull.pullups')).toBe('Klimmzüge');
    expect(exerciseDisplayName('cardio.running')).toBe('Laufen');
  });

  it('falls back to the raw id when the id is unknown', () => {
    expect(exerciseDisplayName('does.not.exist')).toBe('does.not.exist');
  });
});

describe('kindDisplayName', () => {
  it('returns the Liegestütze label for the legacy pushup filter key', () => {
    // Pushup variants keep their own dedicated bucket separate from
    // the generic `push` movement-pattern category, so the legacy
    // filter key `'pushup'` resolves to "Liegestütze".
    expect(kindDisplayName('pushup')).toBe('Liegestütze');
  });

  it('resolves a catalog exerciseId to its display name', () => {
    expect(kindDisplayName('legs.squats')).toBe('Kniebeugen');
  });

  it('falls back to the raw value when the id is not in the catalog', () => {
    expect(kindDisplayName('custom-uuid-not-in-catalog')).toBe(
      'custom-uuid-not-in-catalog'
    );
  });
});

describe('variantDisplayName', () => {
  it('resolves a known variant nameKey to its localized label', () => {
    const variant: ExerciseVariant = {
      id: 'wide-grip',
      nameKey: '@@exercise.variant.pullups.wide-grip',
    };
    expect(variantDisplayName(variant)).toBe('Breiter Griff');
  });

  it('falls back to the variant id when the nameKey is not mapped', () => {
    // Future-compat guard: a variant added to the catalog before the
    // display-names map is updated must still render — the raw id is
    // the least-bad fallback (vs. blank or "undefined").
    const variant: ExerciseVariant = {
      id: 'experimental-variant',
      nameKey: '@@exercise.variant.unknown.experimental',
    };
    expect(variantDisplayName(variant)).toBe('experimental-variant');
  });
});

describe('categoryDisplayName', () => {
  it('returns the German source label for the movement-pattern categories', () => {
    expect(categoryDisplayName('pushup')).toBe('Liegestütze');
    expect(categoryDisplayName('push')).toBe('Drücken');
    expect(categoryDisplayName('pull')).toBe('Ziehen');
    expect(categoryDisplayName('squat')).toBe('Kniebeuge');
    expect(categoryDisplayName('hinge')).toBe('Hüftstreckung');
    expect(categoryDisplayName('lunge')).toBe('Ausfallschritt');
    expect(categoryDisplayName('core')).toBe('Rumpf');
    expect(categoryDisplayName('cardio')).toBe('Ausdauer');
    expect(categoryDisplayName('mobility')).toBe('Mobilität');
  });

  it('falls back to the raw id when the category is unknown', () => {
    // `carry` and `strength` stay in the type union (forward-compat)
    // but their display labels are intentionally absent from
    // CATEGORY_DISPLAY_NAMES until the dialog gains weight + distance
    // form support. The runtime fallback returns the raw id so the
    // analysis page doesn't render "undefined" if it ever resolves
    // entries to one of those categories before the labels ship.
    expect(categoryDisplayName('carry')).toBe('carry');
    expect(categoryDisplayName('strength')).toBe('strength');
  });
});
