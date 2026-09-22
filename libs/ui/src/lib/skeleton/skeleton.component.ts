import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  numberAttribute,
} from '@angular/core';

export type SkeletonShape = 'text' | 'title' | 'circle' | 'rect';

/**
 * Layout placeholder for content that is still loading. Renders one shimmer
 * bar per line in the space the loaded content will take, so the page keeps
 * its shape instead of flashing empty states or jumping. Hidden from
 * assistive tech: the loading region itself carries `aria-busy` and, where a
 * message matters, a live status text.
 */
@Component({
  selector: 'pu-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class]': '"pu-skeleton pu-skeleton--" + shape()',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
  },
  template: `
    @for (line of lineIndexes(); track line) {
      <span class="pu-skeleton__bar"></span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.5em;
      max-width: 100%;
    }
    :host(.pu-skeleton--text) {
      height: 1em;
    }
    :host(.pu-skeleton--title) {
      height: 1.6em;
    }
    :host(.pu-skeleton--circle) {
      width: 40px;
      height: 40px;
    }
    :host(.pu-skeleton--rect) {
      height: 96px;
    }
    :host(.pu-skeleton--multiline) {
      height: auto;
    }
    .pu-skeleton__bar {
      display: block;
      flex: 1 1 auto;
      width: 100%;
      min-height: 0.75em;
      border-radius: 6px;
      background-color: color-mix(
        in srgb,
        var(--mat-sys-on-surface, #fff) 12%,
        transparent
      );
      background-image: linear-gradient(
        90deg,
        transparent 0%,
        color-mix(in srgb, var(--mat-sys-on-surface, #fff) 10%, transparent) 50%,
        transparent 100%
      );
      background-size: 200% 100%;
      animation: pu-skeleton-shimmer 1.6s ease-in-out infinite;
    }
    :host(.pu-skeleton--multiline) .pu-skeleton__bar {
      flex: 0 0 auto;
      height: 0.9em;
    }
    :host(.pu-skeleton--multiline) .pu-skeleton__bar:last-child {
      width: 62%;
    }
    :host(.pu-skeleton--circle) .pu-skeleton__bar {
      border-radius: 50%;
    }
    :host(.pu-skeleton--rect) .pu-skeleton__bar {
      border-radius: 12px;
    }
    @keyframes pu-skeleton-shimmer {
      from {
        background-position: 200% 0;
      }
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .pu-skeleton__bar {
        animation: none;
      }
    }
  `,
})
export class SkeletonComponent {
  readonly shape = input<SkeletonShape>('text');
  /** Any CSS length; unset keeps the shape's default or fills the parent. */
  readonly width = input<string | null>(null);
  readonly height = input<string | null>(null);
  /** Stacked text bars; the last one is shorter, like a paragraph's end. */
  readonly lines = input(1, { transform: numberAttribute });

  protected readonly lineIndexes = computed(() =>
    Array.from({ length: Math.max(1, this.lines()) }, (_, index) => index)
  );
}
