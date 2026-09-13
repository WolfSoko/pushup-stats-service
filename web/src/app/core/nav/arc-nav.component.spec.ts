import { Component } from '@angular/core';
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

    // then
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/app',
      '/analysis',
      '/blog',
    ]);
    expect(links[0].textContent).toContain('Dashboard');
  });

  it('should mark the current route and centre it', async () => {
    // given
    const { scrollTo } = await renderNav('/analysis');

    // then
    const active = screen.getByRole('link', { current: 'page' });
    expect(active.getAttribute('href')).toBe('/analysis');
    expect(scrollTo).toHaveBeenCalled();
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

    // then
    expect(screen.getByTestId('badge-stub')).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: /Dashboard/ })
        .querySelector('.badge-slot')
    ).toBeTruthy();
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
