import { RenderMode } from '@angular/ssr';
import { TRAINING_PLANS } from '@pu-stats/models';
import { serverRoutes } from './app.routes.server';

describe('serverRoutes', () => {
  it('includes the u/:uid route', () => {
    const paths = serverRoutes.map((r) => r.path);
    expect(paths).toContain('u/:uid');
  });

  it('renders u/:uid in Server mode so crawlers receive populated meta tags', () => {
    const route = serverRoutes.find((r) => r.path === 'u/:uid');
    expect(route?.renderMode).toBe(RenderMode.Server);
  });

  it('prerenders login, register, blog, training-plans, impressum, datenschutz and root', () => {
    const prerendered = [
      'login',
      'register',
      'blog',
      'training-plans',
      'impressum',
      'datenschutz',
      '',
    ];
    for (const path of prerendered) {
      const route = serverRoutes.find((r) => r.path === path);
      expect(route?.renderMode).toBe(RenderMode.Prerender);
    }
  });

  it('prerenders training-plans/:slug for every catalog plan', async () => {
    const route = serverRoutes.find((r) => r.path === 'training-plans/:slug');
    expect(route).toBeDefined();
    expect(route?.renderMode).toBe(RenderMode.Prerender);
    const fn = (route as { getPrerenderParams?: () => Promise<unknown[]> })
      .getPrerenderParams;
    expect(typeof fn).toBe('function');
    const params = (await fn?.()) ?? [];
    const expectedSlugs = TRAINING_PLANS.map((p) => p.slug).sort();
    const actualSlugs = (params as { slug: string }[])
      .map((p) => p.slug)
      .sort();
    expect(actualSlugs).toEqual(expectedSlugs);
  });

  it('renders leaderboard and the app shell features in Server mode', () => {
    const serverPaths = [
      'leaderboard',
      'app',
      'history',
      'analysis',
      'settings',
      'reminders',
    ];
    for (const path of serverPaths) {
      const route = serverRoutes.find((r) => r.path === path);
      expect(route?.renderMode).toBe(RenderMode.Server);
    }
  });

  it('renders admin and wildcard in Client mode', () => {
    for (const path of ['admin', '**']) {
      const route = serverRoutes.find((r) => r.path === path);
      expect(route?.renderMode).toBe(RenderMode.Client);
    }
  });

  it('blog/:slug has getPrerenderParams that emits at least one slug', async () => {
    const route = serverRoutes.find((r) => r.path === 'blog/:slug');
    expect(route).toBeDefined();
    expect(route?.renderMode).toBe(RenderMode.Prerender);
    // ServerRoute is a discriminated union; only the Prerender variant
    // carries `getPrerenderParams`, so narrow with a runtime cast and
    // guard the call. Don't index-access the property without the cast —
    // strict type narrowing rejects it for non-Prerender variants.
    const fn = (route as { getPrerenderParams?: () => Promise<unknown[]> })
      .getPrerenderParams;
    expect(typeof fn).toBe('function');
    const params = (await fn?.()) ?? [];
    expect(Array.isArray(params)).toBe(true);
    expect(params.length).toBeGreaterThan(0);
    for (const p of params) {
      expect(Object.prototype.hasOwnProperty.call(p, 'slug')).toBe(true);
      expect(typeof (p as { slug: string }).slug).toBe('string');
    }
  });

  it('u/:uid is NOT prerendered and NOT client-only', () => {
    // Public profiles depend on per-request Firestore reads, so they must
    // not be statically built (Prerender) and must run server-side so
    // crawlers see meta tags without executing client JS.
    const route = serverRoutes.find((r) => r.path === 'u/:uid');
    expect(route?.renderMode).not.toBe(RenderMode.Prerender);
    expect(route?.renderMode).not.toBe(RenderMode.Client);
  });
});
