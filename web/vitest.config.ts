import { defineConfig } from 'vitest/config';

// Lift default 5s timeout — Angular + Firebase + Material component tests
// can exceed that during cold-start render on Nx Cloud runners, which was
// flaking `web:test` after the Angular 21.2.9 bump.
export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
