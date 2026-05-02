import { buildProfileShareUrl } from './profile-share-url';

describe('buildProfileShareUrl', () => {
  it.each([
    ['de-DE', 'de'],
    ['de', 'de'],
    ['en-US', 'en'],
    ['en', 'en'],
    ['EN', 'en'],
    // Unknown / unsupported locales fall back to the source locale.
    ['fr-FR', 'de'],
    ['', 'de'],
  ])(
    'Given LOCALE_ID=%j, Then it builds /%s/u/<uid>',
    (localeId, expectedLang) => {
      expect(buildProfileShareUrl('abcdef1234567890', localeId)).toBe(
        `https://pushup-stats.com/${expectedLang}/u/abcdef1234567890`
      );
    }
  );

  it('Returns an empty string when uid is missing', () => {
    expect(buildProfileShareUrl(undefined, 'de')).toBe('');
    expect(buildProfileShareUrl(null, 'de')).toBe('');
    expect(buildProfileShareUrl('', 'de')).toBe('');
  });

  it('Treats a missing localeId as the source locale (de)', () => {
    expect(buildProfileShareUrl('abc12345', undefined)).toBe(
      'https://pushup-stats.com/de/u/abc12345'
    );
    expect(buildProfileShareUrl('abc12345', null)).toBe(
      'https://pushup-stats.com/de/u/abc12345'
    );
  });

  it('URL-encodes the uid so reserved characters cannot break the path', () => {
    // Real Firebase UIDs are URL-safe, but custom UIDs may contain
    // characters that need encoding — keep the contract explicit.
    expect(buildProfileShareUrl('a/b c?d', 'de')).toBe(
      'https://pushup-stats.com/de/u/a%2Fb%20c%3Fd'
    );
  });
});
