import { facetKindFor } from './analysis.store';

describe('facetKindFor', () => {
  it('routes reps and weight to the same facet kind', () => {
    // Regression (Codex P2): the card template iterates facets with
    // `@for … track facet.kind`. If `weight` and `reps` produced two
    // separate bucket entries with the same emitted kind, Angular
    // would surface NG0955 and reuse the wrong DOM row. Collapsing at
    // the kind level (here) is the single source of truth that
    // prevents the duplicate bucket — the catalog has no `weight`
    // entries today, but custom user exercises can declare one.
    expect(facetKindFor('reps')).toBe('reps');
    expect(facetKindFor('weight')).toBe('reps');
  });

  it('preserves time, distance and distance-time as their own kinds', () => {
    expect(facetKindFor('time')).toBe('time');
    expect(facetKindFor('distance')).toBe('distance');
    expect(facetKindFor('distance-time')).toBe('distance-time');
  });
});
