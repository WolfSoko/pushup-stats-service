import { isPlatformBrowser, NgComponentOutlet } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';

import type { MainNavItem } from './main-nav-items';
import {
  arcDrop,
  arcOffsets,
  arcOpacity,
  arcScale,
  centeredScrollLeft,
  DRAG_THRESHOLD_PX,
} from './arc-nav.geometry';

/**
 * The app's one navigation bar: a horizontal strip along the bottom edge,
 * shaped like a segment of a circle. Icons sit on the arc — the one in the
 * middle is the largest, the ones towards the edges shrink and sink — and
 * the strip swipes (touch), drags (mouse) and scrolls (wheel) sideways so
 * it can hold more entries than fit in one row. Navigating centres the
 * active entry.
 */
@Component({
  selector: 'app-arc-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, NgComponentOutlet, RouterLink],
  templateUrl: './arc-nav.component.html',
  styleUrl: './arc-nav.component.scss',
})
export class ArcNavComponent {
  readonly items = input.required<ReadonlyArray<MainNavItem>>();

  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  /** Signed distance of each item from the strip's centre, in item widths. */
  protected readonly offsets = signal<ReadonlyArray<number>>([]);

  protected readonly activeIndex = computed(() => {
    this.routeChange();
    return this.items().findIndex((item) =>
      this.router.isActive(item.path, {
        paths: item.exact ? 'exact' : 'subset',
        queryParams: 'ignored',
        fragment: 'ignored',
        matrixParams: 'ignored',
      })
    );
  });

  private readonly routeChange = signal(0);
  private frame: number | null = null;
  private drag: { startX: number; startLeft: number; moved: boolean } | null =
    null;

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.routeChange.update((n) => n + 1);
        this.centerActive('smooth');
      });

    // Also fires when the list itself changes (sign-in adds an entry), so
    // the centred item is the one that is actually active in the new list.
    afterRenderEffect(() => {
      this.items();
      untracked(() => this.centerActive('instant'));
    });

    afterNextRender(() => {
      const onResize = () => this.centerActive('instant');
      window.addEventListener('resize', onResize);
      // Capture phase: RouterLink's own click handler on the link must not
      // see a click that merely ends a drag.
      const onClick = (event: MouseEvent) => this.onClick(event);
      const track = this.track().nativeElement;
      track.addEventListener('click', onClick, { capture: true });
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('resize', onResize);
        track.removeEventListener('click', onClick, { capture: true });
      });
    });
  }

  protected transformFor(index: number): string {
    const d = this.offsets()[index] ?? 0;
    return `translateY(${arcDrop(d)}px) scale(${arcScale(d)})`;
  }

  protected opacityFor(index: number): number {
    return arcOpacity(this.offsets()[index] ?? 0);
  }

  protected onScroll(): void {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.measure();
    });
  }

  /** A vertical wheel moves the strip sideways — there is nothing else to scroll here. */
  protected onWheel(event: WheelEvent): void {
    const delta =
      Math.abs(event.deltaY) > Math.abs(event.deltaX)
        ? event.deltaY
        : event.deltaX;
    if (delta === 0) return;
    event.preventDefault();
    this.track().nativeElement.scrollLeft += delta;
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return;
    this.drag = {
      startX: event.clientX,
      startLeft: this.track().nativeElement.scrollLeft,
      moved: false,
    };
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.drag) return;
    const dx = event.clientX - this.drag.startX;
    if (Math.abs(dx) > DRAG_THRESHOLD_PX) this.drag.moved = true;
    this.track().nativeElement.scrollLeft = this.drag.startLeft - dx;
  }

  protected onPointerUp(): void {
    // Kept until the click that ends the drag has been swallowed.
    if (this.drag && !this.drag.moved) this.drag = null;
  }

  /** No click follows a pointer that left the strip, so nothing to swallow. */
  protected onPointerLeave(): void {
    this.drag = null;
  }

  private onClick(event: MouseEvent): void {
    const dragged = this.drag?.moved === true;
    this.drag = null;
    if (dragged) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  private measure(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const track = this.track().nativeElement;
    const links = Array.from(track.querySelectorAll<HTMLElement>('a'));
    this.offsets.set(arcOffsets(links, track));
  }

  private centerActive(behavior: ScrollBehavior): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const index = this.activeIndex();
    if (index < 0) return;
    const track = this.track().nativeElement;
    const link = track.querySelectorAll<HTMLElement>('a')[index];
    if (!link) return;
    const left = centeredScrollLeft(link, track);
    const reduceMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (typeof track.scrollTo === 'function') {
      track.scrollTo({ left, behavior: reduceMotion ? 'instant' : behavior });
    } else {
      track.scrollLeft = left;
    }
    this.measure();
  }
}
