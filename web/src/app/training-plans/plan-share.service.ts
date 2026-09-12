import { inject, Injectable, LOCALE_ID } from '@angular/core';

import { ShareService, type ShareResult } from '../core/share.service';
import { buildSharePlanPayload } from './plan-share';
import { TrainingPlanStore } from './training-plan.store';

/**
 * Sharing the plan the user is running. Separate from the pages that offer
 * it — the list card and the detail page both do — so the numbers in the
 * message come from one place.
 */
@Injectable({ providedIn: 'root' })
export class PlanShareService {
  private readonly store = inject(TrainingPlanStore);
  private readonly share = inject(ShareService);
  private readonly localeId = inject(LOCALE_ID) as string;

  async sharePlan(): Promise<ShareResult> {
    const plan = this.store.activeCatalog();
    if (!plan) return 'unavailable';
    return this.share.share(
      buildSharePlanPayload({
        title: plan.title,
        slug: plan.slug,
        totalDays: plan.totalDays,
        dayIndex: this.store.currentDayIndex(),
        percent: this.store.completionPercent(),
        localeId: this.localeId,
        paused: this.store.hasPausedPlan(),
      })
    );
  }
}
