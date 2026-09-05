#!/usr/bin/env node
// Generates sitemap.xml from route + blog-post definitions.
const {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} = require('node:fs');
const { join, resolve } = require('node:path');
const { parse: parseYaml } = require('yaml');

const ROOT = resolve(__dirname, '../..');
const BASE_URL = 'https://pushup-stats.com';

/**
 * Single source of truth: parse the `SUPPORTED_LOCALES` tuple out of
 * `web/src/server-locale-redirect.ts` so the sitemap, the SSR
 * redirect, and the SEO service can never silently drift apart.
 * Falls back to a hard-coded list only if the regex doesn't match —
 * surfaces a loud warning so the build still emits a valid sitemap
 * but the inconsistency is visible.
 */
function readSupportedLocales() {
  const path = resolve(ROOT, 'web/src/server-locale-redirect.ts');
  let source;
  try {
    source = readFileSync(path, 'utf-8');
  } catch (err) {
    console.warn(
      `Failed to read SUPPORTED_LOCALES from ${path}: ${err.message}`
    );
    return ['de', 'en'];
  }
  const match = /export const SUPPORTED_LOCALES\s*=\s*\[([^\]]+)\]/.exec(
    source
  );
  if (!match) {
    console.warn(
      `SUPPORTED_LOCALES not found in ${path}; falling back to ['de','en']`
    );
    return ['de', 'en'];
  }
  // Accept either single or double quotes so a stylistic refactor
  // of the source tuple doesn't silently empty the locale list.
  const locales = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
  if (locales.length === 0) {
    console.warn(
      `SUPPORTED_LOCALES tuple in ${path} parsed but empty; falling back to ['de','en']`
    );
    return ['de', 'en'];
  }
  return locales;
}

const LOCALES = readSupportedLocales();

const staticRoutes = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/blog', changefreq: 'weekly', priority: '0.9' },
  { path: '/training-plans', changefreq: 'weekly', priority: '0.9' },
  { path: '/wiki/liegestuetz-typen', changefreq: 'monthly', priority: '0.6' },
  { path: '/wiki/uebungen', changefreq: 'monthly', priority: '0.6' },
  { path: '/leaderboard', changefreq: 'daily', priority: '0.7' },
  { path: '/ueber-uns', changefreq: 'yearly', priority: '0.4' },
  { path: '/impressum', changefreq: 'yearly', priority: '0.3' },
  { path: '/datenschutz', changefreq: 'yearly', priority: '0.3' },
];

function extractBlogPosts(source) {
  // Legacy inline-TS blog posts have been fully migrated to
  // `content/blog/**/*.md`. This helper is kept so existing callers
  // and tests continue to compile, but the regex now matches nothing
  // in the current `blog-posts.data.ts`.
  const posts = [];
  const blockRegex =
    /\{\s*slug:\s*'([^']+)',\s*\n\s*lang:\s*'(de|en)',(?:\s*\n\s*translationSlug:\s*'([^']+)',)?[\s\S]*?publishedAt:\s*'([^']+)',/g;
  let match;
  while ((match = blockRegex.exec(source)) !== null) {
    const [, slug, lang, translationSlug, publishedAt] = match;
    posts.push({ slug, lang, translationSlug, publishedAt });
  }
  return posts;
}

/**
 * Scans `content/blog/<folder>/<lang>.md` for markdown-sourced posts.
 * Folder name is the cross-locale identifier; per-locale `slug` in
 * frontmatter overrides the URL slug for that locale. Each returned
 * post carries `alternateSlugs` — the map of every sibling locale's
 * slug (including this post's own) — so callers can emit complete
 * hreflang alternate sets without re-reading the directory.
 *
 * Discovers ANY `<lang>.md` file in each folder (not a fixed list)
 * so adding a new locale is just dropping in the file.
 */
function scanMarkdownBlogPosts(blogContentRoot) {
  if (!existsSync(blogContentRoot)) return [];
  // Sort to make sitemap output byte-stable across filesystems
  // (readdirSync order varies by OS).
  const folders = readdirSync(blogContentRoot)
    .filter((entry) => {
      try {
        return statSync(join(blogContentRoot, entry)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
  const posts = [];
  for (const folder of folders) {
    const perLocale = {};
    const localeFiles = readdirSync(join(blogContentRoot, folder))
      .filter((f) => f.endsWith('.md'))
      .sort();
    for (const file of localeFiles) {
      const lang = file.slice(0, -3);
      const path = join(blogContentRoot, folder, file);
      const data = readFrontmatter(path);
      perLocale[lang] = {
        slug: data.slug ?? folder,
        publishedAt: data.publishedAt,
      };
    }
    const alternateSlugs = Object.fromEntries(
      Object.entries(perLocale).map(([lang, entry]) => [lang, entry.slug])
    );
    for (const [lang, entry] of Object.entries(perLocale)) {
      posts.push({
        slug: entry.slug,
        lang,
        publishedAt: String(entry.publishedAt ?? ''),
        alternateSlugs,
      });
    }
  }
  return posts;
}

function readFrontmatter(path) {
  const source = readFileSync(path, 'utf-8');
  if (!source.startsWith('---\n') && !source.startsWith('---\r\n')) {
    throw new Error(`${path}: missing YAML frontmatter`);
  }
  const afterOpen = source.indexOf('\n', 3) + 1;
  const closeIdx = source.indexOf('\n---', afterOpen);
  if (closeIdx === -1) {
    throw new Error(`${path}: unterminated YAML frontmatter`);
  }
  const yamlBlock = source.slice(afterOpen, closeIdx);
  return parseYaml(yamlBlock) ?? {};
}

function readBlogPosts() {
  const posts = scanMarkdownBlogPosts(resolve(ROOT, 'content/blog'));
  if (posts.length === 0) {
    console.warn(
      'No blog posts found - verify content/blog/<folder>/{de,en}.md'
    );
  }
  return posts;
}

function buildUrl({ path, changefreq, priority, locale, lastmod, alternates }) {
  // Locale roots keep the trailing slash (`/de/`, not `/de`): the pages
  // declare `/<lang>/` as canonical, so a slash-less sitemap entry shows
  // up in Search Console as a non-indexed duplicate/redirect URL.
  const suffix = path === '/' ? '/' : path;
  const primaryLocale = locale ?? 'de';
  const loc = `${BASE_URL}/${primaryLocale}${suffix}`;

  const alts = alternates ?? LOCALES.map((lang) => ({ lang, path: suffix }));

  // x-default points at the German variant: the project's source locale is
  // German and the SSR locale-redirect picks `de` whenever Accept-Language
  // doesn't explicitly request English. Search engines use x-default for
  // unmatched/unknown locales, so it must mirror the runtime fallback.
  const defaultAlt = alts.find((a) => a.lang === 'de') ?? alts[0];

  const hreflangLinks = [
    ...alts.map(
      ({ lang, path: altPath }) =>
        `    <xhtml:link rel="alternate" hreflang="${lang}" href="${BASE_URL}/${lang}${altPath}"/>`
    ),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/${defaultAlt.lang}${defaultAlt.path}"/>`,
  ].join('\n');

  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';

  return `  <url>
    <loc>${loc}</loc>${lastmodTag}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${hreflangLinks}
  </url>`;
}

function extractTrainingPlanSlugs(source) {
  // Match `id: '<id>'` immediately followed by `slug: '<slug>'` to scope
  // matches to TRAINING_PLANS catalog entries (other files contain `slug:`
  // but only catalog entries pair it with `id:`).
  const slugs = [];
  const blockRegex = /\bid:\s*'[^']+',\s*\n\s*slug:\s*'([^']+)'/g;
  let match;
  while ((match = blockRegex.exec(source)) !== null) {
    slugs.push(match[1]);
  }
  return slugs;
}

function readTrainingPlanSlugs() {
  const catalogPath = resolve(
    ROOT,
    'libs/stats/src/lib/models/training-plan.catalog.ts'
  );
  let source;
  try {
    source = readFileSync(catalogPath, 'utf-8');
  } catch (err) {
    console.error(`Failed to read training-plan.catalog.ts: ${err.message}`);
    return [];
  }
  const slugs = extractTrainingPlanSlugs(source);
  if (slugs.length === 0) {
    console.warn(
      'No training plans found - verify training-plan.catalog.ts format'
    );
  }
  return slugs;
}

/**
 * Training-plan detail pages prerender for every supported locale
 * (Angular i18n builds one bundle per locale and `getPrerenderParams`
 * returns the same slug for all of them — see
 * `web/src/app/app.routes.server.ts`). Emit one `<loc>` per
 * (slug × locale) so each prerendered HTML has its own sitemap entry,
 * and pair every variant via hreflang. Without per-locale `<loc>`
 * entries the hreflang reciprocity Google requires would be broken.
 */
function buildTrainingPlanRoutes(slugs) {
  const routes = [];
  for (const slug of slugs) {
    const alternates = LOCALES.map((lang) => ({
      lang,
      path: `/training-plans/${slug}`,
    }));
    for (const lang of LOCALES) {
      routes.push({
        path: `/training-plans/${slug}`,
        changefreq: 'monthly',
        priority: '0.8',
        locale: lang,
        alternates,
      });
    }
  }
  return routes;
}

/**
 * Static public routes are prerendered for every supported locale,
 * so emit one `<loc>` per (route × locale) with a full hreflang
 * alternates set — the same shape the dynamic builders use. The `/`
 * landing page keeps its trailing slash (`/de/`) in both `<loc>` and
 * alternates — that is the form the pages declare as canonical.
 */
function buildStaticRoutes() {
  const routes = [];
  for (const route of staticRoutes) {
    const alternates = LOCALES.map((lang) => ({ lang, path: route.path }));
    for (const lang of LOCALES) {
      routes.push({
        path: route.path,
        changefreq: route.changefreq,
        priority: route.priority,
        locale: lang,
        alternates,
      });
    }
  }
  return routes;
}

function buildBlogRoutes(posts) {
  return posts.map((post) => {
    // `alternateSlugs` is populated by `scanMarkdownBlogPosts` with
    // every sibling locale's slug (including the post's own). Emit one
    // <xhtml:link> per available translation so search engines pair
    // them correctly; missing locales for a folder are silently
    // omitted rather than emitting a hreflang to a URL the runtime
    // would 404 on. With the current full-coverage content set every
    // post has an entry per supported locale, so this matches what
    // `findBlogPost()` resolves at runtime.
    const alternates = post.alternateSlugs
      ? Object.entries(post.alternateSlugs).map(([lang, slug]) => ({
          lang,
          path: `/blog/${slug}`,
        }))
      : [{ lang: post.lang, path: `/blog/${post.slug}` }];
    return {
      path: `/blog/${post.slug}`,
      changefreq: 'monthly',
      priority: '0.8',
      locale: post.lang,
      lastmod: post.publishedAt,
      alternates,
    };
  });
}

/**
 * True when a wiki markdown file carries a long-form body below its
 * frontmatter. This is the single signal that decides indexability:
 * entries with a body are listed here and drop their `noindex` tag,
 * frontmatter-only entries stay out of both. At ~60-100 words those
 * read as thin content and once cost the site an AdSense review.
 *
 * The detail components gate their robots tag on the same field
 * (`article`, produced from this body by `generate-content.mjs`), so
 * the sitemap and the robots tag cannot drift apart.
 */
function hasMarkdownBody(path) {
  const source = readFileSync(path, 'utf-8');
  const afterOpen = source.indexOf('\n', 3) + 1;
  const closeIdx = source.indexOf('\n---', afterOpen);
  if (closeIdx === -1) return false;
  return source.slice(closeIdx + 4).trim().length > 0;
}

/**
 * Maps wiki entry id → set of locales whose file has a body. Resolved
 * per (id, locale), not per id: a translation that has not caught up
 * yet must not be listed, or the sitemap would advertise a page that
 * still serves `noindex`.
 */
function scanWikiArticles(dir) {
  const byId = new Map();
  if (!existsSync(dir)) return byId;
  for (const file of readdirSync(dir).sort()) {
    const match = /^(.+)\.([a-z][a-z-]*)\.md$/.exec(file);
    if (!match) continue;
    const [, id, lang] = match;
    if (!hasMarkdownBody(join(dir, file))) continue;
    if (!byId.has(id)) byId.set(id, new Set());
    byId.get(id).add(lang);
  }
  return byId;
}

/**
 * Push-up type slugs are per-locale (`slugs: { en, fr, ... }` with the
 * top-level `slug` as the German/default). Mirrors
 * `pushupTypeSlugByLocale()` in `pushup-type.models.ts` — the same
 * `slugs?.[lang] ?? slug` fallback the detail route resolves at
 * runtime, so every emitted URL is one the app actually serves.
 */
function extractPushupTypeSlugs(source) {
  const byId = new Map();
  const blockRegex =
    /\bid:\s*'([^']+)',\s*\n\s*slug:\s*'([^']+)',\s*\n\s*slugs:\s*\{([^}]*)\}/g;
  let match;
  while ((match = blockRegex.exec(source)) !== null) {
    const [, id, defaultSlug, slugsBlock] = match;
    const perLocale = {};
    for (const entry of slugsBlock.matchAll(/([a-z][a-z-]*):\s*'([^']+)'/g)) {
      perLocale[entry[1]] = entry[2];
    }
    byId.set(id, { defaultSlug, perLocale });
  }
  return byId;
}

/** Exercise wiki entries share one slug across locales. */
function extractExerciseWikiSlugs(source) {
  const byId = new Map();
  const blockRegex =
    /\bid:\s*'([^']+)',\s*\n\s*categoryId:\s*'[^']+',\s*\n\s*slug:\s*'([^']+)'/g;
  let match;
  while ((match = blockRegex.exec(source)) !== null) {
    byId.set(match[1], match[2]);
  }
  return byId;
}

function readCatalogSource(relativePath) {
  try {
    return readFileSync(resolve(ROOT, relativePath), 'utf-8');
  } catch (err) {
    console.error(`Failed to read ${relativePath}: ${err.message}`);
    return '';
  }
}

function buildWikiRoutes(slugFor, articlesById) {
  const routes = [];
  for (const [id, localesWithArticle] of [...articlesById].sort()) {
    const emitted = LOCALES.filter((lang) => localesWithArticle.has(lang));
    if (emitted.length === 0) continue;
    const alternates = emitted
      .map((lang) => ({ lang, path: slugFor(id, lang) }))
      .filter((alt) => alt.path !== null);
    if (alternates.length === 0) continue;
    for (const lang of emitted) {
      const path = slugFor(id, lang);
      if (path === null) continue;
      routes.push({
        path,
        changefreq: 'monthly',
        priority: '0.6',
        locale: lang,
        alternates,
      });
    }
  }
  return routes;
}

function buildPushupTypeRoutes() {
  const slugs = extractPushupTypeSlugs(
    readCatalogSource('libs/stats/src/lib/models/pushup-type.models.ts')
  );
  const articles = scanWikiArticles(resolve(ROOT, 'content/wiki/pushup-types'));
  return buildWikiRoutes((id, lang) => {
    const entry = slugs.get(id);
    if (!entry) return null;
    const slug = entry.perLocale[lang] ?? entry.defaultSlug;
    return `/wiki/liegestuetz-typen/${slug}`;
  }, articles);
}

function buildExerciseWikiRoutes() {
  const slugs = extractExerciseWikiSlugs(
    readCatalogSource('libs/stats/src/lib/models/exercise-wiki.models.ts')
  );
  const articles = scanWikiArticles(resolve(ROOT, 'content/wiki/exercises'));
  return buildWikiRoutes((id) => {
    const slug = slugs.get(id);
    return slug ? `/wiki/uebungen/${slug}` : null;
  }, articles);
}

function generateSitemap(posts, planSlugs = []) {
  const blogRoutes = buildBlogRoutes(posts);
  const planRoutes = buildTrainingPlanRoutes(planSlugs);
  const allRoutes = [
    ...buildStaticRoutes(),
    ...planRoutes,
    ...blogRoutes,
    ...buildPushupTypeRoutes(),
    ...buildExerciseWikiRoutes(),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${allRoutes.map(buildUrl).join('\n')}
</urlset>
`;
}

function main() {
  const posts = readBlogPosts();
  const planSlugs = readTrainingPlanSlugs();
  const xml = generateSitemap(posts, planSlugs);
  const outPath = resolve(ROOT, 'web/public/sitemap.xml');
  writeFileSync(outPath, xml, 'utf-8');
  // Counted from the emitted XML rather than re-derived from the inputs:
  // the wiki builders emit a content-dependent number of URLs, and a
  // hand-maintained sum silently drifts from what was actually written.
  const total = (xml.match(/<loc>/g) ?? []).length;
  const wikiTotal = (xml.match(/<loc>[^<]*\/wiki\/[^<]*\/[^<]*<\/loc>/g) ?? [])
    .length;
  console.log(`sitemap.xml written (${total} URLs, ${wikiTotal} wiki detail)`);
  const coverage = Object.fromEntries(LOCALES.map((lang) => [lang, 0]));
  for (const post of posts) {
    if (post.lang in coverage) coverage[post.lang] += 1;
  }
  const coverageLine = LOCALES.map((lang) => `${lang}=${coverage[lang]}`).join(
    ' | '
  );
  console.log(`blog coverage | ${coverageLine}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  LOCALES,
  staticRoutes,
  extractBlogPosts,
  extractTrainingPlanSlugs,
  scanMarkdownBlogPosts,
  buildUrl,
  buildStaticRoutes,
  buildBlogRoutes,
  buildTrainingPlanRoutes,
  generateSitemap,
};
