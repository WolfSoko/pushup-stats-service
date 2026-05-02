import {
  computeLocaleRedirect,
  pickLocale,
  type LocaleRedirectInput,
} from './server-locale-redirect';

function input(
  overrides: Partial<LocaleRedirectInput> = {}
): LocaleRedirectInput {
  return {
    method: 'GET',
    path: '/u/abc123',
    url: '/u/abc123',
    acceptLanguage: undefined,
    ...overrides,
  };
}

describe('pickLocale', () => {
  it.each([
    [undefined, 'de'],
    ['', 'de'],
    ['de', 'de'],
    ['de-DE', 'de'],
    ['en', 'en'],
    ['en-US', 'en'],
    ['EN', 'en'],
    // ANY presence of English in the header switches us to the en bundle.
    // We deliberately don't parse q-values: so `de;q=0.9,en;q=0.1` still
    // picks `en`. That's fine for our use case (most tools send a single
    // primary language), and parsing q-values would be a maintenance trap
    // for what's essentially a marketing-redirect heuristic.
    ['de;q=0.5,en;q=0.3', 'en'],
    ['en-GB,de;q=0.5', 'en'],
    ['fr-FR', 'fr'],
    ['es', 'es'],
    ['it-IT,en;q=0.5', 'en'], // priority: en wins over later codes
    ['nl-BE', 'nl'],
    ['grc', 'grc'],
    ['la', 'la'],
    ['zh-CN,ja;q=0.8', 'de'], // unsupported → source locale fallback
    ['xen-fake', 'de'], // word boundary prevents matching `en` inside `xen`
  ])('Given Accept-Language=%j, Then picks %s', (header, expected) => {
    expect(pickLocale(header)).toBe(expected);
  });
});

describe('computeLocaleRedirect', () => {
  describe('Pass-through cases (no redirect)', () => {
    it('Skips non-GET/HEAD methods', () => {
      expect(computeLocaleRedirect(input({ method: 'POST' }))).toEqual({
        kind: 'pass',
      });
      expect(computeLocaleRedirect(input({ method: 'PUT' }))).toEqual({
        kind: 'pass',
      });
    });

    it('Skips the root path (Angular SSR handles its own locale redirect)', () => {
      expect(computeLocaleRedirect(input({ path: '/', url: '/' }))).toEqual({
        kind: 'pass',
      });
    });

    it('Skips already-prefixed paths', () => {
      for (const path of [
        '/de',
        '/de/u/abc',
        '/en',
        '/en/login',
        '/fr',
        '/es/u/abc',
        '/it/login',
        '/nl',
        '/grc',
        '/la/blog',
      ]) {
        expect(computeLocaleRedirect(input({ path, url: path }))).toEqual({
          kind: 'pass',
        });
      }
    });

    it('Skips well-known root files', () => {
      for (const path of ['/robots.txt', '/sitemap.xml', '/ads.txt']) {
        expect(computeLocaleRedirect(input({ path, url: path }))).toEqual({
          kind: 'pass',
        });
      }
    });

    it('Skips paths whose last segment carries a file extension', () => {
      expect(
        computeLocaleRedirect(
          input({ path: '/favicon.ico', url: '/favicon.ico' })
        )
      ).toEqual({ kind: 'pass' });
      expect(
        computeLocaleRedirect(
          input({ path: '/assets/logo.png', url: '/assets/logo.png' })
        )
      ).toEqual({ kind: 'pass' });
    });

    it('Skips paths with characters outside the URL-safe app-route set', () => {
      // Backslash, CR/LF, control characters, exotic Unicode — anything
      // that could trick downstream Location parsing falls through.
      for (const path of ['/\\evil', '/foo\r\nbar', '/<script>', '/u/ä']) {
        expect(computeLocaleRedirect(input({ path, url: path }))).toEqual({
          kind: 'pass',
        });
      }
    });
  });

  describe('Redirect cases', () => {
    it('Defaults to /de/<path> when Accept-Language is missing', () => {
      expect(
        computeLocaleRedirect(input({ path: '/u/abc', url: '/u/abc' }))
      ).toEqual({ kind: 'redirect', location: '/de/u/abc' });
    });

    it('Picks /en when Accept-Language indicates English', () => {
      expect(
        computeLocaleRedirect(
          input({
            path: '/u/abc',
            url: '/u/abc',
            acceptLanguage: 'en-US,en;q=0.9',
          })
        )
      ).toEqual({ kind: 'redirect', location: '/en/u/abc' });
    });

    it('Preserves the query string for routes like /login?returnUrl=…', () => {
      // Regression: dropping the suffix used to break post-login navigation
      // because `/login` reads `returnUrl`. Search is preserved verbatim
      // (already URL-safe by construction in the app) but normalised
      // through the URL parser to neutralise header-injection attempts.
      expect(
        computeLocaleRedirect(
          input({
            path: '/login',
            url: '/login?returnUrl=/training-plans',
          })
        )
      ).toEqual({
        kind: 'redirect',
        location: '/de/login?returnUrl=/training-plans',
      });
    });

    it('URL-parses the search component so a fragment cannot leak into Location', () => {
      const result = computeLocaleRedirect(
        input({ path: '/u/abc', url: '/u/abc?x=1#frag' })
      );
      expect(result).toEqual({
        kind: 'redirect',
        location: '/de/u/abc?x=1',
      });
    });

    it('Drops the suffix when URL parsing fails', () => {
      // Defensive: an unparseable url string should still redirect, just
      // without echoing the bogus suffix into the Location header.
      const result = computeLocaleRedirect(
        input({ path: '/u/abc', url: '\x00not-a-url' })
      );
      expect(result.kind).toBe('redirect');
      expect((result as { location: string }).location).toMatch(
        /^\/de\/u\/abc$/
      );
    });
  });
});
