/**
 * Shared type-ahead matching for every exercise search in the app — the
 * entry dialog's picker, the workout editor and the wiki list. One rule
 * everywhere: every whitespace-separated token of the query must occur in
 * the searched text, so "kn beu" finds Kniebeugen.
 */

/**
 * Case- and diacritic-insensitive search key. Users type "kniebeuge" or
 * "russian twist" without umlauts far more often than not, and the
 * catalog mixes German and English names.
 */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** The query split into normalized tokens; empty for a blank query. */
export function searchTokens(query: string): string[] {
  return normalizeSearch(query).split(' ').filter(Boolean);
}

/**
 * Whether `searchText` — already passed through {@link normalizeSearch} —
 * contains every token. No tokens match everything.
 */
export function matchesTokens(
  tokens: ReadonlyArray<string>,
  searchText: string
): boolean {
  return tokens.every((token) => searchText.includes(token));
}
