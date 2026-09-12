import { buildSharePlanPayload } from './plan-share';

describe('buildSharePlanPayload', () => {
  const base = {
    title: '30 Tage Liegestütze',
    dayIndex: 12,
    totalDays: 30,
    percent: 40,
    slug: '30-tage-liegestuetze',
    localeId: 'de',
    paused: false,
  };

  it('should say where in the plan the user stands', async () => {
    // given
    const payload = buildSharePlanPayload(base);

    // then
    expect(payload.text).toContain('12');
    expect(payload.text).toContain('30');
    expect(payload.text).toContain('30 Tage Liegestütze');
  });

  it('should round the progress to a whole percent', async () => {
    // given — `completionPercent` is a fraction of a day; "40.666 %" in a
    // shared message reads like a bug
    const payload = buildSharePlanPayload({ ...base, percent: 40.666 });

    // then
    expect(payload.text).toContain('41 %');
    expect(payload.text).not.toContain('40.6');
  });

  it('should link to the plan, not the profile', async () => {
    // given — the reader's next step is starting the same plan
    const payload = buildSharePlanPayload(base);

    // then
    expect(payload.url).toBe(
      'https://pushup-stats.com/de/training-plans/30-tage-liegestuetze'
    );
  });

  it('should keep the locale prefix of the sharer', async () => {
    // given
    const payload = buildSharePlanPayload({ ...base, localeId: 'en-US' });

    // then
    expect(payload.url).toContain('/en/training-plans/');
  });

  it('should say a paused plan is waiting', async () => {
    // given — "Tag 12 von 30" alone would claim progress that is on hold
    const payload = buildSharePlanPayload({ ...base, paused: true });

    // then
    expect(payload.text).toContain('wartet');
    expect(payload.text).toContain('12');
  });

  it('should skip the day count before the plan has one', async () => {
    // given
    const payload = buildSharePlanPayload({ ...base, dayIndex: null });

    // then
    expect(payload.text).toContain('30 Tage Liegestütze');
    expect(payload.text).not.toContain('Tag 0');
  });
});
