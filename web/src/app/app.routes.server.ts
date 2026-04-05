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

  // --- Server-rendered (dynamic data per request) ---
  {
    path: '',
    renderMode: RenderMode.Server,
  },
  {
    path: 'landing',
    renderMode: RenderMode.Server,
  },
  {
    path: 'leaderboard',
    renderMode: RenderMode.Server,
  },
  {
    path: 'app',
    renderMode: RenderMode.Server,
  },
  {
    path: 'data',
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
