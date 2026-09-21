import { computed } from '@angular/core';
import {
  signalStoreFeature,
  withComputed,
  withMethods,
  withProps,
} from '@ngrx/signals';
import { createKeyedBusyState } from '@pu-stats/ui';

/**
 * One busy flag per pressed CTA on the plan store. Keys: `start`,
 * `abandon`, `pause`, `resume`; `day:<dayIndex>` for the whole-day
 * actions behind a row's menu; `<kind>:<dayIndex>:<itemIndex>` (`item`,
 * `record`, `clear`) for per-exercise writes, so a day component can be
 * handed its own slice through `dayBusyKeys`.
 */
export function withPlanBusy() {
  return signalStoreFeature(
    withProps(() => ({ _busy: createKeyedBusyState<string>() })),
    withComputed((store) => ({
      busyKeys: store._busy.busyKeys,
      // Grouped once per change, so a day component gets the same Set
      // reference back until its keys actually change (OnPush inputs).
      _busyKeysByDay: computed(() => groupDayBusyKeys(store._busy.busyKeys())),
    })),
    withMethods((store) => ({
      isBusy: (key: string): boolean => store._busy.isBusy(key),
      /** One day's per-exercise keys, day index stripped: `item:0`, `record:1`, … */
      dayBusyKeys: (dayIndex: number): ReadonlySet<string> =>
        store._busyKeysByDay().get(dayIndex) ?? NO_KEYS,
    }))
  );
}

const NO_KEYS: ReadonlySet<string> = new Set();

export function dayBusyKeys(
  keys: ReadonlySet<string>,
  dayIndex: number
): ReadonlySet<string> {
  return groupDayBusyKeys(keys).get(dayIndex) ?? NO_KEYS;
}

/** Per-exercise keys grouped by day, day index stripped from each key. */
export function groupDayBusyKeys(
  keys: ReadonlySet<string>
): ReadonlyMap<number, ReadonlySet<string>> {
  const byDay = new Map<number, Set<string>>();
  for (const key of keys) {
    const [kind, keyDay, item] = key.split(':');
    if (keyDay === undefined || item === undefined) continue;
    const day = Number(keyDay);
    let bucket = byDay.get(day);
    if (!bucket) byDay.set(day, (bucket = new Set()));
    bucket.add(`${kind}:${item}`);
  }
  return byDay;
}
