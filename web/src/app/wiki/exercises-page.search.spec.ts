import { EXERCISE_WIKI_CATALOG } from '@pu-stats/models';

import {
  buildWikiCategories,
  filterWikiCategories,
  matchesPushupHub,
  pushupTypeHits,
} from './exercises-page.search';

const LABELS = { squat: 'Kniebeuge', core: 'Rumpf' };

describe('buildWikiCategories', () => {
  it('should list every wiki entry once', () => {
    // given / when
    const groups = buildWikiCategories('de', LABELS);

    // then
    const count = groups.reduce((sum, g) => sum + g.entries.length, 0);
    expect(count).toBe(EXERCISE_WIKI_CATALOG.length);
  });

  it('should mark catalog exercises a session can hold', () => {
    // given / when
    const squats = buildWikiCategories('de', LABELS)
      .flatMap((g) => g.entries)
      .find((e) => e.id === 'legs.squats');

    // then
    expect(squats?.workoutReady).toBe(true);
  });
});

describe('filterWikiCategories', () => {
  const groups = buildWikiCategories('de', LABELS);

  it('should keep everything for a blank query', () => {
    // given / when / then
    expect(filterWikiCategories('  ', groups)).toEqual(groups);
  });

  it('should find an exercise by part of its name without umlauts', () => {
    // given / when
    const result = filterWikiCategories('kniebeug', groups);

    // then
    const ids = result.flatMap((g) => g.entries.map((e) => e.id));
    expect(ids).toContain('legs.squats');
    expect(ids).not.toContain('plank.standard');
  });

  it('should list a whole category by its label', () => {
    // given
    const core = groups.find((g) => g.id === 'core');

    // when
    const result = filterWikiCategories('rumpf', groups);

    // then — summaries that mention the core may add entries from elsewhere.
    expect(result.find((g) => g.id === 'core')?.entries).toEqual(core?.entries);
  });

  it('should drop every group when nothing matches', () => {
    // given / when / then
    expect(filterWikiCategories('xyzzy', groups)).toEqual([]);
  });
});

describe('pushupTypeHits', () => {
  it('should find a pushup type by name', () => {
    // given / when
    const hits = pushupTypeHits('diamant', 'de');

    // then
    expect(hits).toEqual([
      expect.objectContaining({ id: 'diamond', slug: 'diamant' }),
    ]);
  });

  it('should find nothing for a blank query', () => {
    // given / when / then
    expect(pushupTypeHits('', 'de')).toEqual([]);
  });
});

describe('matchesPushupHub', () => {
  it('should match the hub text in any case and spelling', () => {
    // given / when / then
    expect(matchesPushupHub('liegestutz', 'Liegestütze pushup')).toBe(true);
    expect(matchesPushupHub('plank', 'Liegestütze pushup')).toBe(false);
  });
});
