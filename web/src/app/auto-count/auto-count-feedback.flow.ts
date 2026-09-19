import { inject, Injectable } from '@angular/core';
import { profileFor } from '@pu-stats/auto-count';

import type { AutoCountMode } from './auto-count-dialog.models';
import {
  effectiveThresholds,
  isAutoCountFeedbackEnabled,
  setAutoCountFeedbackEnabled,
} from './auto-count-feedback.models';
import { AutoCountFeedbackService } from './auto-count-feedback.service';
import { AutoCountTuningStore } from './auto-count-tuning.store';

/** What the dialog knows about the run that just finished. */
export interface AutoCountRunContext {
  readonly exerciseId: string;
  readonly profileId: string;
  readonly mode: AutoCountMode;
  readonly detectedReps: number;
}

/**
 * Decides whether to ask how the run went and records the answer,
 * keeping the dialog free of telemetry: it only asks this service
 * whether to show the step and hands back the number it got.
 */
@Injectable({ providedIn: 'root' })
export class AutoCountFeedbackFlow {
  private readonly api = inject(AutoCountFeedbackService);
  private readonly tuning = inject(AutoCountTuningStore);

  shouldAsk(): boolean {
    return isAutoCountFeedbackEnabled();
  }

  disable(): void {
    setAutoCountFeedbackEnabled(false);
  }

  /**
   * Never rejects: a failed write must not cost the user the entry they
   * just earned, and there is nothing they could do about it anyway.
   */
  async record(
    context: AutoCountRunContext,
    actualReps: number
  ): Promise<void> {
    try {
      await this.api.submit({
        exerciseId: context.exerciseId,
        profileId: context.profileId,
        mode: context.mode,
        detectedReps: context.detectedReps,
        actualReps,
        thresholds: this.thresholdsFor(context),
      });
    } catch {
      // Swallowed by design; see the doc comment.
    }
  }

  /** Proximity counting has no joint profile, so there is nothing to report. */
  private thresholdsFor(
    context: AutoCountRunContext
  ): Readonly<Record<string, number>> {
    if (context.mode === 'proximity') return {};
    return effectiveThresholds(
      'angle',
      profileFor(context.profileId),
      this.tuning.valuesFor(context.profileId)
    );
  }
}
