import { RenderMode, ServerRoute } from '@angular/ssr';
import {
  EXERCISE_WIKI_CATALOG,
  PUSHUP_TYPES,
  TRAINING_PLANS,
} from '@pu-stats/models';
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
    path: 'training-plans',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'training-plans/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      return TRAINING_PLANS.map((plan) => ({ slug: plan.slug }));
    },
  },
  {
    path: 'wiki/liegestuetz-typen',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'wiki/liegestuetz-typen/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      // Prerender the union of every locale's slug so each
      // locale-build emits a static HTML for `/<lang>/wiki/.../<slug>`
      // when `<slug>` is its own locale-specific override AND when
      // it's another locale's slug (those non-canonical pages still
      // render correctly thanks to the locale-aware
      // findPushupTypeBySlug, with `<link rel="canonical">` pointing
      // back at the locale's canonical slug — Google dedupes via
      // canonical so non-canonical variants don't fragment ranking).
      const slugs = new Set<string>();
      for (const type of PUSHUP_TYPES) {
        slugs.add(type.slug);
        if (type.slugs) {
          for (const localeSlug of Object.values(type.slugs)) {
            if (localeSlug) slugs.add(localeSlug);
          }
        }
      }
      return Array.from(slugs).map((slug) => ({ slug }));
    },
  },
  {
    path: 'wiki/uebungen',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'wiki/uebungen/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      return EXERCISE_WIKI_CATALOG.map((entry) => ({ slug: entry.slug }));
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
