import { resolveExerciseRef } from './exercise-ref.model';

describe('resolveExerciseRef', () => {
  it('should resolve a catalog exercise with a wiki entry to its name, summary and detail link', () => {
    // given / when
    const ref = resolveExerciseRef('legs.squats', undefined, 'de');
    // then
    expect(ref.name).toBe('Kniebeugen');
    expect(ref.summary).toBeTruthy();
    expect(ref.wikiLink).toEqual(['/wiki/uebungen', 'squats']);
  });

  it('should append the variant name when a variant is picked', () => {
    // given / when
    const ref = resolveExerciseRef('legs.squats', 'sumo', 'de');
    // then
    expect(ref.name).toBe('Kniebeugen · Sumo');
  });

  it('should fall back to the wiki list page for a catalog id without a wiki entry', () => {
    // given / when
    const ref = resolveExerciseRef('does.not.exist', undefined, 'de');
    // then
    expect(ref.summary).toBeNull();
    expect(ref.wikiLink).toEqual(['/wiki/uebungen']);
  });

  it('should route a pushup variant to the pushup-types wiki with its own slug', () => {
    // given / when
    const ref = resolveExerciseRef('pushup', 'diamond', 'de');
    // then
    expect(ref.name).toBe('Diamant-Liegestütze');
    expect(ref.summary).toBeTruthy();
    expect(ref.wikiLink).toEqual(['/wiki/liegestuetz-typen', 'diamant']);
  });

  it('should fall back to the pushup-types list page when no variant is stored', () => {
    // given / when
    const ref = resolveExerciseRef('pushup', undefined, 'de');
    // then
    expect(ref.name).toBe('Liegestütze');
    expect(ref.summary).toBeNull();
    expect(ref.wikiLink).toEqual(['/wiki/liegestuetz-typen']);
  });
});
