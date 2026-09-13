import { Component, PLATFORM_ID } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';

import { ArcNavComponent } from './arc-nav.component';
import type { MainNavItem } from './main-nav-items';

@Component({ template: '' })
class BlankComponent {}

@Component({ template: '<span data-testid="badge-stub">3</span>' })
class BadgeStubComponent {}

/** jsdom has no PointerEvent; a MouseEvent with the one field the nav reads does. */
function pointer(type: string, clientX: number): MouseEvent {
  const event = new MouseEvent(type, { clientX, bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
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

  afterEach(() => {
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
    expect(links[0].style.transform).toBe('translateY(0px) scale(1.3)');
    expect(links[2].style.transform).toBe('translateY(8.96px) scale(0.9)');
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
});
