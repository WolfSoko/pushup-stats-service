import { TestBed } from '@angular/core/testing';
import { signalStore, withMethods } from '@ngrx/signals';
import { dayBusyKeys, withPlanBusy } from './training-plan-store.busy';

describe('dayBusyKeys', () => {
  it('should hand a day only its own per-exercise keys, day index stripped', () => {
    // given — writes on two days plus a whole-day action
    const keys = new Set([
      'item:2:0',
      'record:2:1',
      'clear:3:1',
      'day:2',
      'abandon',
    ]);

    // when
    const day2 = dayBusyKeys(keys, 2);
    const day3 = dayBusyKeys(keys, 3);

    // then
    expect([...day2].sort()).toEqual(['item:0', 'record:1']);
    expect([...day3]).toEqual(['clear:1']);
    expect(dayBusyKeys(keys, 4).size).toBe(0);
  });
});

describe('withPlanBusy', () => {
  const Store = signalStore(
    { providedIn: 'root' },
    withPlanBusy(),
    withMethods((store) => ({
      start: (key: string, work: Promise<void>) => store._busy.run(key, work),
    }))
  );

  it('should hand a day the same key set back until its keys change', async () => {
    // given
    const store = TestBed.inject(Store);
    const idle = store.dayBusyKeys(2);
    let finish!: () => void;

    // then — nothing busy: one shared empty set, stable across calls
    expect(idle.size).toBe(0);
    expect(store.dayBusyKeys(2)).toBe(idle);
    expect(store.dayBusyKeys(5)).toBe(idle);

    // when
    const run = store.start(
      'item:2:0',
      new Promise<void>((resolve) => (finish = resolve))
    );
    const busy = store.dayBusyKeys(2);

    // then
    expect([...busy]).toEqual(['item:0']);
    expect(store.dayBusyKeys(2)).toBe(busy);
    expect(store.dayBusyKeys(3)).toBe(idle);

    // when
    finish();
    await run;

    // then
    expect(store.dayBusyKeys(2)).toBe(idle);
  });
});
