import type { AutoCountMode } from './auto-count-dialog.models';
import {
  sanitizeTuningValues,
  type TuningKind,
} from './auto-count-tuning.models';

/**
 * What one finished auto-count run reported versus what actually
 * happened. The thresholds ride along because a miscount is only
 * interpretable together with the values the detector was running on —
 * without them a corrected count says "it was wrong" but not "wrong at
 * these settings".
 */
export interface AutoCountFeedback {
  /** Catalog id the entry will be booked under. */
  readonly exerciseId: string;
  /** Detector profile id the thresholds belong to. */
  readonly profileId: string;
  readonly mode: AutoCountMode;
  readonly detectedReps: number;
  readonly actualReps: number;
  readonly thresholds: Readonly<Record<string, number>>;
}

export const AUTO_COUNT_FEEDBACK_STORAGE_KEY = 'pus_auto_count_feedback';

/**
 * Opt-out, not opt-in: the question is one tap after a set the user
 * just finished, and the data is only useful if most runs answer it.
 * Storage is per device and read defensively — a private window or
 * blocked site data must leave the prompt working, not crash the
 * dialog that just counted someone's set.
 */
export function isAutoCountFeedbackEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    return localStorage.getItem(AUTO_COUNT_FEEDBACK_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setAutoCountFeedbackEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      AUTO_COUNT_FEEDBACK_STORAGE_KEY,
      enabled ? 'on' : 'off'
    );
  } catch {
    // Storage disabled — the toggle then only holds for this session,
    // which is better than failing the settings page.
  }
}

/**
 * The numeric thresholds a run actually ran on: catalog defaults with
 * any tuned overrides on top. Structural fields (id, joint triplets)
 * are dropped — they are not settings and would bloat every document.
 */
export function effectiveThresholds(
  kind: TuningKind,
  profile: object | null,
  overrides: Readonly<Record<string, number>>
): Record<string, number> {
  return {
    ...sanitizeTuningValues(kind, profile ?? {}),
    ...sanitizeTuningValues(kind, overrides),
  };
}
