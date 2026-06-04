import {
  withInMemoryScrolling,
  withViewTransitions,
  type RouterFeatures,
} from '@angular/router';

export const appRouterFeatures: RouterFeatures[] = [
  withInMemoryScrolling({
    anchorScrolling: 'enabled',
    scrollPositionRestoration: 'enabled',
  }),
  // The first navigation only re-renders the already SSR-painted route, so a
  // transition there is a no-op flicker — skip it.
  withViewTransitions({ skipInitialTransition: true }),
];
