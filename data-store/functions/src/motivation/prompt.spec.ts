import { buildTieredPrompt, extractTieredQuotes } from './prompt';

describe('buildTieredPrompt', () => {
  it('should embed the display name, totals and a known language name', () => {
    // given / when
    const prompt = buildTieredPrompt('de', 30, 100, 'Alex');
    // then
    expect(prompt).toContain('German');
    expect(prompt).toContain('Alex');
    expect(prompt).toContain('30 of 100');
  });

  it('should fall back to the locale code for unknown languages', () => {
    // given / when
    const prompt = buildTieredPrompt('xx', 0, 50, 'Champ');
    // then
    expect(prompt).toContain('in xx ');
  });

  it('should list one line per tier', () => {
    // given / when
    const prompt = buildTieredPrompt('en', 10, 20, 'Sam');
    // then
    for (const tier of ['general', 'belowGoal', 'nearGoal', 'goalReached']) {
      expect(prompt).toContain(`"${tier}"`);
    }
  });
});

describe('extractTieredQuotes', () => {
  it('should parse a clean JSON object into tiers', () => {
    // given
    const text =
      '{"general":["a","b"],"belowGoal":["c"],"nearGoal":[],"goalReached":["d"]}';
    // when
    const result = extractTieredQuotes(text);
    // then
    expect(result).toEqual({
      general: ['a', 'b'],
      belowGoal: ['c'],
      nearGoal: [],
      goalReached: ['d'],
    });
  });

  it('should extract JSON embedded in surrounding prose / markdown', () => {
    // given
    const text = 'Here you go:\n```json\n{"general":["x"]}\n```\nDone.';
    // when
    const result = extractTieredQuotes(text);
    // then
    expect(result?.general).toEqual(['x']);
  });

  it('should trim whitespace and drop empty strings', () => {
    // given
    const text = '{"general":["  hi  ", "", "  "]}';
    // when
    const result = extractTieredQuotes(text);
    // then
    expect(result?.general).toEqual(['hi']);
  });

  it('should coerce non-string entries to strings', () => {
    // given
    const text = '{"general":[1, true]}';
    // when
    const result = extractTieredQuotes(text);
    // then
    expect(result?.general).toEqual(['1', 'true']);
  });

  it('should return null when no JSON object is present', () => {
    // given / when / then
    expect(extractTieredQuotes('no json here')).toBeNull();
  });

  it('should return null for invalid JSON', () => {
    // given / when / then
    expect(extractTieredQuotes('{ not valid json ]')).toBeNull();
  });

  it('should return null when every tier is empty or absent', () => {
    // given / when / then
    expect(extractTieredQuotes('{"general":[], "other": 1}')).toBeNull();
  });
});
