import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appRouterFeatures } from './app.router-features';

@Component({ template: 'a' })
class RouteAComponent {}

@Component({ template: 'b' })
class RouteBComponent {}

describe('appRouterFeatures', () => {
  let originalStartViewTransition: Document['startViewTransition'] | undefined;

  beforeEach(() => {
    originalStartViewTransition = (document as Partial<Document>)
      .startViewTransition;
  });

  afterEach(() => {
    if (originalStartViewTransition) {
      document.startViewTransition = originalStartViewTransition;
    } else {
      delete (document as Partial<Document>).startViewTransition;
    }
  });

  it('should drive cross-route navigation through the View Transitions API while skipping the initial one', async () => {
    // given the View Transitions API stubbed (jsdom omits it) and the app's
    // router features applied to two routes
    const startViewTransition = vi.fn(
      (callback?: () => void | Promise<void>) => {
        void callback?.();
        return {
          finished: Promise.resolve(),
          ready: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
          skipTransition: () => undefined,
        } as unknown as ViewTransition;
      }
    );
    document.startViewTransition =
      startViewTransition as Document['startViewTransition'];

    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'a', component: RouteAComponent },
            { path: 'b', component: RouteBComponent },
          ],
          ...appRouterFeatures
        ),
      ],
    });
    const harness = await RouterTestingHarness.create();

    // when the router performs its first navigation
    await harness.navigateByUrl('/a');

    // then the initial transition is skipped (withViewTransitions
    // skipInitialTransition)
    expect(startViewTransition).not.toHaveBeenCalled();

    // when navigating to a different route
    await harness.navigateByUrl('/b');

    // then the View Transitions API drives the change
    expect(startViewTransition).toHaveBeenCalledTimes(1);
  });
});
