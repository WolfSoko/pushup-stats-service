/**
 * Update payload emitted from the row's edit button. Always carries the
 * `kind` discriminator so the parent store can dispatch to the right
 * Firestore service. `exerciseId` and `variantId` are only meaningful
 * when `kind === 'exercise'`; `type` only when `kind === 'pushup'`.
 *
 * Either `reps` (with optional `sets`) or `durationSec` is set,
 * depending on the underlying exercise's measurement.
 */
export interface StatsTableUpdate {
  kind: 'pushup' | 'exercise';
  id: string;
  timestamp: string;
  reps?: number;
  sets?: number[];
  /**
   * Per-interval breakdown for endurance exercises (`time` /
   * `distance` / `distance-time`). Like `sets`, an empty array is
   * the explicit clear sentinel; the data-access layer maps it to a
   * Firestore `deleteField()` so a stale breakdown can be wiped.
   */
  intervals?: number[];
  durationSec?: number;
  distanceM?: number;
  source: string;
  type?: string;
  exerciseId?: string;
  /**
   * Tri-state forwarded from `EntryDialogResult.variantId`:
   *   - `string` (non-empty): set the variant.
   *   - `null`: clear an existing variant — the store should issue a
   *     Firestore `deleteField()` so the doc no longer carries one.
   *   - `undefined`: no change (omitted from the patch).
   */
  variantId?: string | null;
}

export interface StatsTableRemove {
  kind: 'pushup' | 'exercise';
  id: string;
}

/**
 * Create payload emitted from the table. Mirrors {@link StatsTableUpdate}
 * but without `id`, since a new entry has no doc to patch yet. The `kind`
 * discriminator lets the parent store build the create payload without
 * re-introspecting the dialog result.
 */
export interface StatsTableCreate {
  kind: 'pushup' | 'exercise';
  timestamp: string;
  reps?: number;
  sets?: number[];
  /** Per-interval breakdown for endurance exercises. Mutually
   *  exclusive with `sets` in practice. */
  intervals?: number[];
  durationSec?: number;
  distanceM?: number;
  source?: string;
  type?: string;
  exerciseId?: string;
  variantId?: string;
}
