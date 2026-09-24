import { computed, signal, type Signal } from '@angular/core';

export interface BusyState {
  /** True while at least one wrapped promise is still pending. */
  readonly busy: Signal<boolean>;
  /** Counts `work` as busy until it settles; the result is passed through. */
  run<T>(work: Promise<T> | (() => Promise<T>)): Promise<T>;
}

export interface KeyedBusyState<K> {
  /** Every key with a pending promise. */
  readonly busyKeys: Signal<ReadonlySet<K>>;
  /** True while at least one key is busy. */
  readonly busy: Signal<boolean>;
  /** Reactive: reads `busyKeys`, so templates update per row. */
  isBusy(key: K): boolean;
  run<T>(key: K, work: Promise<T> | (() => Promise<T>)): Promise<T>;
}

/** A factory that throws synchronously must still settle the counter. */
function start<T>(work: Promise<T> | (() => Promise<T>)): Promise<T> {
  return new Promise<T>((resolve) => {
    resolve(typeof work === 'function' ? work() : work);
  });
}

/**
 * True when another action on the same row is running: a key under
 * `prefix` other than `ownKey`. Lets a row disable its sibling CTAs while
 * one of them spins, so two conflicting writes cannot race.
 */
export function otherKeyBusy(
  keys: ReadonlySet<string>,
  prefix: string,
  ownKey: string
): boolean {
  for (const key of keys) {
    if (key !== ownKey && key.startsWith(prefix)) return true;
  }
  return false;
}

/** Busy flag for a single CTA, e.g. a form's submit button. */
export function createBusyState(): BusyState {
  const pending = signal(0);
  return {
    busy: computed(() => pending() > 0),
    run<T>(work: Promise<T> | (() => Promise<T>)): Promise<T> {
      pending.update((count) => count + 1);
      return start(work).finally(() => pending.update((count) => count - 1));
    },
  };
}

/** One busy flag per key, e.g. per list row while that row's action runs. */
export function createKeyedBusyState<K>(): KeyedBusyState<K> {
  const pendingCounts = signal<ReadonlyMap<K, number>>(new Map());
  const busyKeys = computed(() => new Set(pendingCounts().keys()));
  const adjust = (key: K, delta: number): void => {
    pendingCounts.update((counts) => {
      const next = new Map(counts);
      const count = (next.get(key) ?? 0) + delta;
      if (count > 0) next.set(key, count);
      else next.delete(key);
      return next;
    });
  };
  return {
    busyKeys,
    busy: computed(() => busyKeys().size > 0),
    isBusy: (key) => busyKeys().has(key),
    run<T>(key: K, work: Promise<T> | (() => Promise<T>)): Promise<T> {
      adjust(key, 1);
      return start(work).finally(() => adjust(key, -1));
    },
  };
}
