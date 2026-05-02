import {
  detectPushupTypes,
  findPushupType,
  findPushupTypeBySlug,
  localizePushupType,
  PUSHUP_TYPES,
} from './pushup-type.models';

describe('pushup-type catalog', () => {
  it('exposes every documented type with unique id and slug', () => {
    const ids = PUSHUP_TYPES.map((t) => t.id);
    const slugs = PUSHUP_TYPES.map((t) => t.slug);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
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

  describe('findPushupType / findPushupTypeBySlug', () => {
    it('looks up by id', () => {
      expect(findPushupType('diamond')?.slug).toBe('diamant');
    });

    it('looks up by slug', () => {
      expect(findPushupTypeBySlug('archer')?.id).toBe('archer');
    });

    it('returns null when the id or slug is unknown', () => {
      // @ts-expect-error — intentionally invalid id for the runtime check.
      expect(findPushupType('does-not-exist')).toBeNull();
      expect(findPushupTypeBySlug('does-not-exist')).toBeNull();
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
  });

  describe('detectPushupTypes', () => {
    it('detects standard from a German description', () => {
      const types = detectPushupTypes('Standard 3×25', 'Standard 3×25');
      expect(types.map((t) => t.id)).toContain('standard');
    });

    it('detects archer in both languages', () => {
      const types = detectPushupTypes(
        'Archer-Liegestütze 3×6',
        'Archer push-ups 3×6'
      );
      expect(types.map((t) => t.id)).toEqual(['archer']);
    });

    it('detects diamond push-ups', () => {
      const types = detectPushupTypes(
        'Diamant-Liegestütze 3×12 (Trizeps-Volumen)',
        'Diamond push-ups 3×12 (triceps volume)'
      );
      expect(types.map((t) => t.id)).toEqual(['diamond']);
    });

    it('detects wide push-ups', () => {
      const types = detectPushupTypes(
        'Weite Liegestütze 3×20 (Brust-Volumen)',
        'Wide push-ups 3×20 (chest volume)'
      );
      expect(types.map((t) => t.id)).toEqual(['wide']);
    });

    it('detects wall-one-arm without bleeding into the generic one-arm entry', () => {
      const types = detectPushupTypes(
        'Wand-Einarmige 3×10 (langsame Exzentrik)',
        'Wall one-arm 3×10 (slow eccentric)'
      );
      expect(types.map((t) => t.id)).toEqual(['wall-one-arm']);
    });

    it('detects negative-one-arm without bleeding into the generic one-arm entry', () => {
      const types = detectPushupTypes(
        'Negative Einarmige von Bank 3×5 (3 s runter)',
        'Negative one-arm from bench 3×5 (3 s down)'
      );
      expect(types.map((t) => t.id)).toEqual(['negative-one-arm']);
    });

    it('detects partial-one-arm without bleeding into the generic one-arm entry', () => {
      const types = detectPushupTypes(
        'Partielle Einarmige (niedrige Bank) 3×4',
        'Partial one-arm (low bench) 3×4'
      );
      expect(types.map((t) => t.id)).toEqual(['partial-one-arm']);
    });

    it('detects the generic full one-arm push-up only when no more specific variant matches', () => {
      const types = detectPushupTypes(
        'Volle Einarmige (weiter Stand) 3×3',
        'Full one-arm (wide stance) 3×3'
      );
      expect(types.map((t) => t.id)).toEqual(['one-arm']);
    });

    it('detects knee or elevated push-ups', () => {
      const types = detectPushupTypes(
        '3×8 Knie- oder erhöhte Liegestütze',
        '3×8 knee or elevated push-ups'
      );
      const ids = types.map((t) => t.id);
      expect(ids).toContain('knee');
      expect(ids).toContain('elevated');
    });

    it('returns an empty list for rest days', () => {
      expect(detectPushupTypes('Ruhetag', 'Rest day')).toEqual([]);
    });

    it('falls back to the German keywords when descriptionEn is omitted', () => {
      const types = detectPushupTypes('Diamant-Liegestütze 3×12');
      expect(types.map((t) => t.id)).toEqual(['diamond']);
    });
  });
});
