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
    // We parse `;q=` weights per RFC 7231 §5.3.5 and stable-sort
    // entries by descending q (header order tie-breaks at equal q).
    // `de;q=0.5,en;q=0.3` → `de` (higher q), and the canonical
    // `en;q=0.1,fr;q=1.0` → `fr` even though `en` appears first.
    ['de;q=0.5,en;q=0.3', 'de'],
    ['en-GB,de;q=0.5', 'en'],
    ['en;q=0.1,fr;q=1.0', 'fr'], // explicit q overrides header order
    ['fr-FR', 'fr'],
    ['es', 'es'],
    ['it-IT,en;q=0.5', 'it'], // header order at q=1.0 (default) tie-breaks
    ['fr;q=0.8,en;q=0.8', 'fr'], // equal q → first listed wins (stable sort)
    ['en;q=0.8,fr;q=0.8', 'en'], // ditto, with reversed order
    ['de,de-DE;q=0.9,fr;q=0.8', 'de'],
    ['nl-BE', 'nl'],
    ['el', 'el'],
    ['la', 'la'],
    ['no', 'no'],
    ['no-NO', 'no'],
    // Norwegian browsers advertise `nb` (Bokmål) or `nn` (Nynorsk),
    // not `no`. Both must alias to the `no` bundle so unprefixed
    // routes don't fall back to German for Norwegian users.
    ['nb', 'no'],
    ['nb-NO', 'no'],
    ['nn', 'no'],
    ['nn-NO', 'no'],
    ['zh', 'zh'],
    ['zh-CN', 'zh'], // primary subtag matches `zh` (Mainland Simplified)
    ['zh-TW,en;q=0.5', 'zh'], // any zh-* still maps to zh (we only ship Simplified)
    ['en;q=not-a-number,de', 'de'], // malformed q drops the entry
    ['en;q=0,fr;q=0', 'de'], // explicit q=0 rejects → source locale fallback
    ['en;q=0,de', 'de'], // q=0 only excludes that entry; remaining ranked entries still apply
    ['ja-JP,ko;q=0.8', 'de'], // no supported tag → source locale fallback
    ['xen-fake', 'de'], // unrecognised primary subtag → source locale fallback
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
        '/el',
        '/la/blog',
        '/no',
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
