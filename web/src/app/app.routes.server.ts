import { RenderMode, ServerRoute } from '@angular/ssr';
import { TRAINING_PLANS } from '@pu-stats/models';
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
    // Auth-gated and camera-driven — there is nothing to prerender, and it
    // must precede the `:slug` prerender rule to claim the deeper URL.
    path: 'training-plans/:slug/session',
    renderMode: RenderMode.Client,
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
    path: 'wiki/uebungen',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'ueber-uns',
    renderMode: RenderMode.Prerender,
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

  // --- Server-rendered ---
  {
    path: 'landing',
    renderMode: RenderMode.Server,
  },
  {
    path: 'leaderboard',
    renderMode: RenderMode.Server,
  },
  // Wiki detail pages: catalog-driven content, identical output per
  // slug+locale until the next deploy — genuinely "static". Server
  // rather than Prerender to cut ~1400 of the ~2400 routes that
  // thrashed the App Hosting builder (see
  // docs/gotchas/build-and-tooling.md). `server-ssr-cache.ts` gives
  // the CDN in front of Cloud Run a short TTL for these paths so
  // repeat hits don't re-render on every request.
  //
  // Entries that carry a long-form body are indexed and listed in
  // sitemap.xml; frontmatter-only ones still emit `noindex` (see the
  // SeoService.update calls in the components). Server mode serves
  // both the same way — crawlers get fully populated HTML either way,
  // so indexability does not force a move back to Prerender.
  {
    path: 'wiki/liegestuetz-typen/:slug',
    renderMode: RenderMode.Server,
  },
  {
    path: 'wiki/uebungen/:slug',
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
    path: 'goals',
    renderMode: RenderMode.Server,
  },
  {
    path: 'reminders',
    renderMode: RenderMode.Server,
  },

  // --- Client-only ---
  // The assistant talks to an external AG-UI runtime and pulls its UI chunk
  // on demand; there is nothing meaningful to render on the server.
  {
    path: 'assistant',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/users/:uid/entries',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
