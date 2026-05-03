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
  { path: '/leaderboard', changefreq: 'daily', priority: '0.7' },
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
  const suffix = path === '/' ? '' : path;
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

/**
 * Parse one push-up type entry from the catalog source: the default
 * `slug` plus the optional `slugs: { lang: '...' }` per-locale block.
 * Returns `{ slug, slugs: { de, en, ... } }` per type. The DE slug
 * lives under `slugs.de` so callers can iterate uniformly.
 *
 * Why string-parsing instead of `require()`-ing the TS file: keeps
 * the sitemap generator free of TypeScript / Nx build deps and
 * runnable as plain `node tools/src/generate-sitemap.js`.
 */
function extractPushupTypes(source) {
  const types = [];
  // Match `id: '<id>'` then optional whitespace, then `slug: '<slug>'`,
  // then optionally a `slugs: { ... }` block before the next field.
  const blockRegex =
    /\bid:\s*'([^']+)',\s*\n\s*slug:\s*'([^']+)'(?:,\s*\n\s*slugs:\s*\{([^}]*)\})?/g;
  let match;
  while ((match = blockRegex.exec(source)) !== null) {
    const [, id, slug, slugsBlock] = match;
    const slugs = { de: slug };
    if (slugsBlock) {
      const entryRegex = /(\w{2}):\s*'([^']+)'/g;
      let entryMatch;
      while ((entryMatch = entryRegex.exec(slugsBlock)) !== null) {
        slugs[entryMatch[1]] = entryMatch[2];
      }
    }
    types.push({ id, slug, slugs });
  }
  return types;
}

/**
 * Backwards-compat helper for callers that only need the default
 * (German) slug list. Internally just reads the structured types.
 */
function extractPushupTypeSlugs(source) {
  return extractPushupTypes(source).map((t) => t.slug);
}

function readPushupTypes() {
  const catalogPath = resolve(
    ROOT,
    'libs/stats/src/lib/models/pushup-type.models.ts'
  );
  let source;
  try {
    source = readFileSync(catalogPath, 'utf-8');
  } catch (err) {
    console.error(`Failed to read pushup-type.models.ts: ${err.message}`);
    return [];
  }
  const types = extractPushupTypes(source);
  if (types.length === 0) {
    console.warn(
      'No push-up types found - verify pushup-type.models.ts format'
    );
  }
  return types;
}

/**
 * Emit one sitemap entry per (type × locale) pair using each
 * locale's own canonical slug. `alternates` carries the full set so
 * search engines can pair the localized variants — mirrors the
 * blog's `alternateSlugs` pattern.
 */
function buildPushupTypeRoutes(types) {
  const routes = [];
  for (const type of types) {
    const alternates = LOCALES.map((lang) => ({
      lang,
      path: `/wiki/liegestuetz-typen/${type.slugs[lang] ?? type.slug}`,
    }));
    for (const lang of LOCALES) {
      const localeSlug = type.slugs[lang] ?? type.slug;
      routes.push({
        path: `/wiki/liegestuetz-typen/${localeSlug}`,
        changefreq: 'monthly',
        priority: '0.6',
        locale: lang,
        alternates,
      });
    }
  }
  return routes;
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

function buildTrainingPlanRoutes(slugs) {
  return slugs.map((slug) => ({
    path: `/training-plans/${slug}`,
    changefreq: 'monthly',
    priority: '0.8',
  }));
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

function generateSitemap(posts, planSlugs = [], pushupTypes = []) {
  const blogRoutes = buildBlogRoutes(posts);
  const planRoutes = buildTrainingPlanRoutes(planSlugs);
  const pushupTypeRoutes = buildPushupTypeRoutes(pushupTypes);
  const allRoutes = [
    ...staticRoutes,
    ...planRoutes,
    ...pushupTypeRoutes,
    ...blogRoutes,
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
  const pushupTypes = readPushupTypes();
  const xml = generateSitemap(posts, planSlugs, pushupTypes);
  const outPath = resolve(ROOT, 'web/public/sitemap.xml');
  writeFileSync(outPath, xml, 'utf-8');
  const total =
    staticRoutes.length + planSlugs.length + pushupTypes.length + posts.length;
  console.log(`sitemap.xml written (${total} URLs)`);
}

if (require.main === module) {
  main();
}

module.exports = {
  LOCALES,
  staticRoutes,
  extractBlogPosts,
  extractTrainingPlanSlugs,
  extractPushupTypes,
  extractPushupTypeSlugs,
  scanMarkdownBlogPosts,
  buildUrl,
  buildBlogRoutes,
  buildTrainingPlanRoutes,
  buildPushupTypeRoutes,
  generateSitemap,
};
