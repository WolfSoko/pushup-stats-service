// The npm package's `exports` map only declares `esm2022` / `default`
// conditions (no `types` condition). Under `moduleResolution: bundler` TS
// will not fall back to the package-root `typings` field, so the imports
// resolve to a `.mjs` with no adjacent `.d.ts`. Expose a thin module shim
// for the public API surface we rely on.
declare module '@wolsok/thanos' {
  import type { Provider } from '@angular/core';
  import type { Observable } from 'rxjs';

  export interface AnimationState {
    readonly progress?: number;
    readonly running?: boolean;
    readonly [key: string]: unknown;
  }

  export interface WsThanosOptions {
    readonly animationLength: number;
    readonly maxParticleCount: number;
    readonly particleAcceleration: number;
  }

  export function provideWsThanosOptions(
    options?: Partial<WsThanosOptions>
  ): Provider;

  export class WsThanosService {
    vaporize(elem: HTMLElement): Observable<AnimationState>;
  }
}
