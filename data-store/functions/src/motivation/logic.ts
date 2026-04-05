/**
 * Motivation quotes generation logic
 * Pure logic for quote selection and name sanitization
 */

export const QUOTE_CACHE_HOURS = 12;

export const FALLBACK_QUOTES_DE = [
  'Du schaffst das! Jede Liegestütze bringt dich weiter.',
  'Stark sein heißt, auch wenn es schwer fällt, weiterzumachen.',
  'Dein Körper kann mehr, als dein Kopf glaubt.',
  'Fortschritt entsteht außerhalb der Komfortzone.',
  'Heute der beste Tag für eine neue Bestleistung!',
];

export const FALLBACK_QUOTES_EN = [
  'You can do it! Every push-up gets you closer to your goal.',
  'Being strong means pushing through even when it gets tough.',
  'Your body can do more than your mind thinks.',
  'Progress happens outside the comfort zone.',
  'Today is the best day for a new personal best!',
];

/**
 * Gets fallback quotes for a language
 * @param language Language code ('en' or 'de')
 * @returns Array of fallback quote strings
 */
export function getFallbackQuotes(language: string): string[] {
  return language === 'en' ? [...FALLBACK_QUOTES_EN] : [...FALLBACK_QUOTES_DE];
}

/**
 * Sanitizes user display name for use in prompts
 * Removes special characters and limits length
 * @param rawName Raw display name from user
 * @returns Sanitized name or 'Champ' if empty
 */
export function sanitizeDisplayName(rawName: string): string {
  const trimmed = String(rawName || '').trim();
  const sanitized = trimmed
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF .,'!?-]/g, '')
    .slice(0, 50)
    .trim();
  return sanitized || 'Champ';
}

/**
 * Extracts JSON array from text (for parsing AI-generated responses)
 * @param text Text containing JSON array
 * @returns Parsed array or null if not found/invalid
 */
export function extractJsonArray(text: string): unknown[] | null {
  try {
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Filters and converts array of quotes to strings
 * @param quotes Array of quote objects or strings
 * @returns Filtered array of non-empty strings
 */
export function filterValidQuotes(quotes: unknown[]): string[] {
  return quotes
    .map((quote): string | null => {
      if (typeof quote === 'string') {
        return quote;
      }

      if (
        typeof quote === 'object' &&
        quote !== null &&
        'text' in quote &&
        typeof quote.text === 'string'
      ) {
        return quote.text;
      }

      // Convert other types (numbers, etc.) to strings
      if (quote !== null && quote !== undefined) {
        return String(quote);
      }

      return null;
    })
    .filter((q): q is string => q !== null && q.trim().length > 0);
}

/**
 * Checks if cache is still valid
 * @param generatedAtIso ISO timestamp of when cache was generated
 * @param nowMs Current time in milliseconds
 * @returns true if cache is newer than QUOTE_CACHE_HOURS
 */
export function isCacheValid(generatedAtIso: string, nowMs: number): boolean {
  try {
    const generatedAt = new Date(generatedAtIso);
    const ageHours = (nowMs - generatedAt.getTime()) / (1000 * 60 * 60);
    return ageHours < QUOTE_CACHE_HOURS;
  } catch {
    return false;
  }
}
