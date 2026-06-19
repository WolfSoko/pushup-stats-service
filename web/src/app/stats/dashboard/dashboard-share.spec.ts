import { buildShareDayPayload } from './dashboard-share';

describe('buildShareDayPayload', () => {
  it('should share the generic homepage when the user has no public profile', () => {
    // given a signed-in user who did not opt into a public profile
    const payload = buildShareDayPayload({
      total: 42,
      streak: 1,
      uid: 'user-1',
      publicProfile: false,
      localeId: 'de',
    });
    // then
    expect(payload.url).toBe('https://pushup-stats.com');
    expect(payload.title.length).toBeGreaterThan(0);
    expect(payload.text).toContain('42');
  });

  it('should share the profile URL when the user opted into a public profile', () => {
    // given a public-profile user
    const payload = buildShareDayPayload({
      total: 42,
      streak: 5,
      uid: 'user-1',
      publicProfile: true,
      localeId: 'de',
    });
    // then — a non-homepage profile URL referencing the user
    expect(payload.url).not.toBe('https://pushup-stats.com');
    expect(payload.url).toContain('user-1');
    expect(payload.text).toContain('5');
  });

  it('should fall back to the homepage when public profile is on but uid is missing', () => {
    // given opted-in but signed out (no uid)
    const payload = buildShareDayPayload({
      total: 10,
      streak: 1,
      uid: '',
      publicProfile: true,
      localeId: 'de',
    });
    // then
    expect(payload.url).toBe('https://pushup-stats.com');
  });
});
