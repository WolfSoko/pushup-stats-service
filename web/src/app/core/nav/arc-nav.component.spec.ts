import { Component, PLATFORM_ID } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';

import { AUTO_HIDE_DELAY_MS } from './arc-nav-reveal';
import { ArcNavComponent } from './arc-nav.component';
import { STRIP_MAX_PX } from './arc-nav.geometry';
import type { MainNavItem } from './main-nav-items';

@Component({ template: '' })
class BlankComponent {}

@Component({ template: '<span data-testid="badge-stub">3</span>' })
class BadgeStubComponent {}

/** jsdom has no PointerEvent; a MouseEvent with the one field the nav reads does. */
function pointer(
  type: string,
  clientX: number,
  pointerType = 'mouse'
): MouseEvent {
  const event = new MouseEvent(type, { clientX, bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  return event;
}

/**
 * Same story for TouchEvent: a plain Event carrying the `changedTouches`
 * list the nav reads — the contacts this event changed, identified so a
 * second finger elsewhere cannot be mistaken for this one.
 */
function touch(type: string, clientY: number, identifier = 1): Event {
  return multiTouch(type, [{ identifier, clientY }]);
}

/** The same, for an event that changes more than one contact at once. */
function multiTouch(
  type: string,
  points: ReadonlyArray<{ identifier: number; clientY: number }>
): Event {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'changedTouches', {
    value: {
      length: points.length,
      item: (index: number) => points[index] ?? null,
    },
  });
  return event;
}

/** The same stand-in, for the document-level reveal listener. */
function verticalPointer(clientY: number, pointerType = 'mouse'): MouseEvent {
  const event = new MouseEvent('pointermove', { clientY, bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  return event;
}

describe('ArcNavComponent', () => {
  const items: MainNavItem[] = [
    { path: '/app', icon: 'dashboard', label: 'Dashboard', exact: true },
    { path: '/analysis', icon: 'insights', label: 'Analyse' },
    { path: '/blog', icon: 'article', label: 'Blog' },
  ];

  async function renderNav(startUrl = '/app') {
    const scrollTo = vitest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: scrollTo,
    });
    const { fixture } = await render(ArcNavComponent, {
      inputs: { items },
      providers: [
        provideRouter([
          { path: 'app', component: BlankComponent },
          { path: 'analysis', component: BlankComponent },
          { path: 'blog', component: BlankComponent },
          { path: 'blog/:slug', component: BlankComponent },
        ]),
      ],
    });
    const router = fixture.debugElement.injector.get(Router);
    await router.navigateByUrl(startUrl);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, router, scrollTo };
  }

  /**
   * Runs out the grace period that keeps the strip on screen after startup,
   * leaving it parked — the state the reveal tests start from.
   */
  async function park(fixture: ComponentFixture<ArcNavComponent>) {
    vitest.advanceTimersByTime(AUTO_HIDE_DELAY_MS);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    vitest.useRealTimers();
    delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
  });

  it('should render one link per entry, in order', async () => {
    // given
    await renderNav();

    // then — the copies that make the strip wrap stay out of the tab order
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/app',
      '/analysis',
      '/blog',
    ]);
    expect(links[0].textContent).toContain('Dashboard');
  });

  it('should wrap around: the last entries sit before the first', async () => {
    // given
    await renderNav();

    // then — three copies, clones hidden from assistive tech
    const all = Array.from(
      screen.getByTestId('arc-nav').querySelectorAll<HTMLElement>('a')
    );
    expect(all.map((a) => a.getAttribute('href'))).toEqual([
      '/app',
      '/analysis',
      '/blog',
      '/app',
      '/analysis',
      '/blog',
      '/app',
      '/analysis',
      '/blog',
    ]);
    expect(all.map((a) => a.getAttribute('aria-hidden'))).toEqual([
      'true',
      'true',
      'true',
      null,
      null,
      null,
      'true',
      'true',
      'true',
    ]);
    expect(all[2].getAttribute('tabindex')).toBe('-1');
    expect(all[3].getAttribute('tabindex')).toBeNull();
  });

  it('should highlight every copy of the active entry but mark only the real one', async () => {
    // given
    await renderNav('/blog');

    // then
    const all = Array.from(
      screen.getByTestId('arc-nav').querySelectorAll<HTMLElement>('a')
    );
    expect(all.filter((a) => a.classList.contains('active')).length).toBe(3);
    expect(
      all.filter((a) => a.getAttribute('aria-current') === 'page')
    ).toEqual([all[5]]);
  });

  it('should mark the current route and centre it', async () => {
    // given
    const { scrollTo } = await renderNav('/analysis');

    // then
    const active = screen.getByRole('link', { current: 'page' });
    expect(active.getAttribute('href')).toBe('/analysis');
    expect(scrollTo).toHaveBeenCalled();
  });

  it('should still settle in the middle copy when no entry is active', async () => {
    // given — a route none of the entries covers
    const { scrollTo } = await renderNav('/');

    // then — scrolled once, to the first entry of the real copy, and no
    // link at all (clones included) claims to be the current page
    const all = screen.getByTestId('arc-nav').querySelectorAll('a');
    expect(
      Array.from(all).filter((a) => a.hasAttribute('aria-current'))
    ).toEqual([]);
    expect(scrollTo).toHaveBeenCalled();
  });

  describe('with a measured layout', () => {
    // jsdom lays nothing out; model 88px items behind 151px of padding in a
    // 390px strip, the numbers a phone would report.
    const ITEM = 88;
    const PAD = 151;
    let offsetLeft: PropertyDescriptor | undefined;
    let offsetWidth: PropertyDescriptor | undefined;
    let clientWidth: PropertyDescriptor | undefined;

    beforeEach(() => {
      offsetLeft = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'offsetLeft'
      );
      offsetWidth = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'offsetWidth'
      );
      Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
        configurable: true,
        get(this: HTMLElement) {
          const siblings = Array.from(this.parentElement?.children ?? []);
          return PAD + siblings.indexOf(this) * ITEM;
        },
      });
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get: () => ITEM,
      });
      clientWidth = Object.getOwnPropertyDescriptor(
        Element.prototype,
        'clientWidth'
      );
      Object.defineProperty(Element.prototype, 'clientWidth', {
        configurable: true,
        get: () => 390,
      });
    });

    afterEach(() => {
      if (offsetLeft)
        Object.defineProperty(HTMLElement.prototype, 'offsetLeft', offsetLeft);
      if (offsetWidth)
        Object.defineProperty(
          HTMLElement.prototype,
          'offsetWidth',
          offsetWidth
        );
      if (clientWidth)
        Object.defineProperty(Element.prototype, 'clientWidth', clientWidth);
    });

    async function renderMeasured(startUrl: string) {
      const rendered = await renderNav(startUrl);
      const track = screen
        .getByTestId('arc-nav')
        .querySelector<HTMLElement>('.track');
      if (!track) throw new Error('track missing');
      return { ...rendered, track };
    }

    it('should centre the real copy of the active entry, not a clone', async () => {
      // given — three entries: the real "Blog" is rendered fifth
      const { scrollTo } = await renderMeasured('/blog');

      // then — scrollLeft = renderedIndex * item width
      expect(scrollTo).toHaveBeenLastCalledWith(
        expect.objectContaining({ left: 5 * ITEM })
      );
    });

    it('should jump back by a copy once a scroll settles in a clone', async () => {
      // given — resting on the last clone before the real copy
      const { track } = await renderMeasured('/app');
      track.scrollLeft = 2 * ITEM;

      // when
      track.dispatchEvent(new Event('scroll'));

      // then — one copy (three items) further right, same picture
      await vitest.waitFor(() => expect(track.scrollLeft).toBe(5 * ITEM));
    });

    it('should leave a scroll alone that settles in the real copy', async () => {
      // given
      const { track } = await renderMeasured('/app');
      track.scrollLeft = 4 * ITEM;

      // when
      track.dispatchEvent(new Event('scroll'));
      await new Promise((resolve) => setTimeout(resolve, 250));

      // then
      expect(track.scrollLeft).toBe(4 * ITEM);
    });

    it('should carry a mouse drag across the jump without a leap', async () => {
      // given — dragging leftwards from the real first entry
      const { track } = await renderMeasured('/app');
      track.scrollLeft = 3 * ITEM;
      track.dispatchEvent(pointer('pointerdown', 300));

      // when — far enough to rest on a clone, then a little further
      track.dispatchEvent(pointer('pointermove', 300 + 2 * ITEM));
      track.dispatchEvent(new Event('scroll'));
      track.dispatchEvent(pointer('pointermove', 300 + 2 * ITEM + 10));

      // then — the strip continues from where the jump put it
      expect(track.scrollLeft).toBe(4 * ITEM - 10);
    });
  });

  it('should treat a nested route as its section', async () => {
    // given — an article belongs to the blog entry
    await renderNav('/blog/some-article');

    // then
    expect(
      screen.getByRole('link', { current: 'page' }).getAttribute('href')
    ).toBe('/blog');
  });

  it('should re-centre when the route changes', async () => {
    // given
    const { router, fixture, scrollTo } = await renderNav('/app');
    scrollTo.mockClear();

    // when
    await router.navigateByUrl('/blog');
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(scrollTo).toHaveBeenCalled();
    expect(
      screen.getByRole('link', { current: 'page' }).getAttribute('href')
    ).toBe('/blog');
  });

  it('should swallow the click that ends a mouse drag', async () => {
    // given
    const { router } = await renderNav('/app');
    const track = screen.getByTestId('arc-nav').querySelector('.track');
    if (!track) throw new Error('track missing');
    const navigate = vitest.spyOn(router, 'navigateByUrl');

    // when — press, move well past the threshold, release on a link
    track.dispatchEvent(pointer('pointerdown', 100));
    track.dispatchEvent(pointer('pointermove', 40));
    track.dispatchEvent(pointer('pointerup', 40));
    screen.getByRole('link', { name: /Blog/ }).click();

    // then
    expect(navigate).not.toHaveBeenCalled();
  });

  it('should not swallow the next click after a drag that ends outside the strip', async () => {
    // given — a drag leaves the strip; the release never reaches it
    const { router, fixture } = await renderNav('/app');
    const track = screen.getByTestId('arc-nav').querySelector('.track');
    if (!track) throw new Error('track missing');
    track.dispatchEvent(pointer('pointerdown', 100));
    track.dispatchEvent(pointer('pointermove', 40));
    track.dispatchEvent(pointer('pointerleave', 40));

    // when — a later, ordinary click
    screen.getByRole('link', { name: /Blog/ }).click();
    await fixture.whenStable();

    // then
    expect(router.url).toBe('/blog');
  });

  it("should render an entry's badge on its icon", async () => {
    // given
    const scrollTo = vitest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: scrollTo,
    });
    await render(ArcNavComponent, {
      inputs: {
        items: [{ ...items[0], badge: BadgeStubComponent }, items[1]],
      },
      providers: [provideRouter([])],
    });

    // then — once per copy, so the badge shows wherever the entry is seen
    expect(screen.getAllByTestId('badge-stub')).toHaveLength(3);
    expect(
      screen
        .getByRole('link', { name: /Dashboard/ })
        .querySelector('.badge-slot')
    ).toBeTruthy();
  });

  it('should shape the strip around the active item before anything is measured', async () => {
    // given — a server render: no layout to measure, no scrolling
    const scrollTo = vitest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: scrollTo,
    });
    await render(ArcNavComponent, {
      inputs: { items },
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });

    // then — first item in the middle, the others shrinking away from it
    const links = screen.getAllByRole('link');
    expect(links[0].style.transform).toBe(
      'translateY(0px) rotate(0deg) scale(1.3)'
    );
    expect(links[2].style.transform).toBe(
      'translateY(3.18px) rotate(2.21deg) scale(0.9)'
    );
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('should move on by one item per wheel step', async () => {
    // given
    const { scrollTo } = await renderNav('/app');
    const track = screen.getByTestId('arc-nav').querySelector('.track');
    if (!track) throw new Error('track missing');
    scrollTo.mockClear();

    // when — small nudges add up to one step
    track.dispatchEvent(new WheelEvent('wheel', { deltaY: 25, bubbles: true }));
    expect(scrollTo).not.toHaveBeenCalled();
    track.dispatchEvent(new WheelEvent('wheel', { deltaY: 25, bubbles: true }));

    // then
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('should switch snapping off while the mouse drags', async () => {
    // given
    const { fixture } = await renderNav('/app');
    const track = screen.getByTestId('arc-nav').querySelector('.track');
    if (!track) throw new Error('track missing');

    // when / then
    track.dispatchEvent(pointer('pointerdown', 100));
    fixture.detectChanges();
    expect(track.classList.contains('dragging')).toBe(true);
    track.dispatchEvent(pointer('pointerup', 100));
    fixture.detectChanges();
    expect(track.classList.contains('dragging')).toBe(false);
  });

  it('should let go of its listeners and pending frame on destroy', async () => {
    // given — a scroll has a measurement frame pending
    const { fixture, scrollTo } = await renderNav('/app');
    const track = screen.getByTestId('arc-nav').querySelector('.track');
    if (!track) throw new Error('track missing');
    const cancel = vitest.spyOn(window, 'cancelAnimationFrame');
    track.dispatchEvent(new Event('scroll'));
    scrollTo.mockClear();

    // when
    fixture.destroy();
    window.dispatchEvent(new Event('resize'));

    // then
    expect(cancel).toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('should still navigate on a plain click', async () => {
    // given
    const { router, fixture } = await renderNav('/app');

    // when
    screen.getByRole('link', { name: /Blog/ }).click();
    await fixture.whenStable();

    // then
    expect(router.url).toBe('/blog');
  });

  it('should slide the parked strip back in while the mouse is near the bottom edge', async () => {
    // given the nav on a viewport whose bottom edge is at `innerHeight`,
    // parked after the startup grace period
    vitest.useFakeTimers({ shouldAdvanceTime: true });
    const { fixture } = await renderNav();
    // The strip's parent is the component host, which carries the class.
    const host = screen.getByTestId('arc-nav').parentElement;
    await park(fixture);

    // when the mouse comes within the reveal zone
    document.dispatchEvent(verticalPointer(window.innerHeight - 20));
    fixture.detectChanges();

    // then the strip is called back in
    expect(host?.classList.contains('revealed')).toBe(true);

    // and when the mouse leaves that zone again
    document.dispatchEvent(verticalPointer(10));
    fixture.detectChanges();

    // then it parks
    expect(host?.classList.contains('revealed')).toBe(false);
  });

  it('should ignore a touch pointer near the bottom edge', async () => {
    // given the parked nav
    vitest.useFakeTimers({ shouldAdvanceTime: true });
    const { fixture } = await renderNav();
    // The strip's parent is the component host, which carries the class.
    const host = screen.getByTestId('arc-nav').parentElement;
    await park(fixture);

    // when a finger merely passes along the bottom edge — hover is a mouse
    // idea, and a resting finger would latch the strip open for good
    document.dispatchEvent(verticalPointer(window.innerHeight - 20, 'touch'));
    fixture.detectChanges();

    // then nothing latches
    expect(host?.classList.contains('revealed')).toBe(false);
  });

  it('should keep the strip on screen for the grace period after startup', async () => {
    // given a fresh visit
    vitest.useFakeTimers({ shouldAdvanceTime: true });
    const { fixture } = await renderNav();
    const host = screen.getByTestId('arc-nav').parentElement;
    fixture.detectChanges();

    // then the nav is on screen to begin with, so it is seen at least once —
    // and so is the server-rendered markup, which never runs the countdown
    expect(host?.classList.contains('revealed')).toBe(true);

    // when the grace period runs out
    await park(fixture);

    // then it parks below the bottom edge
    expect(host?.classList.contains('revealed')).toBe(false);
  });

  it('should pull the parked strip back in on an upward drag from the bottom edge', async () => {
    // given the parked nav — on touch there is no hover to call it back
    vitest.useFakeTimers({ shouldAdvanceTime: true });
    const { fixture } = await renderNav();
    const host = screen.getByTestId('arc-nav').parentElement;
    await park(fixture);

    // when a finger lands on the bottom edge and pulls upward
    document.dispatchEvent(touch('touchstart', window.innerHeight - 4));
    document.dispatchEvent(touch('touchmove', window.innerHeight - 40));
    fixture.detectChanges();

    // then the strip comes back
    expect(host?.classList.contains('revealed')).toBe(true);

    // and when it has been left alone for the grace period
    await park(fixture);

    // then it parks again
    expect(host?.classList.contains('revealed')).toBe(false);
  });

  it('should pull the strip back in even while another finger rests on the page', async () => {
    // given the parked nav and a thumb already resting mid-screen —
    // Regression: the gesture was measured on the first active contact,
    // which is that thumb, not the finger doing the pulling
    vitest.useFakeTimers({ shouldAdvanceTime: true });
    const { fixture } = await renderNav();
    const host = screen.getByTestId('arc-nav').parentElement;
    await park(fixture);
    document.dispatchEvent(touch('touchstart', window.innerHeight - 300, 1));

    // when a second finger lands on the bottom edge and pulls upward
    document.dispatchEvent(touch('touchstart', window.innerHeight - 4, 2));
    document.dispatchEvent(touch('touchmove', window.innerHeight - 40, 2));
    fixture.detectChanges();

    // then the strip comes back
    expect(host?.classList.contains('revealed')).toBe(true);
  });

  it('should find the edge contact when one touch event carries several', async () => {
    // given the parked nav — Regression: only the first changed contact was
    // looked at, so a two-finger landing whose first contact is mid-screen
    // threw the edge one away
    vitest.useFakeTimers({ shouldAdvanceTime: true });
    const { fixture } = await renderNav();
    const host = screen.getByTestId('arc-nav').parentElement;
    await park(fixture);

    // when two fingers land at once and only the second one is at the edge
    document.dispatchEvent(
      multiTouch('touchstart', [
        { identifier: 1, clientY: window.innerHeight - 300 },
        { identifier: 2, clientY: window.innerHeight - 4 },
      ])
    );
    document.dispatchEvent(touch('touchmove', window.innerHeight - 40, 2));
    fixture.detectChanges();

    // then the edge one is the one being measured
    expect(host?.classList.contains('revealed')).toBe(true);
  });

  it('should keep measuring the finger that started the pull', async () => {
    // given the parked nav and a pull under way from the bottom edge
    vitest.useFakeTimers({ shouldAdvanceTime: true });
    const { fixture } = await renderNav();
    const host = screen.getByTestId('arc-nav').parentElement;
    await park(fixture);
    document.dispatchEvent(touch('touchstart', window.innerHeight - 4, 1));

    // when a second finger lands at the edge and stays put, and the first
    // one carries on upward
    document.dispatchEvent(touch('touchstart', window.innerHeight - 2, 2));
    document.dispatchEvent(touch('touchmove', window.innerHeight - 40, 1));
    fixture.detectChanges();

    // then the pull still counts — the latecomer did not take it over
    expect(host?.classList.contains('revealed')).toBe(true);
  });

  it('should leave the strip parked on an upward drag that starts away from the edge', async () => {
    // given the parked nav
    vitest.useFakeTimers({ shouldAdvanceTime: true });
    const { fixture } = await renderNav();
    const host = screen.getByTestId('arc-nav').parentElement;
    await park(fixture);

    // when the page itself is scrolled — a drag starting well above the
    // edge belongs to the content, not to the nav
    document.dispatchEvent(touch('touchstart', window.innerHeight - 300));
    document.dispatchEvent(touch('touchmove', window.innerHeight - 400));
    fixture.detectChanges();

    // then the strip stays parked
    expect(host?.classList.contains('revealed')).toBe(false);
  });

  it('should bring the parked strip back when a finger lands on its sliver', async () => {
    // given the parked nav
    vitest.useFakeTimers({ shouldAdvanceTime: true });
    const { fixture } = await renderNav();
    const host = screen.getByTestId('arc-nav').parentElement;
    const track = screen.getByTestId('arc-nav').querySelector('.track');
    if (!track) throw new Error('track missing');
    await park(fixture);

    // when a finger lands on what is left of it on screen
    track.dispatchEvent(pointer('pointerdown', 0, 'touch'));
    fixture.detectChanges();

    // then it slides back in
    expect(host?.classList.contains('revealed')).toBe(true);
  });

  it('should park the strip on every viewport, phone included', () => {
    // given the component's compiled styles — jsdom resolves no media
    // query, so the rule is asserted where it is written
    const styles = (
      ArcNavComponent as unknown as { ɵcmp: { styles: string[] } }
    ).ɵcmp.styles.join(' ');

    // then the parking transform is unconditional, leaving the sliver that
    // an upward drag grabs
    expect(styles).toContain('translateY(calc(100% - 10px))');

    // and it is no longer behind the mouse-only query that kept a phone
    // pinned: on touch the reveal comes from that drag instead
    expect(styles).not.toMatch(/pointer:\s*fine/);
  });

  it('should fade a phone-width strip out over less than a wide one', () => {
    // given the `--edge-fade` the stylesheet derives from the strip's own
    // width — jsdom resolves no mask, so the rule is read where it is
    // written and the two widths are worked out here
    const styles = (
      ArcNavComponent as unknown as { ɵcmp: { styles: string[] } }
    ).ɵcmp.styles.join(' ');
    const clamp =
      /--edge-fade:\s*clamp\(\s*(\d+)px,\s*calc\(\s*(\d+)%\s*-\s*(\d+)px\s*\),\s*(\d+)px\s*\)/.exec(
        styles
      );
    if (!clamp) {
      throw new Error('--edge-fade is no longer a clamp of min, share, max');
    }
    const [min, share, offset, max] = clamp.slice(1).map(Number);
    const fadeFor = (strip: number) =>
      Math.min(Math.max(min, (share / 100) * strip - offset), max);

    // then the widest strip fades over three quarters of an item, as it
    // always has — the desktop end of this is not the one that was wrong
    expect(fadeFor(STRIP_MAX_PX)).toBe(66);

    // and neither is the window that is merely narrower than that: the
    // full fade is reached well before the strip stops growing
    expect(fadeFor(663)).toBe(66);

    // and a phone, where the strip is the viewport, fades over about half
    // of that instead of eating half an item at each end
    expect(fadeFor(390)).toBeGreaterThan(14);
    expect(fadeFor(390)).toBeLessThan(26);

    // and the narrowest phone lands on the floor itself — the effect also
    // hides the strip's wrap, so it must not be allowed to run out
    expect(fadeFor(320)).toBe(min);
    expect(min).toBeGreaterThan(0);
  });

  it('should fade the strip out at its ends, and measure from the track', () => {
    // given — the component's compiled styles. jsdom resolves neither a
    // mask nor a scroll container's layout, so these two rules are
    // asserted where they are written, the way
    // analysis-page.component.spec.ts does it.
    const styles = (
      ArcNavComponent as unknown as { ɵcmp: { styles: string[] } }
    ).ɵcmp.styles.join(' ');

    // then — background, border and shadow run out into nothing at either
    // end instead of stopping at a cut edge
    expect(styles).toMatch(
      /\.arc-nav[^}]*mask-image:\s*linear-gradient\(\s*to right,\s*transparent/
    );

    // and — Regression: arc-nav.geometry.ts reads the items' `offsetLeft`
    // against the track's `scrollLeft`, which agree only while the track
    // is their `offsetParent`. Unpositioned, the host is — and it spans
    // the viewport, so every offset would carry the strip's centring
    // margin while `scrollLeft` would not, and a wide screen would
    // enlarge an item several slots off from the one in the middle.
    expect(styles).toMatch(/\.track[^}]*position:\s*relative/);
  });
});
