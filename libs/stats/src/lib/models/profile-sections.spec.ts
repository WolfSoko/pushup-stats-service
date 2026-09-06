import {
  isProfileSection,
  isSectionVisible,
  normalizeHiddenSections,
  PROFILE_SECTIONS,
} from './profile-sections';

describe('PROFILE_SECTIONS', () => {
  it('should have no duplicate ids', () => {
    // then — a duplicate would make one switch silently govern two
    // elements, or none
    expect(new Set(PROFILE_SECTIONS).size).toBe(PROFILE_SECTIONS.length);
  });
});

describe('normalizeHiddenSections', () => {
  it('should keep known ids', () => {
    expect(normalizeHiddenSections(['streak', 'heatmap'])).toEqual([
      'streak',
      'heatmap',
    ]);
  });

  it('should drop ids that are no longer elements', () => {
    // then — a removed element must not linger in the config as a
    // section name that nothing renders
    expect(normalizeHiddenSections(['streak', 'gone'])).toEqual(['streak']);
  });

  it.each([[null], [undefined], ['streak'], [42], [{}]])(
    'should treat %j as nothing hidden',
    (value) => {
      // then — a malformed value must fail open to "visible", never
      // silently blank a profile
      expect(normalizeHiddenSections(value)).toEqual([]);
    }
  );

  it('should collapse duplicates', () => {
    expect(normalizeHiddenSections(['streak', 'streak'])).toEqual(['streak']);
  });

  it('should return a stable order regardless of input order', () => {
    // then — the config is compared for equality on save; a reordered
    // array would look like a change and trigger a pointless write
    expect(normalizeHiddenSections(['heatmap', 'streak'])).toEqual(
      normalizeHiddenSections(['streak', 'heatmap'])
    );
  });
});

describe('isProfileSection', () => {
  it.each([
    ['total', true],
    ['nope', false],
    ['', false],
  ])('should classify %j as %s', (value, expected) => {
    expect(isProfileSection(value)).toBe(expected);
  });
});

describe('isSectionVisible', () => {
  it('should default to visible', () => {
    // then — a newly added element shows up without a migration
    expect(isSectionVisible([], 'heatmap')).toBe(true);
  });

  it('should hide what is listed', () => {
    expect(isSectionVisible(['heatmap'], 'heatmap')).toBe(false);
  });
});
