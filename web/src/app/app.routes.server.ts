import { RenderMode, ServerRoute } from '@angular/ssr';
import { BLOG_POSTS } from './blog/blog-posts.data';

export const serverRoutes: ServerRoute[] = [
  // --- Prerendered (static content, built at compile time) ---
  {
    path: 'login',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'register',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'blog',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'blog/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      return BLOG_POSTS.map((post) => ({ slug: post.slug }));
    },
  },
  {
    path: 'impressum',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'datenschutz',
    renderMode: RenderMode.Prerender,
  },

  // Landing is static marketing content — auth/ads state hydrates on the
  // client, so prerendering is safe and saves an SSR round-trip per hit.
  {
    path: '',
    renderMode: RenderMode.Prerender,
  },

  // --- Server-rendered (dynamic data per request) ---
  {
    path: 'landing',
    renderMode: RenderMode.Server,
  },
  {
    path: 'leaderboard',
    renderMode: RenderMode.Server,
  },
  // Public profile pages: dynamic per UID, server-rendered so social-card
  // crawlers see populated meta tags without running client JS.
  {
    path: 'u/:uid',
    renderMode: RenderMode.Server,
  },
  {
    path: 'app',
    renderMode: RenderMode.Server,
  },
  {
    path: 'history',
    renderMode: RenderMode.Server,
  },
  {
    path: 'analysis',
    renderMode: RenderMode.Server,
  },
  {
    path: 'settings',
    renderMode: RenderMode.Server,
  },
  {
    path: 'reminders',
    renderMode: RenderMode.Server,
  },

  // --- Client-only ---
  {
    path: 'admin',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
