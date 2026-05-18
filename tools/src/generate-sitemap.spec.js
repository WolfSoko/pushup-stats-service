const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const {
  staticRoutes,
  extractBlogPosts,
  extractTrainingPlanSlugs,
  extractPushupTypes,
  extractPushupTypeSlugs,
  extractExerciseWikiSlugs,
  scanMarkdownBlogPosts,
  buildUrl,
  buildBlogRoutes,
  buildTrainingPlanRoutes,
  buildPushupTypeRoutes,
  buildExerciseWikiRoutes,
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
        '/training-plans',
        '/wiki/liegestuetz-typen',
        '/wiki/uebungen',
        '/leaderboard',
        '/impressum',
        '/datenschutz',
      ]);
    });
  });

  describe('extractPushupTypes', () => {
    it('parses default slug from PUSHUP_TYPES catalog entries', () => {
      const source = `
        export const PUSHUP_TYPES = [
          {
            id: 'standard',
            slug: 'standard',
            name: 'x',
          },
          {
            id: 'diamond',
            slug: 'diamant',
            name: 'y',
          },
        ];
      `;
      expect(extractPushupTypes(source)).toEqual([
        { id: 'standard', slug: 'standard', slugs: { de: 'standard' } },
        { id: 'diamond', slug: 'diamant', slugs: { de: 'diamant' } },
      ]);
    });

    it('parses per-locale slugs block', () => {
      const source = `
        export const PUSHUP_TYPES = [
          {
            id: 'diamond',
            slug: 'diamant',
            slugs: {
              en: 'diamond-pushup',
              fr: 'pompe-diamant',
            },
            name: 'y',
          },
        ];
      `;
      expect(extractPushupTypes(source)).toEqual([
        {
          id: 'diamond',
          slug: 'diamant',
          slugs: {
            de: 'diamant',
            en: 'diamond-pushup',
            fr: 'pompe-diamant',
          },
        },
      ]);
    });

    it('extractPushupTypeSlugs returns the default-slug list', () => {
      const source = `
        export const PUSHUP_TYPES = [
          {
            id: 'standard',
            slug: 'standard',
          },
          {
            id: 'diamond',
            slug: 'diamant',
          },
        ];
      `;
      expect(extractPushupTypeSlugs(source)).toEqual(['standard', 'diamant']);
    });

    it('ignores `slug:` occurrences not paired with an `id:` line', () => {
      const source = `
        const day = { slug: 'not-a-type' };
        const type = {
          id: 'foo',
          slug: 'foo',
        };
      `;
      expect(extractPushupTypeSlugs(source)).toEqual(['foo']);
    });
  });

  describe('buildPushupTypeRoutes', () => {
    it('emits one route per (type × locale) using each locale slug', () => {
      const routes = buildPushupTypeRoutes([
        {
          id: 'diamond',
          slug: 'diamant',
          slugs: { de: 'diamant', en: 'diamond-pushup' },
        },
      ]);
      const de = routes.find((r) => r.locale === 'de');
      const en = routes.find((r) => r.locale === 'en');
      expect(de.path).toBe('/wiki/liegestuetz-typen/diamant');
      expect(en.path).toBe('/wiki/liegestuetz-typen/diamond-pushup');
      // Locales without an override fall back to the default slug.
      const fr = routes.find((r) => r.locale === 'fr');
      expect(fr.path).toBe('/wiki/liegestuetz-typen/diamant');
    });

    it('emits a complete alternates set so every locale links to every other', () => {
      const routes = buildPushupTypeRoutes([
        {
          id: 'diamond',
          slug: 'diamant',
          slugs: { de: 'diamant', en: 'diamond-pushup' },
        },
      ]);
      const en = routes.find((r) => r.locale === 'en');
      expect(en.alternates).toContainEqual({
        lang: 'de',
        path: '/wiki/liegestuetz-typen/diamant',
      });
      expect(en.alternates).toContainEqual({
        lang: 'en',
        path: '/wiki/liegestuetz-typen/diamond-pushup',
      });
    });
  });

  describe('extractExerciseWikiSlugs', () => {
    it('parses slug from EXERCISE_WIKI_CATALOG entries', () => {
      const source = `
        export const EXERCISE_WIKI_CATALOG = [
          {
            id: 'plank.standard',
            categoryId: 'core',
            slug: 'plank',
            difficulty: 'beginner',
            icon: 'horizontal_rule',
          },
          {
            id: 'legs.squats',
            categoryId: 'squat',
            slug: 'squats',
            difficulty: 'beginner',
            icon: 'airline_seat_legroom_reduced',
          },
        ];
      `;
      expect(extractExerciseWikiSlugs(source)).toEqual(['plank', 'squats']);
    });

    it('returns empty array when the catalog is missing', () => {
      expect(extractExerciseWikiSlugs('// no catalog here')).toEqual([]);
    });
  });

  describe('buildExerciseWikiRoutes', () => {
    const { LOCALES } = require('./generate-sitemap');

    it('emits one route per (slug × locale) under /wiki/uebungen', () => {
      const routes = buildExerciseWikiRoutes(['plank']);
      expect(routes).toHaveLength(LOCALES.length);
      for (const lang of LOCALES) {
        expect(routes).toContainEqual(
          expect.objectContaining({
            path: '/wiki/uebungen/plank',
            locale: lang,
            changefreq: 'monthly',
            priority: '0.6',
          })
        );
      }
    });

    it('attaches a full hreflang alternates set to every variant', () => {
      const [route] = buildExerciseWikiRoutes(['plank']);
      expect(route.alternates).toEqual(
        LOCALES.map((lang) => ({ lang, path: '/wiki/uebungen/plank' }))
      );
    });
  });

  describe('extractTrainingPlanSlugs', () => {
    it('parses slug from TRAINING_PLANS catalog entries', () => {
      const source = `
        export const TRAINING_PLANS = [
          {
            id: 'recruit-6w-v1',
            slug: 'recruit-6w',
            title: 'x',
          },
          {
            id: 'challenge-30d-v1',
            slug: 'challenge-30d',
            title: 'y',
          },
        ];
      `;
      expect(extractTrainingPlanSlugs(source)).toEqual([
        'recruit-6w',
        'challenge-30d',
      ]);
    });

    it('ignores `slug:` occurrences not paired with an `id:` line', () => {
      const source = `
        const day = { slug: 'not-a-plan' };
        const plan = {
          id: 'foo-v1',
          slug: 'foo',
        };
      `;
      expect(extractTrainingPlanSlugs(source)).toEqual(['foo']);
    });
  });

  describe('buildTrainingPlanRoutes', () => {
    const { LOCALES } = require('./generate-sitemap');

    it('emits one route per (plan × locale)', () => {
      const routes = buildTrainingPlanRoutes(['recruit-6w', 'challenge-30d']);
      expect(routes).toHaveLength(LOCALES.length * 2);
      for (const lang of LOCALES) {
        expect(routes).toContainEqual(
          expect.objectContaining({
            path: '/training-plans/recruit-6w',
            locale: lang,
            changefreq: 'monthly',
            priority: '0.8',
          })
        );
        expect(routes).toContainEqual(
          expect.objectContaining({
            path: '/training-plans/challenge-30d',
            locale: lang,
            changefreq: 'monthly',
            priority: '0.8',
          })
        );
      }
    });

    it('attaches a full hreflang alternates set to every variant', () => {
      const [route] = buildTrainingPlanRoutes(['recruit-6w']);
      expect(route.alternates).toEqual(
        LOCALES.map((lang) => ({ lang, path: '/training-plans/recruit-6w' }))
      );
    });
  });

  describe('scanMarkdownBlogPosts', () => {
    let tmpRoot;

    beforeEach(() => {
      tmpRoot = mkdtempSync(join(tmpdir(), 'sitemap-md-'));
    });

    afterEach(() => {
      rmSync(tmpRoot, { recursive: true, force: true });
    });

    function writePost(folder, lang, frontmatter) {
      const dir = join(tmpRoot, folder);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, `${lang}.md`),
        `---\n${frontmatter}\n---\n\nbody\n`,
        'utf-8'
      );
    }

    it('returns an empty list when the content directory does not exist', () => {
      expect(scanMarkdownBlogPosts(join(tmpRoot, 'missing'))).toEqual([]);
    });

    it('extracts slug, lang, alternateSlugs, and publishedAt from paired files', () => {
      writePost(
        'liegestuetze-fehler',
        'de',
        "slug: liegestuetze-fehler\npublishedAt: '2026-04-30'\ntitle: t\ndescription: d"
      );
      writePost(
        'liegestuetze-fehler',
        'en',
        "slug: pushup-mistakes\npublishedAt: '2026-04-30'\ntitle: t\ndescription: d"
      );
      const posts = scanMarkdownBlogPosts(tmpRoot);
      const de = posts.find((p) => p.lang === 'de');
      const en = posts.find((p) => p.lang === 'en');
      expect(de).toEqual({
        slug: 'liegestuetze-fehler',
        lang: 'de',
        publishedAt: '2026-04-30',
        alternateSlugs: {
          de: 'liegestuetze-fehler',
          en: 'pushup-mistakes',
        },
      });
      expect(en).toEqual({
        slug: 'pushup-mistakes',
        lang: 'en',
        publishedAt: '2026-04-30',
        alternateSlugs: {
          de: 'liegestuetze-fehler',
          en: 'pushup-mistakes',
        },
      });
    });

    it('emits one entry per discovered locale and lists every sibling in alternateSlugs', () => {
      writePost(
        'pushups-101',
        'de',
        "slug: liegestuetze-101\npublishedAt: '2026-05-01'\ntitle: t\ndescription: d"
      );
      writePost(
        'pushups-101',
        'en',
        "slug: pushups-101\npublishedAt: '2026-05-01'\ntitle: t\ndescription: d"
      );
      writePost(
        'pushups-101',
        'fr',
        "slug: pompes-101\npublishedAt: '2026-05-01'\ntitle: t\ndescription: d"
      );
      const posts = scanMarkdownBlogPosts(tmpRoot);
      expect(posts).toHaveLength(3);
      for (const post of posts) {
        expect(post.alternateSlugs).toEqual({
          de: 'liegestuetze-101',
          en: 'pushups-101',
          fr: 'pompes-101',
        });
      }
    });

    it('falls back to folder name when frontmatter omits `slug`', () => {
      writePost(
        'untranslated',
        'de',
        "publishedAt: '2026-01-01'\ntitle: t\ndescription: d"
      );
      const [post] = scanMarkdownBlogPosts(tmpRoot);
      expect(post.slug).toBe('untranslated');
      expect(post.alternateSlugs).toEqual({ de: 'untranslated' });
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
        '<xhtml:link rel="alternate" hreflang="de" href="https://pushup-stats.com/de/blog"/>'
      );
      expect(xml).toContain(
        '<xhtml:link rel="alternate" hreflang="en" href="https://pushup-stats.com/en/blog"/>'
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
        '<xhtml:link rel="alternate" hreflang="de" href="https://pushup-stats.com/de/blog/liegestuetze-steigern"/>'
      );
      expect(xml).toContain(
        '<xhtml:link rel="alternate" hreflang="en" href="https://pushup-stats.com/en/blog/pushup-progression"/>'
      );
    });

    it('emits hreflang="x-default" pointing at the DE variant', () => {
      const xml = buildUrl({
        path: '/blog',
        changefreq: 'weekly',
        priority: '0.9',
      });
      expect(xml).toContain(
        '<xhtml:link rel="alternate" hreflang="x-default" href="https://pushup-stats.com/de/blog"/>'
      );
    });

    it('honors custom alternates when emitting x-default for blog pairings', () => {
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
        '<xhtml:link rel="alternate" hreflang="x-default" href="https://pushup-stats.com/de/blog/liegestuetze-steigern"/>'
      );
    });
  });

  describe('buildBlogRoutes', () => {
    const pairAlternateSlugs = {
      de: 'liegestuetze-steigern',
      en: 'pushup-progression',
    };
    const posts = [
      {
        slug: 'liegestuetze-steigern',
        lang: 'de',
        publishedAt: '2025-01-15',
        alternateSlugs: pairAlternateSlugs,
      },
      {
        slug: 'pushup-progression',
        lang: 'en',
        publishedAt: '2025-01-15',
        alternateSlugs: pairAlternateSlugs,
      },
      {
        slug: 'orphan-de',
        lang: 'de',
        publishedAt: '2025-02-01',
        alternateSlugs: { de: 'orphan-de' },
      },
    ];

    it('emits one alternate per locale present in alternateSlugs (DE+EN pair)', () => {
      const routes = buildBlogRoutes(posts);
      const de = routes.find((r) => r.path === '/blog/liegestuetze-steigern');
      const en = routes.find((r) => r.path === '/blog/pushup-progression');
      const expected = [
        { lang: 'de', path: '/blog/liegestuetze-steigern' },
        { lang: 'en', path: '/blog/pushup-progression' },
      ];
      expect(de.alternates).toEqual(expected);
      expect(en.alternates).toEqual(expected);
    });

    it('emits self-only alternate for an orphan DE post', () => {
      const routes = buildBlogRoutes(posts);
      const orphan = routes.find((r) => r.path === '/blog/orphan-de');
      expect(orphan.alternates).toEqual([
        { lang: 'de', path: '/blog/orphan-de' },
      ]);
    });

    it('emits self-only alternate for an orphan EN post', () => {
      const routes = buildBlogRoutes([
        {
          slug: 'orphan-en',
          lang: 'en',
          publishedAt: '2025-03-01',
          alternateSlugs: { en: 'orphan-en' },
        },
      ]);
      expect(routes[0].alternates).toEqual([
        { lang: 'en', path: '/blog/orphan-en' },
      ]);
    });

    it('emits N alternates when more than two locales exist', () => {
      const allLocales = {
        de: 'liegestuetze-101',
        en: 'pushups-101',
        fr: 'pompes-101',
      };
      const routes = buildBlogRoutes([
        {
          slug: 'liegestuetze-101',
          lang: 'de',
          publishedAt: '2025-04-01',
          alternateSlugs: allLocales,
        },
      ]);
      expect(routes[0].alternates).toEqual([
        { lang: 'de', path: '/blog/liegestuetze-101' },
        { lang: 'en', path: '/blog/pushups-101' },
        { lang: 'fr', path: '/blog/pompes-101' },
      ]);
    });

    it('propagates publishedAt as lastmod', () => {
      const routes = buildBlogRoutes(posts);
      expect(routes[0].lastmod).toBe('2025-01-15');
    });
  });

  describe('generateSitemap', () => {
    it('produces valid XML with urlset, lastmod, and hreflang tags', () => {
      const alternateSlugs = {
        de: 'liegestuetze-steigern',
        en: 'pushup-progression',
      };
      const xml = generateSitemap([
        {
          slug: 'liegestuetze-steigern',
          lang: 'de',
          publishedAt: '2025-01-15',
          alternateSlugs,
        },
        {
          slug: 'pushup-progression',
          lang: 'en',
          publishedAt: '2025-01-15',
          alternateSlugs,
        },
      ]);
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<urlset');
      expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
      expect(xml).toContain(
        '<loc>https://pushup-stats.com/de/blog/liegestuetze-steigern</loc>'
      );
      expect(xml).toContain(
        '<loc>https://pushup-stats.com/en/blog/pushup-progression</loc>'
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

    it('emits /training-plans list and per-(plan × locale) detail entries with full hreflang alternates', () => {
      const { LOCALES } = require('./generate-sitemap');
      const xml = generateSitemap([], ['recruit-6w', 'challenge-30d']);
      expect(xml).toContain(
        '<loc>https://pushup-stats.com/de/training-plans</loc>'
      );
      for (const lang of LOCALES) {
        expect(xml).toContain(
          `<loc>https://pushup-stats.com/${lang}/training-plans/recruit-6w</loc>`
        );
        expect(xml).toContain(
          `<loc>https://pushup-stats.com/${lang}/training-plans/challenge-30d</loc>`
        );
      }
      expect(xml).toContain(
        '<xhtml:link rel="alternate" hreflang="en" href="https://pushup-stats.com/en/training-plans/recruit-6w"/>'
      );
      expect(xml).toContain(
        '<xhtml:link rel="alternate" hreflang="no" href="https://pushup-stats.com/no/training-plans/recruit-6w"/>'
      );
    });

    it('emits per-(slug × locale) exercise-wiki detail entries', () => {
      const { LOCALES } = require('./generate-sitemap');
      const xml = generateSitemap([], [], [], ['plank']);
      for (const lang of LOCALES) {
        expect(xml).toContain(
          `<loc>https://pushup-stats.com/${lang}/wiki/uebungen/plank</loc>`
        );
      }
      expect(xml).toContain(
        '<xhtml:link rel="alternate" hreflang="no" href="https://pushup-stats.com/no/wiki/uebungen/plank"/>'
      );
    });

    it('emits per-locale wiki URLs with hreflang alternates pointing at each locale slug', () => {
      const xml = generateSitemap(
        [],
        [],
        [
          {
            id: 'diamond',
            slug: 'diamant',
            slugs: { de: 'diamant', en: 'diamond-pushup' },
          },
        ]
      );
      // Default-slug URL emitted for the DE locale.
      expect(xml).toContain(
        '<loc>https://pushup-stats.com/de/wiki/liegestuetz-typen/diamant</loc>'
      );
      // Locale-specific slug emitted for EN.
      expect(xml).toContain(
        '<loc>https://pushup-stats.com/en/wiki/liegestuetz-typen/diamond-pushup</loc>'
      );
      // hreflang alternates point at each locale's correct slug.
      expect(xml).toContain(
        '<xhtml:link rel="alternate" hreflang="en" href="https://pushup-stats.com/en/wiki/liegestuetz-typen/diamond-pushup"/>'
      );
      expect(xml).toContain(
        '<xhtml:link rel="alternate" hreflang="de" href="https://pushup-stats.com/de/wiki/liegestuetz-typen/diamant"/>'
      );
    });
  });
});
