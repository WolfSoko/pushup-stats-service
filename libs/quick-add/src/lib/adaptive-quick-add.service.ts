import { Injectable } from '@angular/core';
import { PushupRecord } from '@pu-stats/models';

@Injectable({ providedIn: 'root' })
export class AdaptiveQuickAddService {
  /**
   * Computes 3 adaptive suggestions based on the last 5 entries.
   * Suggestions are rounded to the nearest 5, minimum 1.
   * Falls back to [1, 5, 10] when no history is available.
   */
  compute(records: PushupRecord[]): [number, number, number] {
    const recent = records.slice(-5);
    if (recent.length === 0) {
      return [1, 5, 10];
    }
    const avg = recent.reduce((sum, r) => sum + r.reps, 0) / recent.length;
    const raw: [number, number, number] = [
      Math.max(1, Math.round((avg * 0.5) / 5) * 5),
      Math.max(1, Math.round(avg / 5) * 5),
      Math.max(1, Math.round((avg * 1.25) / 5) * 5),
    ];
    const result: number[] = [];
    for (const v of raw) {
      if (!result.includes(v)) result.push(v);
    }
    while (result.length < 3) result.push(Math.max(...result) + 5);
    return result.slice(0, 3) as [number, number, number];
  }
}
