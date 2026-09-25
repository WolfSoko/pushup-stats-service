/** Whether the user asked the OS to minimise animation. False on the server. */
export function prefersReducedMotion(): boolean {
  return (
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
}
