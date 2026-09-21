import {
  Directive,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  Renderer2,
} from '@angular/core';

export const BUSY_CLASS = 'pu-busy';
export const BUSY_SPINNER_CLASS = 'pu-busy-spinner';
/** A spinner that appeared stays at least this long, so a fast action
 *  reads as a deliberate blink instead of a flicker. */
export const BUSY_MIN_VISIBLE_MS = 400;

/**
 * Inline loading state for a CTA. While `puBusy` is true the host
 *
 * - carries `aria-busy="true"` and the `pu-busy` class (the stylesheet in
 *   `busy.scss` dims the label, hides a leading icon and swaps in a
 *   spinner that follows `currentColor`, so it works on filled buttons),
 * - shows a spinner element as its first child, for at least
 *   {@link BUSY_MIN_VISIBLE_MS} once it appeared,
 * - swallows further clicks and keyboard activations, so a double tap
 *   cannot fire the action twice.
 *
 * The host stays enabled on purpose: a disabled Material button turns grey
 * and reads as "not allowed", whereas a busy one is doing exactly what the
 * user asked for.
 */
@Directive({
  selector: '[puBusy]',
  host: {
    '[attr.aria-busy]': 'busy() ? "true" : null',
    '[class.pu-busy]': 'busy()',
  },
})
export class BusyDirective {
  readonly busy = input.required<boolean>({ alias: 'puBusy' });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private spinner: HTMLElement | null = null;
  private shownAt = 0;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Capture phase, so the guard runs before the host's own (click)
    // handler and before any listener registered later than this one.
    const element = this.host.nativeElement;
    const guard = (event: Event): void => {
      if (!this.busy()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    element.addEventListener('click', guard, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      element.removeEventListener('click', guard, { capture: true });
      clearTimeout(this.hideTimer);
    });

    effect(() => {
      if (this.busy()) this.showSpinner();
      else this.hideSpinner();
    });
  }

  private showSpinner(): void {
    clearTimeout(this.hideTimer);
    this.hideTimer = undefined;
    if (this.spinner) return;
    this.shownAt = Date.now();
    const element = this.host.nativeElement;
    const spinner = this.renderer.createElement('span') as HTMLElement;
    this.renderer.addClass(spinner, BUSY_SPINNER_CLASS);
    this.renderer.setAttribute(spinner, 'aria-hidden', 'true');
    this.renderer.insertBefore(element, spinner, element.firstChild);
    this.spinner = spinner;
  }

  private hideSpinner(): void {
    if (!this.spinner || this.hideTimer !== undefined) return;
    const remaining = BUSY_MIN_VISIBLE_MS - (Date.now() - this.shownAt);
    if (remaining > 0) {
      this.hideTimer = setTimeout(() => {
        this.hideTimer = undefined;
        this.removeSpinner();
      }, remaining);
      return;
    }
    this.removeSpinner();
  }

  private removeSpinner(): void {
    if (!this.spinner) return;
    this.renderer.removeChild(this.host.nativeElement, this.spinner);
    this.spinner = null;
  }
}
