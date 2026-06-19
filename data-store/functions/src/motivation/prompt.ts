import { QUOTE_TIERS, type TieredQuotes } from './logic';

/**
 * Per-tier prompt instruction (tone) — appended to the language-agnostic
 * prompt so the model produces tiered output in a single Gemini call.
 * Keeping it in English (no German wording) lets the same map drive every
 * supported locale; the model is told the *output* language separately.
 */
const TIER_INSTRUCTIONS: Record<(typeof QUOTE_TIERS)[number], string> = {
  general: 'general motivation, fitness vibe',
  belowGoal: 'encouraging "let’s start" / "you can do it" tone',
  nearGoal: 'push-through tone, halfway-there energy',
  goalReached: 'celebration + "next-level" challenge tone',
};

const QUOTES_PER_TIER = 6;

/**
 * BCP-47 display names used in the Gemini prompt so the model produces
 * quotes in the requested locale even for tags without obvious instruction
 * (la, no, zh, …). Falls back to the locale code itself.
 */
const LANGUAGE_PROMPT_NAMES: Record<string, string> = {
  de: 'German',
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  nl: 'Dutch',
  el: 'Greek',
  la: 'Latin',
  no: 'Norwegian',
  zh: 'Simplified Chinese',
};

export function buildTieredPrompt(
  language: string,
  totalToday: number,
  dailyGoal: number,
  displayName: string
): string {
  const langName = LANGUAGE_PROMPT_NAMES[language] ?? language;
  const tierLines = QUOTE_TIERS.map(
    (tier) =>
      `  "${tier}": ${QUOTES_PER_TIER} short sentences — ${TIER_INSTRUCTIONS[tier]}`
  ).join('\n');
  return [
    `Generate motivational push-up quotes in ${langName} for ${displayName}, who has done ${totalToday} of ${dailyGoal} push-ups today.`,
    'Each quote must be ≤ 120 characters. Vary tone (sporty, funny, serious).',
    'Return ONLY a JSON object with these keys (no markdown, no commentary):',
    tierLines,
    'Example shape: {"general":["..."],"belowGoal":["..."],"nearGoal":["..."],"goalReached":["..."]}',
  ].join('\n');
}

export function extractTieredQuotes(text: string): TieredQuotes | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  const result: TieredQuotes = {
    general: [],
    belowGoal: [],
    nearGoal: [],
    goalReached: [],
  };
  let hasAny = false;
  for (const tier of QUOTE_TIERS) {
    const raw = obj[tier];
    if (Array.isArray(raw)) {
      const cleaned = raw
        .map((q) => (typeof q === 'string' ? q : String(q ?? '')))
        .map((q) => q.trim())
        .filter((q) => q.length > 0);
      if (cleaned.length > 0) hasAny = true;
      result[tier] = cleaned;
    }
  }
  return hasAny ? result : null;
}
