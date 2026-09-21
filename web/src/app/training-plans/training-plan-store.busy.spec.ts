import { dayBusyKeys } from './training-plan-store.busy';

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
