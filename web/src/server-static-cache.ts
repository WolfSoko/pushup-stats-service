/**
 * Cache-Control policy for files served by `express.static` out of the
 * Angular browser bundle (`dist/web/browser/**`).
 *
 * Firebase App Hosting fronts Cloud Run with Google's CDN. Edge caching
 * only kicks in when the origin sends `Cache-Control: public` with an
 * explicit `max-age` / `s-maxage`. We split files into two buckets:
 *
 * 1. **Content-hashed bundles** (JS chunks, CSS, hashed images, hashed
 *    fonts). Filenames carry an 8+-char hash, so a new deploy emits a
 *    new filename. Safe to cache forever and mark `immutable` so
 *    revalidation is suppressed.
 * 2. **Stable filenames** (HTML shells emitted by SSR prerender,
 *    `manifest.webmanifest`, unhashed icons). A new deploy reuses the
 *    same path with new content. Use a short shared TTL so the CDN
 *    holds them briefly without trapping a stale shell after rollout.
 *
 * The decision is purely a function of the resolved file path, which
 * makes it trivially unit-testable without spinning up Express.
 *
 * NOTE: `express.static`'s `maxAge` option emits a `Cache-Control`
 * header, but the comment around `/.well-known` in `server.ts`
 * documents that App Hosting's edge layer was observed overriding it
 * to `no-cache` in production. Setting the header explicitly via
 * `setHeaders` runs before the response is flushed and survives the
 * trip through Cloud Run.
 */

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const SHORT_TTL_SECONDS = 300;
// `build-info.json` answers "which version is live right now" — the one file
// whose whole value is being current, so it gets a tighter TTL than the other
// stable filenames while still letting the CDN absorb repeat hits.
const BUILD_INFO_TTL_SECONDS = 60;

// `name-HASH.ext` (Angular esbuild chunks) and `name.HASH.ext` (legacy
// asset hashing) are both covered by accepting `-` or `.` as the
// separator before the hash. The hash is at least 8 chars of A–Z / 0–9
// (Angular uses uppercase base32). Anchored to the end of the path so a
// hash-like sequence in a directory name doesn't trigger.
//
// Deliberately case-SENSITIVE: an `i` flag would let any lowercase word
// of 8+ letters pass as a hash, so hand-authored assets like
// `hero-geschichte.jpg` were served `immutable` for a year and could
// never be replaced under the same filename. Angular emits both the
// hash and the extension lowercase/uppercase respectively, so nothing
// legitimate needs the flag.
const HASHED_ASSET_RE =
  /[-.][A-Z0-9]{8,}\.(?:js|mjs|css|map|woff2?|ttf|otf|eot|png|jpe?g|gif|svg|webp|avif|ico)$/;

export const HASHED_ASSET_CACHE_CONTROL = `public, max-age=${ONE_YEAR_SECONDS}, immutable`;
export const SHORT_LIVED_CACHE_CONTROL = `public, max-age=${SHORT_TTL_SECONDS}`;
export const BUILD_INFO_CACHE_CONTROL = `public, max-age=${BUILD_INFO_TTL_SECONDS}`;

export function isHashedAsset(filePath: string): boolean {
  return HASHED_ASSET_RE.test(filePath);
}

export function isBuildInfo(filePath: string): boolean {
  return /(^|\/)build-info\.json$/.test(filePath);
}

export function staticCacheControl(filePath: string): string {
  if (isBuildInfo(filePath)) return BUILD_INFO_CACHE_CONTROL;
  return isHashedAsset(filePath)
    ? HASHED_ASSET_CACHE_CONTROL
    : SHORT_LIVED_CACHE_CONTROL;
}
