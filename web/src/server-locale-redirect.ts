/**
 * Pure decision logic for the SSR locale-redirect middleware.
 *
 * Kept Express-free so the routing semantics are unit-testable without
 * spinning up Supertest. The Express wrapper in `server.ts` only has to
 * adapt request fields in and apply the result out.
 *
 * The middleware exists because Angular's i18n build registers app
 * routes (`/u/:uid`, `/login`, `/leaderboard`, …) only inside the
 * `/de/...` and `/en/...` bundles. Angular SSR's own locale middleware
 * only redirects the bare root `/`; every other unprefixed path
 * otherwise reaches the Angular app with no matching route and surfaces
 * as Express's default `Cannot GET /<path>`.
 */

export interface LocaleRedirectInput {
  /** HTTP method (e.g. `'GET'`). Only GET / HEAD are eligible for redirect. */
  readonly method: string;
  /** Pathname only, no query/hash (matches Express `req.path`). */
  readonly path: string;
  /** Full request URL, path + query + hash (matches Express `req.url`). */
  readonly url: string;
  /** Raw `Accept-Language` header value, may be undefined. */
  readonly acceptLanguage: string | undefined;
}

export type LocaleRedirectResult =
  | { readonly kind: 'pass' }
  | { readonly kind: 'redirect'; readonly location: string };

/**
 * Locale codes registered by the Angular i18n build. Order matters
 * only for `pickLocale` fallback semantics; the source locale (`de`)
 * is always first.
 */
export const SUPPORTED_LOCALES = [
  'de',
  'en',
  'fr',
  'es',
  'it',
  'nl',
  'el',
  'la',
] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Locale prefixes registered by the Angular i18n build. */
export const LOCALE_PREFIXES: ReadonlySet<string> = new Set(SUPPORTED_LOCALES);

/**
 * Files served from the domain root (rewritten to `/de/<file>` by an
 * earlier middleware) — must NOT be redirected here, otherwise crawlers
 * would land on `/de/robots.txt` instead of `/robots.txt`.
 */
export const ROOT_FILES: ReadonlySet<string> = new Set([
  'ads.txt',
  'robots.txt',
  'sitemap.xml',
]);

/**
 * Restricted to URL-safe app-route characters. Anything outside
 * (backslashes, control characters, exotic Unicode) falls through to
 * Angular instead of being redirected — defense-in-depth against
 * open-redirect / header-injection through the `Location` header
 * (CodeQL js/server-side-unvalidated-url-redirection).
 */
export const SAFE_REDIRECT_PATH_RE = /^\/[A-Za-z0-9/_\-.~%]*$/;

/**
 * Pick a locale based on `Accept-Language`. Honours both the user's
 * stated order and explicit `;q=` weights so headers like
 * `en;q=0.1,fr;q=1.0` resolve to `fr` (highest weight wins) and
 * `it-IT,en;q=0.5` resolves to `it` (header order tie-breaks at
 * weight 1.0). Missing weights default to 1.0 per RFC 7231 §5.3.5;
 * malformed weights drop to 0 so the entry is deprioritised rather
 * than crashing the redirect.
 *
 * Falls back to the source locale (`de`) when the header is absent,
 * empty, or contains no supported language. Less common locales (`el`,
 * `la`) are matched too, even though browsers rarely advertise them —
 * users can configure them manually in OS-level language settings.
 */
export function pickLocale(
  acceptLanguage: string | undefined
): SupportedLocale {
  const accept = String(acceptLanguage ?? '').toLowerCase();
  if (!accept) return 'de';
  const ranked = accept
    .split(',')
    .map((entry, index) => {
      const [rawTag, ...params] = entry.split(';');
      const tag = rawTag.trim();
      const qParam = params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='));
      const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
      return { tag, q: Number.isFinite(q) ? q : 0, index };
    })
    // Drop empty tags and explicit `q=0` rejections (RFC 7231 §5.3.1
    // — a value of 0 means "not acceptable", so we must not redirect
    // a user to a locale they explicitly opted out of).
    .filter((e) => e.tag !== '' && e.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { tag } of ranked) {
    const primary = tag.split('-')[0];
    if ((SUPPORTED_LOCALES as ReadonlyArray<string>).includes(primary)) {
      return primary as SupportedLocale;
    }
  }
  return 'de';
}

/**
 * Decide whether a request should be redirected to its locale-prefixed
 * variant, and where to.
 *
 * Skipped (returns `pass`):
 * - non-GET/HEAD methods
 * - root path `/` (Angular SSR's own locale middleware handles it)
 * - already-prefixed paths (`/de`, `/en`, and any subpath thereof)
 * - well-known root files (rewritten by an earlier middleware)
 * - paths with a file extension (static assets)
 * - paths with characters outside `SAFE_REDIRECT_PATH_RE`
 *
 * The `Location` is built from `lang` (whitelisted) plus `path`
 * (regex-validated). Query/hash is preserved by way of `url.search`
 * after parsing — see test for header-injection edge cases — but we
 * carry forward only the search component since none of the handled
 * routes care about hash on the server side.
 */
export function computeLocaleRedirect(
  input: LocaleRedirectInput
): LocaleRedirectResult {
  if (input.method !== 'GET' && input.method !== 'HEAD')
    return { kind: 'pass' };
  const path = input.path;
  if (path === '/') return { kind: 'pass' };

  const firstSegment = path.split('/')[1] ?? '';
  if (LOCALE_PREFIXES.has(firstSegment)) return { kind: 'pass' };
  if (ROOT_FILES.has(firstSegment)) return { kind: 'pass' };

  // Legacy locale: the Greek build was published under `/grc/...` (mislabelled
  // as Ancient Greek) before the rename to `/el/...`. Preserve any indexed or
  // bookmarked URLs by redirecting them 1:1 to the new prefix, query string
  // intact. Without this, `/grc/blog/...` would fall through to the generic
  // locale redirect and end up at `/<detected-locale>/grc/blog/...` — a 404.
  if (firstSegment === 'grc' && SAFE_REDIRECT_PATH_RE.test(path)) {
    const rest = path.slice('/grc'.length);
    let search: string;
    try {
      search = new URL(input.url, 'http://internal.invalid').search;
    } catch {
      search = '';
    }
    return { kind: 'redirect', location: `/el${rest}${search}` };
  }

  const lastSegment = path.split('/').pop() ?? '';
  if (lastSegment.includes('.')) return { kind: 'pass' };

  if (!SAFE_REDIRECT_PATH_RE.test(path)) return { kind: 'pass' };

  const lang = pickLocale(input.acceptLanguage);

  // Preserve `?returnUrl=…` and similar load-bearing query params (e.g.
  // for `/login`). We re-parse via `URL` against a synthetic base so the
  // search component is normalised (encoded, no fragment, no host
  // injection) before being concatenated into the Location header.
  // Malformed URLs drop the suffix entirely rather than echo it back.
  let search: string;
  try {
    search = new URL(input.url, 'http://internal.invalid').search;
  } catch {
    search = '';
  }

  return { kind: 'redirect', location: `/${lang}${path}${search}` };
}
