import { computed, inject } from '@angular/core';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import { LiveDataStore, XpStore } from '@pu-stats/data-access-state';

import { AnalysisStore } from './analysis.store';
import { buildXpAnalysis, type XpAnalysis } from './analysis/xp-analysis';

/**
 * XP slice of the analysis page. Separate from {@link AnalysisStore} to
 * keep that one from growing further; it reads the same range and the
 * same exercise checkboxes, so the XP section filters with the page.
 * Provided next to the XP section, which only mounts under the page's
 * `AnalysisStore`.
 */
export const AnalysisXpStore = signalStore(
  withProps(() => ({
    _analysis: inject(AnalysisStore),
    _live: inject(LiveDataStore),
    _xp: inject(XpStore),
  })),
  withComputed((store) => ({
    loading: computed(
      () => !store._xp.loaded() || !store._live.exerciseEntriesLoaded()
    ),
    progress: store._xp.progress,
    analysis: computed<XpAnalysis>(() => {
      const from = store._analysis.from();
      const to = store._analysis.to();
      const hidden = new Set(store._analysis.hiddenExerciseIds());
      const entries = store._live.exerciseEntries().filter((e) => {
        if (hidden.has(e.exerciseId)) return false;
        const date = e.timestamp.slice(0, 10);
        return !(from && date < from) && !(to && date > to);
      });
      return buildXpAnalysis(entries, (e) => store._xp.xpOfEntry(e._id, e), {
        from,
        to,
      });
    }),
  }))
);
