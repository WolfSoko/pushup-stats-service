import { TestBed } from '@angular/core/testing';

import { CheerStore } from './cheer.store';
import { FriendsApiService } from './friends-api.service';

describe('CheerStore', () => {
  function setup(cheer = vitest.fn().mockResolvedValue({ ok: true })) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: FriendsApiService, useValue: { cheer } }],
    });
    return { store: TestBed.inject(CheerStore), cheer };
  }

  afterEach(() => vitest.useRealTimers());

  it('should remember a cheer that went through', async () => {
    // given
    const { store, cheer } = setup();

    // when
    const ok = await store.cheer('b');

    // then
    expect(ok).toBe(true);
    expect(cheer).toHaveBeenCalledWith('b');
    expect(store.hasCheered('b')).toBe(true);
    expect(store.hasCheered('c')).toBe(false);
  });

  it('should spin only the flame whose cheer is away', async () => {
    // given
    let answer: (value: { ok: boolean }) => void = () => undefined;
    const { store } = setup(
      vitest.fn(
        () =>
          new Promise<{ ok: boolean }>((resolve) => {
            answer = resolve;
          })
      )
    );

    // when
    const done = store.cheer('b');

    // then
    expect(store.isCheering('b')).toBe(true);
    expect(store.isCheering('c')).toBe(false);
    answer({ ok: true });
    await done;
    expect(store.isCheering('b')).toBe(false);
  });

  it('should light the flame when another device already cheered today', async () => {
    // given
    const { store } = setup(
      vitest.fn().mockResolvedValue({ ok: false, reason: 'already' })
    );

    // when
    const ok = await store.cheer('b');

    // then
    expect(ok).toBe(false);
    expect(store.lastRejection()).toBe('already');
    expect(store.hasCheered('b')).toBe(true);
  });

  it('should keep the reason and the flame unlit when a cheer is refused', async () => {
    // given
    const { store } = setup(
      vitest.fn().mockResolvedValue({ ok: false, reason: 'not-friends' })
    );

    // when
    await store.cheer('b');

    // then
    expect(store.lastRejection()).toBe('not-friends');
    expect(store.hasCheered('b')).toBe(false);
  });

  it('should report a thrown call as failed', async () => {
    // given
    const { store } = setup(vitest.fn().mockRejectedValue(new Error('down')));

    // when
    const ok = await store.cheer('b');

    // then
    expect(ok).toBe(false);
    expect(store.lastRejection()).toBe('failed');
  });

  it('should forget yesterday’s cheers', () => {
    // given — cheered just before midnight Berlin time
    vitest.useFakeTimers({ toFake: ['Date'] });
    vitest.setSystemTime(new Date('2026-09-23T21:50:00Z'));
    const { store } = setup();
    store.markCheered('b');
    expect(store.hasCheered('b')).toBe(true);

    // when
    vitest.setSystemTime(new Date('2026-09-23T22:10:00Z'));

    // then
    expect(store.hasCheered('b')).toBe(false);
  });
});
