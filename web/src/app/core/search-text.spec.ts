import { matchesTokens, normalizeSearch, searchTokens } from './search-text';

describe('normalizeSearch', () => {
  it('should fold umlauts, sharp s and whitespace', () => {
    // given / when / then
    expect(normalizeSearch('  Füße  Straße ')).toBe('fusse strasse');
  });
});

describe('searchTokens', () => {
  it('should split a query into normalized tokens', () => {
    // given / when / then
    expect(searchTokens('  Knie   BEUGE ')).toEqual(['knie', 'beuge']);
  });

  it('should return no tokens for a blank query', () => {
    // given / when / then
    expect(searchTokens('   ')).toEqual([]);
  });
});

describe('matchesTokens', () => {
  it('should match when every token occurs in the text', () => {
    // given
    const text = normalizeSearch('Kniebeugen Kniebeuge');

    // when / then
    expect(matchesTokens(['kn', 'beu'], text)).toBe(true);
  });

  it('should not match when one token is missing', () => {
    // given
    const text = normalizeSearch('Kniebeugen');

    // when / then
    expect(matchesTokens(['knie', 'zug'], text)).toBe(false);
  });

  it('should match everything without tokens', () => {
    // given / when / then
    expect(matchesTokens([], 'plank')).toBe(true);
  });
});
