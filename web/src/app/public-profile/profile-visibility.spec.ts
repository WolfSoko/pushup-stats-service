import { PROFILE_SECTIONS } from '@pu-stats/models';

import { visibleSections, withSectionVisible } from './profile-visibility';

describe('withSectionVisible', () => {
  it('should hide an element that was visible', () => {
    expect(withSectionVisible([], 'streak', false)).toEqual(['streak']);
  });

  it('should show an element that was hidden', () => {
    expect(withSectionVisible(['streak'], 'streak', true)).toEqual([]);
  });

  it('should leave the other elements alone', () => {
    expect(withSectionVisible(['streak'], 'heatmap', false)).toEqual([
      'streak',
      'heatmap',
    ]);
  });

  it('should not add a duplicate when hiding twice', () => {
    // then — a duplicate would survive into the config and make the
    // saved value differ from the one read back
    expect(withSectionVisible(['streak'], 'streak', false)).toEqual(['streak']);
  });

  it('should return a stable order regardless of click order', () => {
    // given — the draft is compared against the stored value to decide
    // whether to save; ordering noise would cause pointless writes
    const a = withSectionVisible(
      withSectionVisible([], 'heatmap', false),
      'streak',
      false
    );
    const b = withSectionVisible(
      withSectionVisible([], 'streak', false),
      'heatmap',
      false
    );

    // then
    expect(a).toEqual(b);
  });
});

describe('visibleSections', () => {
  it('should show everything by default', () => {
    expect(visibleSections([])).toEqual([...PROFILE_SECTIONS]);
  });

  it('should drop what is hidden', () => {
    expect(visibleSections(['streak'])).not.toContain('streak');
  });

  it('should be able to hide everything', () => {
    // then — it is the user's profile; leaving one element on by force
    // would be us overruling them
    expect(visibleSections([...PROFILE_SECTIONS])).toEqual([]);
  });
});
