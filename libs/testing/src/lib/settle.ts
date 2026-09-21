/**
 * Resolves on the next macrotask. `fixture.whenStable()` can resolve before
 * a `createBusyState().run()` chain has counted its promise down (the
 * `finally` sits several microtask ticks behind the resolved work), so
 * specs asserting the post-settle state await this first.
 */
export function nextMacrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}
