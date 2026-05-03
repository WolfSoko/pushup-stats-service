import {
  detectPushupTypes,
  findPushupType,
  findPushupTypeByEntryLabel,
  findPushupTypeBySlug,
  localizePushupType,
  localizePushupTypeSlug,
  PUSHUP_TYPES,
  pushupTypeSlugByLocale,
} from './pushup-type.models';

describe('pushup-type catalog', () => {
  it('exposes every documented type with unique id, slug and entryLabel', () => {
    const ids = PUSHUP_TYPES.map((t) => t.id);
    const slugs = PUSHUP_TYPES.map((t) => t.slug);
    const labels = PUSHUP_TYPES.map((t) => t.entryLabel.toLowerCase());
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('covers every push-up type offered in the entry-creation dialog', () => {
    // Keep this list in lockstep with `typeOptions` in
    // create-entry-dialog.component.ts. If you add an option there,
    // add a wiki entry here too — and vice versa.
    const dialogOptions = [
      'Standard',
      'Knee',
      'Incline',
      'Decline',
      'Wide',
      'Diamond',
      'Pike',
      'Knuckle',
      'Archer',
      'Wall One-Arm',
      'Negative One-Arm',
      'Partial One-Arm',
      'One-Arm',
    ];
    const labels = PUSHUP_TYPES.map((t) => t.entryLabel);
    for (const option of dialogOptions) {
      expect(labels).toContain(option);
    }
  });

  it('provides bilingual name, summary and instructions for every type', () => {
    for (const type of PUSHUP_TYPES) {
      expect(type.name.length).toBeGreaterThan(0);
      expect(type.nameEn.length).toBeGreaterThan(0);
      expect(type.summary.length).toBeGreaterThan(0);
      expect(type.summaryEn.length).toBeGreaterThan(0);
      expect(type.instructions.length).toBeGreaterThan(0);
      expect(type.instructionsEn.length).toBeGreaterThan(0);
      expect(type.instructions.length).toBe(type.instructionsEn.length);
    }
  });

  describe('findPushupType / findPushupTypeBySlug / findPushupTypeByEntryLabel', () => {
    it('looks up by id', () => {
      expect(findPushupType('diamond')?.slug).toBe('diamant');
    });

    it('looks up by slug', () => {
      expect(findPushupTypeBySlug('archer')?.id).toBe('archer');
    });

    it('looks up by entry-dialog label, case-insensitively', () => {
      expect(findPushupTypeByEntryLabel('Diamond')?.id).toBe('diamond');
      expect(findPushupTypeByEntryLabel('diamond')?.id).toBe('diamond');
      expect(findPushupTypeByEntryLabel('  Wide  ')?.id).toBe('wide');
    });

    it('returns null when the id or slug is unknown', () => {
      // @ts-expect-error — intentionally invalid id for the runtime check.
      expect(findPushupType('does-not-exist')).toBeNull();
      expect(findPushupTypeBySlug('does-not-exist')).toBeNull();
    });

    it('finds a type by any of its per-locale slug overrides', () => {
      // German default slug still resolves (backwards compat).
      expect(findPushupTypeBySlug('diamant')?.id).toBe('diamond');
      // English-specific override resolves to the same type.
      expect(findPushupTypeBySlug('diamond-pushup')?.id).toBe('diamond');
      // Non-canonical locale slug also resolves so old crawler-found
      // URLs from before per-locale slugs existed still render.
      expect(findPushupTypeBySlug('pompe-diamant')?.id).toBe('diamond');
    });

    it('returns null for unknown / empty entry labels', () => {
      expect(findPushupTypeByEntryLabel('')).toBeNull();
      expect(findPushupTypeByEntryLabel(null)).toBeNull();
      expect(findPushupTypeByEntryLabel(undefined)).toBeNull();
      expect(findPushupTypeByEntryLabel('Custom-Move')).toBeNull();
    });
  });

  describe('localizePushupTypeSlug + pushupTypeSlugByLocale', () => {
    const diamond = findPushupType('diamond');
    if (!diamond) throw new Error('diamond entry must exist');

    it('returns the German default slug for the source locale', () => {
      expect(localizePushupTypeSlug(diamond, 'de')).toBe('diamant');
    });

    it('returns the English override for an "en" locale', () => {
      expect(localizePushupTypeSlug(diamond, 'en')).toBe('diamond-pushup');
    });

    it('falls back to the German default slug for a locale without an override', () => {
      // `ja` (Japanese) has no override in PUSHUP_TYPES so the default
      // German slug is what we serve. Documenting this behaviour
      // explicitly so future locale additions don't regress it.
      expect(localizePushupTypeSlug(diamond, 'ja')).toBe('diamant');
    });

    it('honours the primary subtag for compound locales like "en-US"', () => {
      expect(localizePushupTypeSlug(diamond, 'en-US')).toBe('diamond-pushup');
    });

    it('builds a slug-by-locale map for emitting hreflang alternates', () => {
      const map = pushupTypeSlugByLocale(diamond, ['de', 'en', 'fr']);
      expect(map).toEqual({
        de: 'diamant',
        en: 'diamond-pushup',
        fr: 'pompe-diamant',
      });
    });

    it('every catalog type defines a slug for every supported locale (or falls back cleanly)', () => {
      // Defensive: nothing crashes even when `slugs` is undefined.
      for (const type of PUSHUP_TYPES) {
        for (const lang of [
          'de',
          'en',
          'fr',
          'es',
          'it',
          'nl',
          'el',
          'la',
          'no',
          'zh',
        ]) {
          const slug = localizePushupTypeSlug(type, lang);
          expect(slug.length).toBeGreaterThan(0);
          // ASCII-only — non-ASCII slugs break SEO crawlers.
          expect(/^[a-z0-9-]+$/i.test(slug)).toBe(true);
        }
      }
    });
  });

  describe('localizePushupType', () => {
    const archer = findPushupType('archer');
    if (!archer) throw new Error('archer entry must exist in the catalog');

    it('returns English fields when locale starts with "en"', () => {
      const out = localizePushupType(archer, 'en');
      expect(out.name).toBe('Archer push-up');
      expect(out.instructions[0]).toContain('shoulder');
    });

    it('returns German fields for the source locale "de"', () => {
      const out = localizePushupType(archer, 'de');
      expect(out.name).toBe('Archer-Liegestütze');
      expect(out.instructions[0]).toContain('schulterbreit');
    });

    it('handles "en-US" the same as "en"', () => {
      expect(localizePushupType(archer, 'en-US').name).toBe('Archer push-up');
    });

    it('returns an empty array for tips when none are defined', () => {
      const wallOneArm = findPushupType('wall-one-arm');
      if (!wallOneArm) throw new Error('wall-one-arm entry must exist');
      expect(localizePushupType(wallOneArm, 'de').tips).toEqual([]);
    });

    it('uses markdown-sourced override when one exists for the type', () => {
      // The `standard` push-up has been migrated to
      // content/wiki/pushup-types/standard.{de,en}.md. The override
      // path should win — proven here by verifying we still get the
      // expected localized fields without depending on the legacy
      // `*En` fields (which can be removed once every type is ported).
      const standard = findPushupType('standard');
      if (!standard) throw new Error('standard entry must exist');
      const en = localizePushupType(standard, 'en');
      expect(en.name).toBe('Standard push-up');
      expect(en.instructions.length).toBeGreaterThan(0);
      const de = localizePushupType(standard, 'de');
      expect(de.name).toBe('Standard-Liegestütze');
      expect(de.tips.length).toBeGreaterThan(0);
    });
  });

  describe('detectPushupTypes', () => {
    it('detects standard from a German description', () => {
      const types = detectPushupTypes('Standard 3×25');
      expect(types.map((t) => t.id)).toContain('standard');
    });

    it('detects archer from a German description', () => {
      const types = detectPushupTypes('Archer-Liegestütze 3×6');
      expect(types.map((t) => t.id)).toEqual(['archer']);
    });

    it('detects archer from an English description', () => {
      const types = detectPushupTypes('Archer push-ups 3×6');
      expect(types.map((t) => t.id)).toEqual(['archer']);
    });

    it('detects diamond push-ups', () => {
      const types = detectPushupTypes(
        'Diamant-Liegestütze 3×12 (Trizeps-Volumen)'
      );
      expect(types.map((t) => t.id)).toEqual(['diamond']);
    });

    it('detects wide push-ups', () => {
      const types = detectPushupTypes('Weite Liegestütze 3×20 (Brust-Volumen)');
      expect(types.map((t) => t.id)).toEqual(['wide']);
    });

    it('detects wall-one-arm without bleeding into the generic one-arm entry', () => {
      const types = detectPushupTypes(
        'Wand-Einarmige 3×10 (langsame Exzentrik)'
      );
      expect(types.map((t) => t.id)).toEqual(['wall-one-arm']);
    });

    it('detects negative-one-arm without bleeding into the generic one-arm entry', () => {
      const types = detectPushupTypes(
        'Negative Einarmige von Bank 3×5 (3 s runter)'
      );
      expect(types.map((t) => t.id)).toEqual(['negative-one-arm']);
    });

    it('detects partial-one-arm without bleeding into the generic one-arm entry', () => {
      const types = detectPushupTypes(
        'Partielle Einarmige (niedrige Bank) 3×4'
      );
      expect(types.map((t) => t.id)).toEqual(['partial-one-arm']);
    });

    it('detects the generic full one-arm push-up only when no more specific variant matches', () => {
      const types = detectPushupTypes('Volle Einarmige (weiter Stand) 3×3');
      expect(types.map((t) => t.id)).toEqual(['one-arm']);
    });

    it('detects knee or incline push-ups in German', () => {
      const types = detectPushupTypes('3×8 Knie- oder erhöhte Liegestütze');
      const ids = types.map((t) => t.id);
      expect(ids).toContain('knee');
      expect(ids).toContain('incline');
    });

    it('detects knee or incline push-ups in English', () => {
      const types = detectPushupTypes('3×8 knee or incline push-ups');
      const ids = types.map((t) => t.id);
      expect(ids).toContain('knee');
      expect(ids).toContain('incline');
    });

    it('returns an empty list for rest days', () => {
      expect(detectPushupTypes('Ruhetag')).toEqual([]);
      expect(detectPushupTypes('Rest day')).toEqual([]);
    });
  });
});
