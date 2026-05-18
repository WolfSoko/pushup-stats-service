const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '../..');
const ROBOTS_PATH = resolve(ROOT, 'web/public/robots.txt');
const LOCALE_SOURCE_PATH = resolve(ROOT, 'web/src/server-locale-redirect.ts');

/**
 * Auth-only routes that must never be indexed. Kept in sync with the
 * "Disallow:" rule documented in `docs/consent-ads-seo.md` (SEO &
 * Crawler Discoverability section). Adding a new auth-only route here
 * forces the corresponding robots.txt entries to appear in the same
 * commit — the regression vector this test exists to close.
 */
const AUTH_ROUTES = ['/admin', '/settings', '/reminders'];

function readSupportedLocales() {
  const source = readFileSync(LOCALE_SOURCE_PATH, 'utf-8');
  const match = /export const SUPPORTED_LOCALES\s*=\s*\[([^\]]+)\]/.exec(
    source
  );
  if (!match) {
    throw new Error(
      `SUPPORTED_LOCALES tuple not found in ${LOCALE_SOURCE_PATH}`
    );
  }
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

describe('robots.txt coverage', () => {
  const robots = readFileSync(ROBOTS_PATH, 'utf-8');
  const disallowed = new Set(
    robots
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('Disallow:'))
      .map((line) => line.slice('Disallow:'.length).trim())
  );

  it('declares a sitemap entry', () => {
    expect(robots).toMatch(
      /Sitemap:\s+https:\/\/pushup-stats\.com\/sitemap\.xml/
    );
  });

  it.each(AUTH_ROUTES)('disallows the unprefixed %s route', (route) => {
    expect(disallowed).toContain(route);
  });

  describe.each(readSupportedLocales())('locale %s', (locale) => {
    it.each(AUTH_ROUTES)(`disallows /${locale}%s`, (route) => {
      expect(disallowed).toContain(`/${locale}${route}`);
    });
  });
});
