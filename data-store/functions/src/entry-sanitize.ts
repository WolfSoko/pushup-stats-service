/**
 * Returns the input as a `number[]` of finite, non-negative integers. Any
 * non-array, non-numeric, or out-of-shape values become an empty array so
 * downstream `reduce()`s in the delta/rebuild math never see NaN.
 */
export function sanitizeSetsArray(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  const out: number[] = [];
  for (const v of input) {
    if (typeof v !== 'number') continue;
    if (!Number.isFinite(v) || !Number.isInteger(v)) continue;
    if (v < 0) continue;
    out.push(v);
  }
  return out;
}
