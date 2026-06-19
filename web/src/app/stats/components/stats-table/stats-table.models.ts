/**
 * `exerciseId` and `variantId` are only meaningful when
 * `kind === 'exercise'`; `type` only when `kind === 'pushup'`.
 */
export interface StatsTableUpdate {
  kind: 'pushup' | 'exercise';
  id: string;
  timestamp: string;
  reps?: number;
  sets?: number[];
  /**
   * Like `sets`, an empty array is the explicit clear sentinel; the
   * data-access layer maps it to a Firestore `deleteField()` so a stale
   * breakdown can be wiped.
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
 * Mirrors {@link StatsTableUpdate} but without `id`, since a new entry has
 * no doc to patch yet.
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
