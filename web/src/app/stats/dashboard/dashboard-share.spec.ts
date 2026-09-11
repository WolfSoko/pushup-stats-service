import { buildShareDayPayload } from './dashboard-share';

describe('buildShareDayPayload', () => {
  it('should share the generic homepage when the user has no public profile', () => {
    // given a signed-in user who did not opt into a public profile
    const payload = buildShareDayPayload({
      summary: '42 Liegestütze',
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
      summary: '42 Liegestütze',
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
      summary: '10 Liegestütze',
      streak: 1,
      uid: '',
      publicProfile: true,
      localeId: 'de',
    });
    // then
    expect(payload.url).toBe('https://pushup-stats.com');
  });

  it('should lead with the day exercises, not a push-up count', () => {
    // given a day of squats and a plank — no push-ups at all
    const payload = buildShareDayPayload({
      summary: '60 Kniebeugen, 2:00 Plank',
      streak: 1,
      uid: 'user-1',
      publicProfile: false,
      localeId: 'de',
    });

    // then the text reports what was trained, and never claims push-ups
    expect(payload.text).toContain('60 Kniebeugen, 2:00 Plank');
    expect(payload.text).not.toContain('Liegestütze');
  });
});
