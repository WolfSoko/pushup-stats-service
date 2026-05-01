import { RenderMode } from '@angular/ssr';
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

  it('prerenders login, register, blog, impressum and datenschutz', () => {
    const prerendered = ['login', 'register', 'blog', 'impressum', 'datenschutz', ''];
    for (const path of prerendered) {
      const route = serverRoutes.find((r) => r.path === path);
      expect(route?.renderMode).toBe(RenderMode.Prerender);
    }
  });

  it('renders leaderboard in Server mode', () => {
    const route = serverRoutes.find((r) => r.path === 'leaderboard');
    expect(route?.renderMode).toBe(RenderMode.Server);
  });

  it('renders the app shell and feature routes in Server mode', () => {
    const serverPaths = ['app', 'history', 'analysis', 'settings', 'reminders'];
    for (const path of serverPaths) {
      const route = serverRoutes.find((r) => r.path === path);
      expect(route?.renderMode).toBe(RenderMode.Server);
    }
  });

  it('renders admin and wildcard in Client mode', () => {
    const clientPaths = ['admin', '**'];
    for (const path of clientPaths) {
      const route = serverRoutes.find((r) => r.path === path);
      expect(route?.renderMode).toBe(RenderMode.Client);
    }
  });

  it('blog/:slug has a getPrerenderParams function for static generation', async () => {
    const route = serverRoutes.find((r) => r.path === 'blog/:slug');
    expect(route).toBeDefined();
    expect(route?.renderMode).toBe(RenderMode.Prerender);
    // getPrerenderParams must return at least one slug so the blog index
    // doesn't produce a 404 at build time.
    const params = await route?.getPrerenderParams?.();
    expect(Array.isArray(params)).toBe(true);
    expect(params!.length).toBeGreaterThan(0);
    // Every entry must carry a `slug` key (matching the route param).
    for (const p of params!) {
      expect(Object.prototype.hasOwnProperty.call(p, 'slug')).toBe(true);
      expect(typeof (p as { slug: string }).slug).toBe('string');
    }
  });

  it('u/:uid is NOT prerendered and NOT client-only', () => {
    // Public profile pages depend on per-request Firestore reads, so they
    // must not be statically built (Prerender) and must run server-side
    // so crawlers see meta tags without executing client JS.
    const route = serverRoutes.find((r) => r.path === 'u/:uid');
    expect(route?.renderMode).not.toBe(RenderMode.Prerender);
    expect(route?.renderMode).not.toBe(RenderMode.Client);
  });
});