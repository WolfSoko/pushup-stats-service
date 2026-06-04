import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAppRouterFeatures } from './app.router-features';

@Component({ template: 'a', standalone: true })
class RouteAComponent {}

@Component({ template: 'b', standalone: true })
class RouteBComponent {}

describe('createAppRouterFeatures', () => {
  let originalStartViewTransition: Document['startViewTransition'] | undefined;
  let originalMatchMedia: typeof globalThis.matchMedia | undefined;
  let startViewTransition: ReturnType<typeof vi.fn>;
  let skipTransition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalStartViewTransition = (document as Partial<Document>)
      .startViewTransition;
    originalMatchMedia = (globalThis as Partial<typeof globalThis>).matchMedia;

    // jsdom omits the View Transitions API; stub it so the router feature runs.
    skipTransition = vi.fn();
    startViewTransition = vi.fn((callback?: () => void | Promise<void>) => {
      void callback?.();
      return {
        finished: Promise.resolve(),
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        skipTransition,
      } as unknown as ViewTransition;
    });
    document.startViewTransition =
      startViewTransition as Document['startViewTransition'];
  });

  afterEach(() => {
    if (originalStartViewTransition) {
      document.startViewTransition = originalStartViewTransition;
    } else {
      delete (document as Partial<Document>).startViewTransition;
    }
    if (originalMatchMedia) {
      globalThis.matchMedia = originalMatchMedia;
    } else {
      delete (globalThis as Partial<typeof globalThis>).matchMedia;
    }
  });

  const stubReducedMotion = (matches: boolean): void => {
    globalThis.matchMedia = ((query: string) =>
      ({
        matches,
        media: query,
      }) as unknown as MediaQueryList) as typeof globalThis.matchMedia;
  };

  const createHarness = async (): Promise<RouterTestingHarness> => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'a', component: RouteAComponent },
            { path: 'b', component: RouteBComponent },
          ],
          ...createAppRouterFeatures()
        ),
      ],
    });
    return RouterTestingHarness.create();
  };

  it('should drive cross-route navigation through the View Transitions API while skipping the initial one', async () => {
    // given motion is allowed and the app's router features on two routes
    stubReducedMotion(false);
    const harness = await createHarness();

    // when the router performs its first navigation
    await harness.navigateByUrl('/a');

    // then the initial transition is skipped (skipInitialTransition)
    expect(startViewTransition).not.toHaveBeenCalled();

    // when navigating to a different route
    await harness.navigateByUrl('/b');

    // then the View Transitions API drives the change and the animation runs
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(skipTransition).not.toHaveBeenCalled();
  });

  it('should skip the transition animation when the user prefers reduced motion', async () => {
    // given the user prefers reduced motion
    stubReducedMotion(true);
    const harness = await createHarness();

    // when navigating across routes (the first navigation is the skipped one)
    await harness.navigateByUrl('/a');
    await harness.navigateByUrl('/b');

    // then the created transition still starts but its animation is skipped
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(skipTransition).toHaveBeenCalledTimes(1);
  });
});
