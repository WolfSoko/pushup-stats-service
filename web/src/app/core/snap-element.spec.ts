import { EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DEFAULT_SNAP_QUALITY, SNAP_QUALITY_PARTICLES } from '@pu-stats/models';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  vaporizeSpy: vi.fn<(el: HTMLElement) => unknown>(),
  capturedOptions: { last: null as Record<string, unknown> | null },
}));

// The real package has unresolved extensionless imports under Node ESM.
vi.mock('@wolsok/thanos', async () => {
  const { InjectionToken } = await import('@angular/core');
  class WsThanosService {
    vaporize(el: HTMLElement): unknown {
      return mocks.vaporizeSpy(el);
    }
  }
  return {
    WsThanosService,
    WS_THANOS_OPTIONS_TOKEN: new InjectionToken('WS_THANOS_OPTIONS_TOKEN'),
    createWsThanosOptions: (opts?: Record<string, unknown>) => {
      mocks.capturedOptions.last = { ...opts };
      return mocks.capturedOptions.last;
    },
  };
});

import { snapElement } from './snap-element';

describe('snapElement', () => {
  let frames$: Subject<{ animationT: number }>;
  let el: HTMLElement;
  let onDone: ReturnType<typeof vi.fn<() => void>>;

  async function snap(maxParticleCount?: number): Promise<void> {
    await snapElement(el, {
      injector: TestBed.inject(EnvironmentInjector),
      durationMs: 1234,
      name: 'test-snap',
      maxParticleCount,
      onDone,
    });
  }

  beforeEach(() => {
    frames$ = new Subject();
    el = document.createElement('div');
    onDone = vi.fn<() => void>();
    mocks.capturedOptions.last = null;
    mocks.vaporizeSpy.mockReset();
    mocks.vaporizeSpy.mockImplementation(() => frames$.asObservable());
  });

  it('should write the clamped frame progress to --snap-progress', async () => {
    // given
    await snap();

    // when
    frames$.next({ animationT: 0.5 });

    // then
    expect(el.style.getPropertyValue('--snap-progress')).toBe('0.5');

    // when — the last frame can overshoot 1
    frames$.next({ animationT: 1.07 });

    // then
    expect(el.style.getPropertyValue('--snap-progress')).toBe('1');
  });

  it('should call onDone once when the animation completes', async () => {
    // given
    await snap();
    expect(onDone).not.toHaveBeenCalled();

    // when
    frames$.complete();

    // then
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('should call onDone when the vaporize errors', async () => {
    // given
    await snap();

    // when
    frames$.error(new Error('html2canvas'));

    // then
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('should call onDone when vaporize throws synchronously', async () => {
    // given
    mocks.vaporizeSpy.mockImplementation(() => {
      throw new Error('boom');
    });

    // when
    await snap();

    // then
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('should pass duration and the default particle count to the options', async () => {
    // when
    await snap();

    // then
    expect(mocks.capturedOptions.last).toEqual({
      animationLength: 1234,
      maxParticleCount: SNAP_QUALITY_PARTICLES[DEFAULT_SNAP_QUALITY],
    });
  });

  it('should prefer an explicit particle count', async () => {
    // when
    await snap(99);

    // then
    expect(mocks.capturedOptions.last).toEqual(
      expect.objectContaining({ maxParticleCount: 99 })
    );
  });
});
