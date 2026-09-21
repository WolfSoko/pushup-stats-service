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

/**
 * Inline loading state for a CTA. While `puBusy` is true the host
 *
 * - carries `aria-busy="true"` and the `pu-busy` class (the stylesheet in
 *   `busy.scss` dims the label, hides a leading icon and swaps in a
 *   spinner that follows `currentColor`, so it works on filled buttons),
 * - shows a spinner element as its first child,
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
    inject(DestroyRef).onDestroy(() =>
      element.removeEventListener('click', guard, { capture: true })
    );

    effect(() => {
      if (this.busy()) this.showSpinner();
      else this.hideSpinner();
    });
  }

  private showSpinner(): void {
    if (this.spinner) return;
    const element = this.host.nativeElement;
    const spinner = this.renderer.createElement('span') as HTMLElement;
    this.renderer.addClass(spinner, BUSY_SPINNER_CLASS);
    this.renderer.setAttribute(spinner, 'aria-hidden', 'true');
    this.renderer.insertBefore(element, spinner, element.firstChild);
    this.spinner = spinner;
  }

  private hideSpinner(): void {
    if (!this.spinner) return;
    this.renderer.removeChild(this.host.nativeElement, this.spinner);
    this.spinner = null;
  }
}
