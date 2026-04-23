const WORDS_PER_MINUTE = 200;

export function countWords(html: string): number {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function readingMinutes(html: string): number {
  return Math.max(1, Math.round(countWords(html) / WORDS_PER_MINUTE));
}
