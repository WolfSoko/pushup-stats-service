/**
 * The product's identity in one place: name, domain, contact address.
 *
 * Everything that renders the brand reads it from here, so a rename touches
 * this file instead of ~30 scattered literals. `brand.guard.spec.ts` fails the
 * build if a literal creeps back into production sources.
 *
 * `libs/sw-push` is the one consumer that does not import this: the SW bundle
 * stays free of cross-package imports (see `SW_SUPPORTED_LOCALES` there for
 * the same trade-off), so it mirrors `BRAND_NAME` locally and a drift guard
 * keeps the copy honest.
 *
 * Asset *filenames* (`pushup-logo.png`) are not here. They are renamed with
 * the artwork itself, not with the brand string.
 */

/** Display name, as shown to users and to crawlers. */
export const BRAND_NAME = 'Pushup Tracker';

/** Bare host, for prose that names the site without linking it. */
export const BRAND_DOMAIN = 'pushup-stats.com';

/** Canonical origin. No trailing slash — callers append their own path. */
export const BRAND_URL = `https://${BRAND_DOMAIN}`;

/** Imprint and privacy-policy contact. Legally required to be reachable. */
export const BRAND_CONTACT_EMAIL = `contact@${BRAND_DOMAIN}`;

/** Absolute logo URL for schema.org publisher blocks and OG tags. */
export const BRAND_LOGO_URL = `${BRAND_URL}/assets/pushup-logo.png`;

/**
 * Site-wide share image, 1200×630 PNG — the dimensions `index.html` declares
 * statically. Pages that bring no image of their own fall back to it, so a
 * share card never ends up with dimension tags but no picture.
 */
export const BRAND_OG_IMAGE_URL = `${BRAND_URL}/pushup-stats-og.png`;
