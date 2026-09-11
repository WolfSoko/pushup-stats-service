import { logger } from 'firebase-functions';

import { db } from '../firebase-app';
import { flattenTiers, type TieredQuotes } from '../motivation';

/**
 * Reads the cached motivation pool a user has for `lang` and returns a
 * flat list of quote strings. Tolerant of legacy doc shapes (flat
 * `quotes: string[]` / `quotes: {text}[]`) and the new tiered shape.
 * Returns an empty array on any error so the caller falls back to the
 * built-in localised messages.
 */
export async function loadMotivationPool(
  uid: string,
  lang: string
): Promise<string[]> {
  try {
    const snap = await db
      .collection('motivationQuotes')
      .doc(`${uid}__${lang}`)
      .get();
    if (!snap.exists) return [];
    const data = snap.data() as
      | {
          tiers?: TieredQuotes;
          quotes?: ReadonlyArray<unknown>;
        }
      | undefined;
    if (!data) return [];
    if (data.tiers) return flattenTiers(data.tiers);
    if (Array.isArray(data.quotes)) {
      return data.quotes
        .map((q) =>
          typeof q === 'string'
            ? q
            : typeof q === 'object' && q !== null && 'text' in q
              ? String((q as { text?: unknown }).text ?? '')
              : String(q ?? '')
        )
        .filter((q) => q.trim().length > 0);
    }
    return [];
  } catch (err) {
    // Defensive against non-Error throws (string, null, etc.) — we don't
    // want the logger itself to throw and surface as an unhandled
    // rejection in the dispatch loop.
    logger.warn('loadMotivationPool: failed', {
      uid,
      lang,
      err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
