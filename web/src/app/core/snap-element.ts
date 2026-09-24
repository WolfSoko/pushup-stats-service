import {
  createEnvironmentInjector,
  EnvironmentInjector,
  inject,
  runInInjectionContext,
} from '@angular/core';
import { DEFAULT_SNAP_QUALITY, SNAP_QUALITY_PARTICLES } from '@pu-stats/models';
import { finalize } from 'rxjs';

export interface SnapElementOptions {
  readonly injector: EnvironmentInjector;
  readonly durationMs: number;
  readonly name: string;
  readonly maxParticleCount?: number;
  /** Runs exactly once, on completion, on a vaporize error, or on a failed import. */
  readonly onDone: () => void;
}

/**
 * Vaporizes `el` with @wolsok/thanos and writes each frame's normalized
 * progress (0..1) to `--snap-progress` on it, so the element's SCSS can
 * fade its frame in lockstep with the particles.
 *
 * The package is imported lazily: it drags in html2canvas and is only
 * needed once someone actually snaps. A child environment injector carries
 * the per-call options because the root WsThanosService freezes its
 * options on first use.
 */
export async function snapElement(
  el: HTMLElement,
  options: SnapElementOptions
): Promise<void> {
  try {
    const { WsThanosService, WS_THANOS_OPTIONS_TOKEN, createWsThanosOptions } =
      await import('@wolsok/thanos');
    const childEnv = createEnvironmentInjector(
      [
        WsThanosService,
        {
          provide: WS_THANOS_OPTIONS_TOKEN,
          useValue: createWsThanosOptions({
            animationLength: options.durationMs,
            maxParticleCount:
              options.maxParticleCount ??
              SNAP_QUALITY_PARTICLES[DEFAULT_SNAP_QUALITY],
          }),
        },
      ],
      options.injector,
      options.name
    );
    runInInjectionContext(childEnv, () => {
      inject(WsThanosService)
        .vaporize(el)
        // html2canvas can throw on unsupported CSS (modern color()
        // functions), so completion and error share one teardown path.
        .pipe(
          finalize(() => {
            childEnv.destroy();
            options.onDone();
          })
        )
        .subscribe({
          // The last frame can report animationT slightly above 1.
          next: (state) => {
            const t = Math.min(1, Math.max(0, state.animationT));
            el.style.setProperty('--snap-progress', String(t));
          },
          error: () => undefined,
        });
    });
  } catch {
    options.onDone();
  }
}
