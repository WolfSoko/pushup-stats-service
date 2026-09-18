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

import { ArcNavReveal } from './arc-nav-reveal';
import type { MainNavItem } from './main-nav-items';
import {
  ARC_ORIGIN,
  arcOpacity,
  arcPositions,
  arcScale,
  centeredScrollLeft,
  DRAG_THRESHOLD_PX,
  nearestIndex,
  seedPositions,
  STRIP_MAX_PX,
  stripHalf,
  WHEEL_STEP_PX,
  wrapShift,
} from './arc-nav.geometry';
import type { ArcPosition } from './arc-nav.geometry';

/** A scroll that has been quiet this long has settled, so a jump interrupts nothing. */
const SETTLE_MS = 150;

/**
 * The app's one navigation bar: a horizontal strip along the bottom edge,
 * shaped like a segment of a circle. Icons sit on the arc — the one in the
 * middle is the largest, the ones towards the edges shrink and sink — and
 * the strip swipes (touch), drags (mouse) and scrolls (wheel) sideways so
 * it can hold more entries than fit in one row. Navigating centres the
 * active entry.
 *
 * The strip wraps: the entries are rendered three times, the middle copy
 * is the one assistive tech sees, and whenever the scroll position drifts
 * into an outer copy it jumps back by exactly one copy.
 *
 * It also parks below the bottom edge once it has been idle for a while,
 * leaving a sliver as the affordance — see arc-nav-reveal.ts for what
 * brings it back.
 */
@Component({
  selector: 'app-arc-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, NgComponentOutlet, RouterLink],
  templateUrl: './arc-nav.component.html',
  styleUrl: './arc-nav.component.scss',
  host: {
    '[class.revealed]': 'reveal.revealed()',
  },
})
export class ArcNavComponent {
  readonly items = input.required<ReadonlyArray<MainNavItem>>();

  /** Drives the slide-in; the stylesheet only animates what it reports. */
  protected readonly reveal = new ArcNavReveal();

  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  /** The entries three times over; index `count + i` is the real copy of item `i`. */
  protected readonly loop = computed(() => {
    const items = this.items();
    return [...items, ...items, ...items];
  });
  protected readonly count = computed(() => this.items().length);

  /** Where each rendered link sits on the arc, measured from the strip's centre. */
  protected readonly positions = computed(
    () =>
      this.measured() ??
      seedPositions(
        this.loop().length,
        this.count() + Math.max(0, this.activeIndex()),
        this.seedHalf()
      )
  );

  /** Mouse drag in progress: scroll snapping is off so the strip follows the pointer. */
  protected readonly dragging = signal(false);

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
  private readonly measured = signal<ReadonlyArray<ArcPosition> | null>(null);
  private frame: number | null = null;
  private settle: ReturnType<typeof setTimeout> | null = null;
  private wheelTravel = 0;
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
      const stopReveal = this.reveal.start();
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('resize', onResize);
        track.removeEventListener('click', onClick, { capture: true });
        stopReveal();
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        if (this.settle !== null) clearTimeout(this.settle);
      });
    });
  }

  /**
   * Drop and tilt come from the strip's own curve, the scale from the
   * distance in item widths — so an item travels along the arc and leans
   * with it while it grows towards the middle, rather than all three
   * being one and the same falloff.
   *
   * Read right to left, as the browser applies them: the item is sized,
   * then turned onto the tangent, then lowered onto the curve. It pivots
   * about `transform-origin: top center`, the point that rides the arc.
   */
  protected transformFor(index: number): string {
    const { d, drop, tilt } = this.positions()[index] ?? ARC_ORIGIN;
    return `translateY(${drop}px) rotate(${tilt}deg) scale(${arcScale(d)})`;
  }

  protected opacityFor(index: number): number {
    return arcOpacity((this.positions()[index] ?? ARC_ORIGIN).d);
  }

  /**
   * There is no layout to measure yet, but in the browser the strip's
   * width already follows from the viewport's — and drop and tilt are cut
   * from that width. On the server, where there is no viewport, the widest
   * strip is the only guess available. Measurement corrects either one on
   * the first render; this only has to keep that correction invisible.
   */
  private seedHalf(): number {
    return isPlatformBrowser(this.platformId)
      ? stripHalf(window.innerWidth)
      : STRIP_MAX_PX / 2;
  }

  /**
   * Wrapping writes scrollLeft, which would cut a smooth scroll or a touch
   * fling short — so it waits for the scroll to settle. Only a mouse drag
   * wraps at once: those writes are our own, nothing is in flight.
   */
  protected onScroll(): void {
    this.reveal.keepOpen();
    if (this.drag) this.wrap();
    if (this.frame === null) {
      this.frame = requestAnimationFrame(() => {
        this.frame = null;
        this.measure();
      });
    }
    if (this.settle !== null) clearTimeout(this.settle);
    this.settle = setTimeout(() => {
      this.settle = null;
      this.wrap();
      this.measure();
    }, SETTLE_MS);
  }

  /** Real copy or a clone — clones are decoration for the wrap, not targets. */
  protected isClone(index: number): boolean {
    const n = this.count();
    return index < n || index >= 2 * n;
  }

  /**
   * A vertical wheel moves the strip sideways, one item at a time — with
   * mandatory snapping, nudging scrollLeft by a few pixels would only snap
   * straight back.
   */
  protected onWheel(event: WheelEvent): void {
    this.reveal.hold();
    const delta =
      Math.abs(event.deltaY) > Math.abs(event.deltaX)
        ? event.deltaY
        : event.deltaX;
    if (delta === 0) return;
    event.preventDefault();
    if (Math.sign(delta) !== Math.sign(this.wheelTravel)) this.wheelTravel = 0;
    this.wheelTravel += delta;
    if (Math.abs(this.wheelTravel) < WHEEL_STEP_PX) return;
    const direction = Math.sign(this.wheelTravel);
    this.wheelTravel = 0;
    this.centerItem(nearestIndex(this.positions()) + direction, 'smooth');
  }

  protected onPointerDown(event: PointerEvent): void {
    // Before the mouse-only guard: a finger landing on the strip is what
    // keeps it from parking away under that finger.
    this.reveal.hold();
    if (event.pointerType !== 'mouse') return;
    this.drag = {
      startX: event.clientX,
      startLeft: this.track().nativeElement.scrollLeft,
      moved: false,
    };
    this.dragging.set(true);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.drag) return;
    const dx = event.clientX - this.drag.startX;
    if (Math.abs(dx) > DRAG_THRESHOLD_PX) this.drag.moved = true;
    this.track().nativeElement.scrollLeft = this.drag.startLeft - dx;
  }

  protected onPointerUp(): void {
    this.dragging.set(false);
    // Kept until the click that ends the drag has been swallowed.
    if (this.drag && !this.drag.moved) this.drag = null;
  }

  /** No click follows a pointer that left the strip, so nothing to swallow. */
  protected onPointerLeave(): void {
    this.dragging.set(false);
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
    this.measured.set(arcPositions(links, track));
  }

  private wrap(): void {
    const track = this.track().nativeElement;
    const links = track.querySelectorAll<HTMLElement>('a');
    const first = links[0];
    const middle = links[this.count()];
    if (!first || !middle) return;
    const shift = wrapShift(
      track.scrollLeft,
      middle.offsetLeft - first.offsetLeft,
      first.offsetWidth
    );
    if (shift === 0) return;
    track.scrollLeft += shift;
    if (this.drag) this.drag.startLeft += shift;
  }

  /** With no active entry (landing, login) the first one takes the middle. */
  private centerActive(behavior: ScrollBehavior): void {
    const index = Math.max(0, this.activeIndex());
    this.centerItem(this.count() + index, behavior);
  }

  private centerItem(index: number, behavior: ScrollBehavior): void {
    if (!isPlatformBrowser(this.platformId)) return;
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
