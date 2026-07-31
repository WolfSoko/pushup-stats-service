import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Root of the Play store listing sources. One directory per Play locale,
 * each holding the three text fields the Play API accepts.
 */
export const LISTINGS_ROOT = resolve(
  new URL('../..', import.meta.url).pathname,
  'store/play'
);

export const FIELD_FILES = {
  title: 'title.txt',
  shortDescription: 'short-description.txt',
  fullDescription: 'full-description.txt',
};

/**
 * Hard limits enforced by the Play Console. Exceeding any of them makes
 * `edits.commit` fail with a validation error *after* the edit was already
 * opened, so we check locally first and never open an edit we can't commit.
 */
export const LIMITS = {
  title: 30,
  shortDescription: 80,
  fullDescription: 4000,
};

/**
 * Play uses full BCP-47-ish locale codes where the app uses bare language
 * codes, so `de` is not a valid Play locale and would be rejected at commit
 * time. Keys are the app's `localize` codes from `web/project.json`; values
 * are the Play Console locale each one maps to.
 *
 * A locale listed here does not have to have a listing on disk — English and
 * the rest are still untranslated. The map exists so a new listing directory
 * can only ever be one of the codes Play actually accepts.
 */
export const PLAY_LOCALE_BY_APP_LOCALE = Object.freeze({
  de: 'de-DE',
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  nl: 'nl-NL',
  el: 'el-GR',
  no: 'no-NO',
  zh: 'zh-CN',
});

export const SUPPORTED_PLAY_LOCALES = Object.freeze(
  Object.values(PLAY_LOCALE_BY_APP_LOCALE)
);

/**
 * Play counts characters, not UTF-16 code units. The description is full of
 * emoji (📷, 🏋️, …) which are surrogate pairs, so `String.length` overcounts
 * them and would reject copy the Console accepts. Spread into code points.
 */
export function countCharacters(text) {
  return [...text].length;
}

function readField(localeDir, fileName) {
  // Trailing newline is a file-hygiene artifact, not part of the copy —
  // sending it would burn a character against the limit.
  return readFileSync(join(localeDir, fileName), 'utf-8').replace(/\n+$/, '');
}

export function listLocaleDirectories(root = LISTINGS_ROOT) {
  return readdirSync(root)
    .filter((entry) => statSync(join(root, entry)).isDirectory())
    .sort();
}

/**
 * Reads every listing from disk and validates it. Returns one entry per
 * locale, shaped like the `Listing` resource the Play API expects.
 *
 * Throws on anything that would make the remote commit fail: an unknown
 * locale directory, a missing field file, an empty field, or copy over the
 * character limit.
 */
export function readListings(root = LISTINGS_ROOT) {
  const locales = listLocaleDirectories(root);
  if (locales.length === 0) {
    throw new Error(`No listing directories found under ${root}`);
  }

  const problems = [];
  const listings = [];

  for (const locale of locales) {
    if (!SUPPORTED_PLAY_LOCALES.includes(locale)) {
      problems.push(
        `${locale}: not a Play locale for this app — expected one of ${SUPPORTED_PLAY_LOCALES.join(', ')}`
      );
      continue;
    }

    const localeDir = join(root, locale);
    const listing = { language: locale };

    for (const [field, fileName] of Object.entries(FIELD_FILES)) {
      let value;
      try {
        value = readField(localeDir, fileName);
      } catch {
        problems.push(`${locale}: missing ${fileName}`);
        continue;
      }

      if (value.trim() === '') {
        problems.push(`${locale}/${fileName}: is empty`);
        continue;
      }

      const length = countCharacters(value);
      if (length > LIMITS[field]) {
        problems.push(
          `${locale}/${fileName}: ${length} characters, limit is ${LIMITS[field]}`
        );
        continue;
      }

      listing[field] = value;
    }

    listings.push(listing);
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid Play listing sources:\n  ${problems.join('\n  ')}`
    );
  }

  return listings;
}
