import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import { UserContextService } from '@pu-auth/auth';
import { XpApiService } from '@pu-stats/data-access';
import { LiveDataStore, XpStore } from '@pu-stats/data-access-state';
import { of } from 'rxjs';

import { AnalysisStore } from './analysis.store';
import {
  buildXpAnalysis,
  xpBucketGranularity,
  type XpAnalysis,
  type XpAnalysisEntry,
} from './analysis/xp-analysis';

/**
 * XP slice of the analysis page. Separate from {@link AnalysisStore} to
 * keep that one from growing further; it reads the page's visible rows,
 * so the XP section follows the range and the exercise checkboxes.
 * Provided next to the XP section, so the ledger listener — limited to
 * the selected range — lives only while the section is mounted.
 */
export const AnalysisXpStore = signalStore(
  withProps(() => {
    const analysis = inject(AnalysisStore);
    const user = inject(UserContextService);
    const api = inject(XpApiService);
    return {
      _analysis: analysis,
      _live: inject(LiveDataStore),
      _xp: inject(XpStore),
      _ledger: rxResource({
        params: () => ({ uid: user.userIdSafe(), from: analysis.from() }),
        stream: ({ params }) =>
          params.uid
            ? api.watchLedger(params.uid, params.from || undefined)
            : of(new Map<string, number>()),
      }),
    };
  }),
  withComputed((store) => ({
    loading: computed(
      () => !store._xp.loaded() || !store._live.exerciseEntriesLoaded()
    ),
    progress: store._xp.progress,
    analysis: computed<XpAnalysis>(() => {
      const booked = store._ledger.hasValue()
        ? store._ledger.value()
        : undefined;
      const xpOf = (entry: XpAnalysisEntry) =>
        booked?.get(entry._id) ?? store._xp.previewXp(entry);
      return buildXpAnalysis(store._analysis.visibleRows(), xpOf, {
        from: store._analysis.from(),
        to: store._analysis.to(),
        granularity: xpBucketGranularity(store._analysis.viewGranularity()),
      });
    }),
  }))
);
