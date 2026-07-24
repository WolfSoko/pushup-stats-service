import { isCacheableStaticSsrPath } from './server-ssr-cache';

describe('isCacheableStaticSsrPath', () => {
  describe('Given a locale-prefixed wiki detail path, Then returns true', () => {
    it.each([
      '/de/wiki/liegestuetz-typen/standard',
      '/en/wiki/liegestuetz-typen/standard-pushup',
      '/zh/wiki/liegestuetz-typen/biaozhun-fuwocheng',
      '/de/wiki/uebungen/plank',
      '/en/wiki/uebungen/sit-ups',
      // trailing slash
      '/de/wiki/uebungen/plank/',
    ])('%s', (path) => {
      expect(isCacheableStaticSsrPath(path)).toBe(true);
    });
  });

  describe('Given a path that is not a cacheable wiki detail page, Then returns false', () => {
    it.each([
      // list pages (prerendered, never hit the SSR handler for this)
      '/de/wiki/liegestuetz-typen',
      '/de/wiki/uebungen',
      // unprefixed / unsupported locale
      '/wiki/uebungen/plank',
      '/xx/wiki/uebungen/plank',
      // genuinely dynamic routes must never get this treatment
      '/de/leaderboard',
      '/de/u/abc123',
      '/de/app',
      // nested/extra segments
      '/de/wiki/uebungen/plank/extra',
    ])('%s', (path) => {
      expect(isCacheableStaticSsrPath(path)).toBe(false);
    });
  });
});
