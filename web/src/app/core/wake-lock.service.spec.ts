import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { WakeLockService } from './wake-lock.service';

function fakeSentinel() {
  const listeners: Array<() => void> = [];
  return {
    release: vi.fn(async () => {
      for (const l of listeners) l();
    }),
    addEventListener: vi.fn((_type: string, cb: () => void) => {
      listeners.push(cb);
    }),
  };
}

describe('WakeLockService', () => {
  let request: ReturnType<typeof vi.fn>;
  let sentinel: ReturnType<typeof fakeSentinel>;

  function setup(platform: 'browser' | 'server' = 'browser'): WakeLockService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: platform }],
    });
    return TestBed.inject(WakeLockService);
  }

  beforeEach(() => {
    sentinel = fakeSentinel();
    request = vi.fn(async () => sentinel);
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request },
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: undefined,
      configurable: true,
    });
  });

  it('should request one screen lock for overlapping holders and release with the last', async () => {
    // given
    const service = setup();

    // when
    const releaseA = service.retain();
    const releaseB = service.retain();
    await Promise.resolve();

    // then
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('screen');

    // when
    releaseA();
    await Promise.resolve();

    // then
    expect(sentinel.release).not.toHaveBeenCalled();

    // when
    releaseB();
    releaseB();
    await Promise.resolve();

    // then
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it('should re-acquire the lock when the tab becomes visible again', async () => {
    // given
    const service = setup();
    service.retain();
    await Promise.resolve();
    await sentinel.release();

    // when
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();

    // then
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('should swallow a rejected request and unsupported browsers', async () => {
    // given
    request.mockRejectedValueOnce(new Error('NotAllowedError'));
    const service = setup();

    // when / then
    expect(() => service.retain()).not.toThrow();
    await Promise.resolve();

    // given
    Object.defineProperty(navigator, 'wakeLock', {
      value: undefined,
      configurable: true,
    });

    // when / then
    expect(() => service.retain()).not.toThrow();
  });

  it('should hold the lock exactly while the bound signal is true and drop it on destroy', async () => {
    // given
    const active = signal(false);
    @Component({ selector: 'app-host', template: '' })
    class HostComponent {
      constructor() {
        inject(WakeLockService).keepAwakeWhile(() => active());
      }
    }
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(request).not.toHaveBeenCalled();

    // when
    active.set(true);
    fixture.detectChanges();
    await Promise.resolve();

    // then
    expect(request).toHaveBeenCalledTimes(1);

    // when
    active.set(false);
    fixture.detectChanges();
    await Promise.resolve();

    // then
    expect(sentinel.release).toHaveBeenCalledTimes(1);

    // when
    active.set(true);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.destroy();
    await Promise.resolve();

    // then
    expect(sentinel.release).toHaveBeenCalledTimes(2);
  });

  it('should do nothing on the server', async () => {
    // given
    const service = setup('server');

    // when
    service.retain();
    await Promise.resolve();

    // then
    expect(request).not.toHaveBeenCalled();
  });
});
