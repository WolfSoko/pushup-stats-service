import { Injectable } from '@angular/core';
import { PushupRecord } from '@pu-stats/models';

@Injectable({ providedIn: 'root' })
export class AdaptiveQuickAddService {
  /**
   * Computes 3 adaptive suggestions based on the last 5 entries.
   * Suggestions are rounded to the nearest 5, minimum 1.
   * Falls back to [1, 5, 10] when no history is available.
   */
  compute(records: PushupRecord[]): number[] {
    const recent = records.slice(-5);
    if (recent.length === 0) {
      return [1, 5, 10];
    }
    const avg = recent.reduce((sum, r) => sum + r.reps, 0) / recent.length;
    const roundToFive = (v: number): number =>
      Math.max(1, Math.round(v / 5) * 5);
    const suggestions = [
      roundToFive(avg * 0.5),
      roundToFive(avg),
      roundToFive(avg * 1.25),
    ];
    // Deduplicate while preserving order
    return [...new Set(suggestions)];
  }
}
