import { DestroyRef, inject, signal, type Signal } from '@angular/core';
import type { ConnectedPosition } from '@angular/cdk/overlay';

/**
 * Open/close state for the toolbar goal pill's detail dropdown. Must be
 * created from an injection context (the shell component's field
 * initialiser) so the close timer is cleared on destroy.
 *
 * The dropdown renders through a CDK overlay (body-level) instead of as a
 * toolbar descendant: `.top-nav` carries a `mask-image` edge-fade, and a
 * CSS mask clips descendant painting to the toolbar box, so an in-toolbar
 * panel below the bar would be masked away.
 */
export interface GoalPillOverlay {
  readonly open: Signal<boolean>;
  readonly positions: ConnectedPosition[];
  show(): void;
  hide(): void;
  /**
   * Close after a short grace period. Bridges the gap between the pill and
   * the detached panel so moving the pointer across it (or a focus bounce
   * between origin and overlay) doesn't flicker the menu closed.
   */
  scheduleHide(): void;
}

const CLOSE_GRACE_MS = 120;

export function createGoalPillOverlay(
  hasItems: () => boolean
): GoalPillOverlay {
  const open = signal(false);
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = (): void => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  };

  inject(DestroyRef).onDestroy(clearTimer);

  const show = (): void => {
    clearTimer();
    if (hasItems()) open.set(true);
  };

  const hide = (): void => {
    clearTimer();
    open.set(false);
  };

  return {
    open: open.asReadonly(),
    positions: [
      {
        originX: 'end',
        originY: 'bottom',
        overlayX: 'end',
        overlayY: 'top',
        offsetY: 6,
      },
      {
        originX: 'end',
        originY: 'top',
        overlayX: 'end',
        overlayY: 'bottom',
        offsetY: -6,
      },
    ],
    show,
    hide,
    scheduleHide: () => {
      clearTimer();
      closeTimer = setTimeout(() => open.set(false), CLOSE_GRACE_MS);
    },
  };
}
