const {
  staticRoutes,
  extractBlogPosts,
  buildUrl,
  buildBlogRoutes,
  generateSitemap,
} = require('./generate-sitemap');

describe('generate-sitemap', () => {
  describe('staticRoutes', () => {
    it('excludes /login and /register (no SEO value)', () => {
      const paths = staticRoutes.map((r) => r.path);
      expect(paths).not.toContain('/login');
      expect(paths).not.toContain('/register');
    });

    it('includes the expected public routes', () => {
      const paths = staticRoutes.map((r) => r.path);
      expect(paths).toEqual([
        '/',
        '/blog',
        '/leaderboard',
        '/impressum',
        '/datenschutz',
      ]);
    });
  });

  describe('extractBlogPosts', () => {
    it('parses slug, lang, translationSlug, and publishedAt from source', () => {
      const source = `
  {
    slug: 'liegestuetze-steigern',
    lang: 'de',
    translationSlug: 'pushup-progression',
    title: 'x',
    description: 'y',
    publishedAt: '2025-01-15',
    keywords: ['a'],
    content: 'foo',
  },
  {
    slug: 'untranslated-post',
    lang: 'en',
    title: 'x',
    description: 'y',
    publishedAt: '2025-02-01',
    keywords: ['a'],
    content: 'bar',
  },
`;
      expect(extractBlogPosts(source)).toEqual([
        {
          slug: 'liegestuetze-steigern',
          lang: 'de',
          translationSlug: 'pushup-progression',
          publishedAt: '2025-01-15',
        },
        {
          slug: 'untranslated-post',
          lang: 'en',
          translationSlug: undefined,
          publishedAt: '2025-02-01',
        },
      ]);
    });
  });

  describe('buildUrl', () => {
    it('emits a <lastmod> when provided', () => {
      const xml = buildUrl({
        path: '/blog/foo',
        changefreq: 'monthly',
        priority: '0.8',
        locale: 'de',
        lastmod: '2025-01-15',
      });
      expect(xml).toContain('<lastmod>2025-01-15</lastmod>');
    });

    it('omits <lastmod> when absent', () => {
      const xml = buildUrl({
        path: '/',
        changefreq: 'weekly',
        priority: '1.0',
        locale: 'de',
      });
      expect(xml).not.toContain('<lastmod>');
    });

    it('uses the same path for both locale alternates when `alternates` is omitted', () => {
      const xml = buildUrl({
        path: '/blog',
        changefreq: 'weekly',
        priority: '0.9',
      });
      expect(xml).toContain(
        '<xhtml:link rel="alternate" hreflang="de" href="https://pushup-stats.de/de/blog"/>'
      );
      expect(xml).toContain(
        '<xhtml:link rel="alternate" hreflang="en" href="https://pushup-stats.de/en/blog"/>'
      );
    });

    it('honors custom `alternates` for cross-locale blog pairing', () => {
      const xml = buildUrl({
        path: '/blog/liegestuetze-steigern',
        changefreq: 'monthly',
        priority: '0.8',
        locale: 'de',
        alternates: [
          { lang: 'de', path: '/blog/liegestuetze-steigern' },
          { lang: 'en', path: '/blog/pushup-progression' },
        ],
      });
      expect(xml).toContain(
        '<xhtml:link rel="alternate" hreflang="de" href="https://pushup-stats.de/de/blog/liegestuetze-steigern"/>'
      );
      expect(xml).toContain(
        '<xhtml:link rel="alternate" hreflang="en" href="https://pushup-stats.de/en/blog/pushup-progression"/>'
      );
    });
  });

  describe('buildBlogRoutes', () => {
    const posts = [
      {
        slug: 'liegestuetze-steigern',
        lang: 'de',
        translationSlug: 'pushup-progression',
        publishedAt: '2025-01-15',
      },
      {
        slug: 'pushup-progression',
        lang: 'en',
        translationSlug: 'liegestuetze-steigern',
        publishedAt: '2025-01-15',
      },
      {
        slug: 'orphan-de',
        lang: 'de',
        publishedAt: '2025-02-01',
      },
    ];

    it('pairs DE and EN posts with matching translationSlug', () => {
      const routes = buildBlogRoutes(posts);
      const de = routes.find((r) => r.path === '/blog/liegestuetze-steigern');
      const en = routes.find((r) => r.path === '/blog/pushup-progression');
      expect(de.alternates).toEqual([
        { lang: 'de', path: '/blog/liegestuetze-steigern' },
        { lang: 'en', path: '/blog/pushup-progression' },
      ]);
      expect(en.alternates).toEqual([
        { lang: 'de', path: '/blog/liegestuetze-steigern' },
        { lang: 'en', path: '/blog/pushup-progression' },
      ]);
    });

    it('emits self-only alternate for posts without a translation pair', () => {
      const routes = buildBlogRoutes(posts);
      const orphan = routes.find((r) => r.path === '/blog/orphan-de');
      expect(orphan.alternates).toEqual([
        { lang: 'de', path: '/blog/orphan-de' },
      ]);
    });

    it('propagates publishedAt as lastmod', () => {
      const routes = buildBlogRoutes(posts);
      expect(routes[0].lastmod).toBe('2025-01-15');
    });
  });

  describe('generateSitemap', () => {
    it('produces valid XML with urlset, lastmod, and hreflang tags', () => {
      const xml = generateSitemap([
        {
          slug: 'liegestuetze-steigern',
          lang: 'de',
          translationSlug: 'pushup-progression',
          publishedAt: '2025-01-15',
        },
        {
          slug: 'pushup-progression',
          lang: 'en',
          translationSlug: 'liegestuetze-steigern',
          publishedAt: '2025-01-15',
        },
      ]);
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<urlset');
      expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
      expect(xml).toContain(
        '<loc>https://pushup-stats.de/de/blog/liegestuetze-steigern</loc>'
      );
      expect(xml).toContain(
        '<loc>https://pushup-stats.de/en/blog/pushup-progression</loc>'
      );
      expect(xml).toContain('<lastmod>2025-01-15</lastmod>');
    });

    it('does not emit /login or /register entries', () => {
      const xml = generateSitemap([]);
      expect(xml).not.toContain('/de/login');
      expect(xml).not.toContain('/de/register');
      expect(xml).not.toContain('/en/login');
      expect(xml).not.toContain('/en/register');
    });
  });
});
