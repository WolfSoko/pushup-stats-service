/**
 * Cache-Control policy for Server-rendered (non-prerendered) routes
 * whose HTML is fully determined by build-time catalogs rather than
 * per-request data — currently the wiki detail pages
 * (`wiki/liegestuetz-typen/:slug`, `wiki/uebungen/:slug`, see
 * `app.routes.server.ts`). Every request for a given path renders the
 * same bytes until the next deploy, so leaving it uncached would make
 * Cloud Run re-render identical HTML on every hit for no reason.
 *
 * Reuses `SHORT_LIVED_CACHE_CONTROL`'s 5-minute TTL — the same "stable
 * URL, content can only change on the next deploy" reasoning already
 * applied to prerendered HTML shells in `server-static-cache.ts`.
 *
 * Kept Express-free (pure path matcher) so it's unit-testable without
 * spinning up Supertest, matching `server-locale-redirect.ts` and
 * `server-static-cache.ts`.
 */

import { SUPPORTED_LOCALES } from './server-locale-redirect';

const CACHEABLE_SSR_PATH_RE = new RegExp(
  `^/(?:${SUPPORTED_LOCALES.join('|')})/wiki/(?:liegestuetz-typen|uebungen)/[^/]+/?$`
);

export function isCacheableStaticSsrPath(path: string): boolean {
  return CACHEABLE_SSR_PATH_RE.test(path);
}
