import {
  withInMemoryScrolling,
  withViewTransitions,
  type RouterFeatures,
} from '@angular/router';
import { prefersReducedMotion } from './core/reduced-motion';

export function createAppRouterFeatures(): RouterFeatures[] {
  return [
    withInMemoryScrolling({
      anchorScrolling: 'enabled',
      scrollPositionRestoration: 'enabled',
    }),
    // The first navigation only re-renders the already SSR-painted route, so a
    // transition there is a no-op flicker — skip it.
    withViewTransitions({
      skipInitialTransition: true,
      onViewTransitionCreated: ({ transition }) => {
        // Honour the OS-level reduced-motion preference: finish the DOM swap
        // instantly instead of cross-fading.
        if (prefersReducedMotion()) transition.skipTransition();
      },
    }),
  ];
}
