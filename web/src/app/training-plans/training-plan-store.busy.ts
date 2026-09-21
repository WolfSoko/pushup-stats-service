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
    withComputed((store) => ({ busyKeys: store._busy.busyKeys })),
    withMethods((store) => ({
      isBusy: (key: string): boolean => store._busy.isBusy(key),
      /** One day's per-exercise keys, day index stripped: `item:0`, `record:1`, … */
      dayBusyKeys: (dayIndex: number): ReadonlySet<string> =>
        dayBusyKeys(store._busy.busyKeys(), dayIndex),
    }))
  );
}

export function dayBusyKeys(
  keys: ReadonlySet<string>,
  dayIndex: number
): ReadonlySet<string> {
  const day = String(dayIndex);
  const result = new Set<string>();
  for (const key of keys) {
    const [kind, keyDay, item] = key.split(':');
    if (keyDay === day && item !== undefined) result.add(`${kind}:${item}`);
  }
  return result;
}
