import { EXERCISE_CATALOG } from './exercise.catalog';
import {
  EXERCISE_WIKI_CATALOG,
  findExerciseWikiEntry,
  findExerciseWikiEntryBySlug,
  localizeExerciseWiki,
  type ExerciseWikiEntry,
} from './exercise-wiki.models';
import { EXERCISE_WIKI_CONTENT } from './exercise-wiki-content.generated';

describe('exercise wiki catalog', () => {
  it('exposes unique ids and slugs', () => {
    const ids = EXERCISE_WIKI_CATALOG.map((e) => e.id);
    const slugs = EXERCISE_WIKI_CATALOG.map((e) => e.slug);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('only references ids present in EXERCISE_CATALOG', () => {
    const catalogIds = new Set(EXERCISE_CATALOG.map((d) => d.id));
    for (const entry of EXERCISE_WIKI_CATALOG) {
      expect(catalogIds.has(entry.id)).toBe(true);
    }
  });

  it('uses URL-safe lowercase kebab-case slugs', () => {
    const safe = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
    for (const entry of EXERCISE_WIKI_CATALOG) {
      expect(entry.slug).toMatch(safe);
    }
  });

  it('has German and English markdown content for every entry', () => {
    for (const entry of EXERCISE_WIKI_CATALOG) {
      const content = EXERCISE_WIKI_CONTENT[entry.id];
      expect(content).toBeDefined();
      expect(content?.de).toBeDefined();
      expect(content?.en).toBeDefined();
      expect(content?.de?.instructions.length).toBeGreaterThan(0);
      expect(content?.en?.instructions.length).toBeGreaterThan(0);
    }
  });

  it('findExerciseWikiEntry resolves by id', () => {
    expect(findExerciseWikiEntry('legs.squats')?.slug).toBe('squats');
    expect(findExerciseWikiEntry('does.not.exist')).toBeNull();
    expect(findExerciseWikiEntry(null)).toBeNull();
  });

  it('findExerciseWikiEntryBySlug resolves by slug', () => {
    expect(findExerciseWikiEntryBySlug('squats')?.id).toBe('legs.squats');
    expect(findExerciseWikiEntryBySlug('plank')?.id).toBe('plank.standard');
    expect(findExerciseWikiEntryBySlug('does-not-exist')).toBeNull();
    expect(findExerciseWikiEntryBySlug(null)).toBeNull();
  });

  describe('localizeExerciseWiki', () => {
    it('returns German copy for de locale', () => {
      const entry = findExerciseWikiEntryBySlug('squats');
      expect(entry).not.toBeNull();
      if (!entry) return;
      const localized = localizeExerciseWiki(entry, 'de');
      expect(localized?.name).toBe('Kniebeugen');
    });

    it('returns English copy for en locale', () => {
      const entry = findExerciseWikiEntryBySlug('squats');
      expect(entry).not.toBeNull();
      if (!entry) return;
      const localized = localizeExerciseWiki(entry, 'en');
      expect(localized?.name).toBe('Squats');
    });

    it('falls back to English when locale is not translated', () => {
      const entry = findExerciseWikiEntryBySlug('squats');
      expect(entry).not.toBeNull();
      if (!entry) return;
      const localized = localizeExerciseWiki(entry, 'fr');
      // No French copy yet; fallback chain is en → de.
      expect(localized?.name).toBe('Squats');
    });

    it('should withhold the body from a locale that has none, while still falling back for the name', () => {
      // given — a synthetic entry with de + en copy only, no fr
      const id = '__test.partialLocale';
      const entry: ExerciseWikiEntry = {
        id,
        categoryId: 'cardio',
        slug: id,
        difficulty: 'beginner',
        icon: 'directions_walk',
      };
      (EXERCISE_WIKI_CONTENT as Record<string, unknown>)[id] = {
        de: {
          name: 'Wandern',
          summary: 'x',
          instructions: ['x'],
          tips: ['x'],
          article: '<p>de</p>',
        },
        en: {
          name: 'Hiking',
          summary: 'x',
          instructions: ['x'],
          tips: ['x'],
          article: '<p>en</p>',
        },
      };

      try {
        // when
        const localized = localizeExerciseWiki(entry, 'fr');

        // then — frontmatter falls back, the article does not: inheriting
        // it would make `exercise-detail.component.ts` advertise an
        // English duplicate as indexable French, and the sitemap (which
        // resolves per locale) would not list it.
        expect(localized?.name).toBe('Hiking');
        expect(localized?.article).toBeUndefined();
      } finally {
        delete (EXERCISE_WIKI_CONTENT as Record<string, unknown>)[id];
      }
    });

    it('should keep the body for a locale that has its own copy', () => {
      // given
      const entry = findExerciseWikiEntryBySlug('hiking');
      expect(entry).not.toBeNull();
      if (!entry) return;

      // when
      const localized = localizeExerciseWiki(entry, 'en');

      // then
      expect(localized?.article).toBeTruthy();
    });

    it('strips region subtag (fr-CH → fr) before lookup', () => {
      const entry = findExerciseWikiEntryBySlug('squats');
      expect(entry).not.toBeNull();
      if (!entry) return;
      const localized = localizeExerciseWiki(entry, 'en-US');
      expect(localized?.name).toBe('Squats');
    });
  });
});
