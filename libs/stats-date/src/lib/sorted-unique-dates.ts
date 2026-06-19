/**
 * Distinct `YYYY-MM-DD` day keys from a set of timestamped rows, sorted
 * ascending. Timestamps are sliced to their date portion, so multiple
 * entries on the same day collapse to one key.
 */
export function sortedUniqueDates(
  rows: ReadonlyArray<{ timestamp: string }>
): string[] {
  return [...new Set(rows.map((x) => x.timestamp.slice(0, 10)))].sort((a, b) =>
    a.localeCompare(b)
  );
}
