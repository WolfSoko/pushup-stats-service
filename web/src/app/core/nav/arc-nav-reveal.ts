import { computed, signal } from '@angular/core';

/**
 * How long the strip stays on screen before it parks again: once at
 * startup, so the navigation is seen at least once on a fresh visit, and
 * again after every interaction that brought it back.
 */
export const AUTO_HIDE_DELAY_MS = 5000;

/**
 * How close to the bottom edge the mouse has to come before the parked
 * strip slides back in. Deliberately taller than the strip: the reveal
 * starts while the pointer is still approaching, so the strip is there by
 * the time the pointer arrives instead of chasing it.
 */
export const REVEAL_ZONE_PX = 110;

/**
 * A finger has no hover, so on touch the strip comes back on an upward
 * drag that starts at the very bottom edge. The band is narrow on purpose:
 * a drag that starts higher up belongs to the page, not to the nav.
 */
export const EDGE_SWIPE_ZONE_PX = 48;

/** Upward travel out of that band that counts as a pull rather than a tap. */
export const SWIPE_REVEAL_PX = 24;

/**
 * Whether the arc nav is parked below the bottom edge or on screen, and
 * everything that flips between the two: the startup grace period, the
 * mouse coming near the edge, and the upward pull from the edge that is
 * the touch equivalent of that hover.
 *
 * Kept out of the component because it is a self-contained state machine
 * over document-level events — the component only binds `revealed` to a
 * class and reports interactions with the strip itself.
 */
export class ArcNavReveal {
  /** The strip is on screen — either hovered, or held open by a timer. */
  readonly revealed = computed(() => this.pointerNearBottom() || this.held());

  private readonly pointerNearBottom = signal(false);
  private readonly held = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private swipeStartY: number | null = null;

  /** Brings the strip on screen and restarts the countdown that parks it. */
  hold(): void {
    this.held.set(true);
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.held.set(false);
    }, AUTO_HIDE_DELAY_MS);
  }

  /**
   * The same, but only for a strip that is already on screen: an ongoing
   * swipe of the strip must not be cut short mid-gesture, while a scroll of
   * the parked one — the router centres the active entry on every
   * navigation — must not pop it up.
   */
  keepOpen(): void {
    if (this.revealed()) this.hold();
  }

  /**
   * Starts the grace period and the document-level listeners that bring the
   * strip back. Browser only; returns the teardown.
   */
  start(): () => void {
    // Only a mouse: a touch pointermove would latch the strip open with
    // nothing to close it again.
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      this.pointerNearBottom.set(
        event.clientY >= window.innerHeight - REVEAL_ZONE_PX
      );
    };
    const onPointerLeave = () => this.pointerNearBottom.set(false);
    const onTouchStart = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      this.swipeStartY =
        y !== undefined && y >= window.innerHeight - EDGE_SWIPE_ZONE_PX
          ? y
          : null;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (this.swipeStartY === null) return;
      const y = event.touches[0]?.clientY;
      if (y === undefined || this.swipeStartY - y < SWIPE_REVEAL_PX) return;
      this.swipeStartY = null;
      this.hold();
    };
    const onTouchEnd = () => {
      this.swipeStartY = null;
    };

    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });
    this.hold();

    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
      if (this.timer !== null) clearTimeout(this.timer);
      this.timer = null;
    };
  }
}
