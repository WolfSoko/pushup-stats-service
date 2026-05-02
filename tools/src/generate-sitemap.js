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
const BASE_URL = 'https://pushup-stats.de';

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
 * Scans `content/blog/<folder>/{de,en}.md` for markdown-sourced posts.
 * Folder name is the cross-locale identifier; per-locale `slug` in
 * frontmatter overrides the URL slug for that locale, and the other
 * locale's slug becomes the `translationSlug` in the sitemap.
 */
function scanMarkdownBlogPosts(blogContentRoot) {
  if (!existsSync(blogContentRoot)) return [];
  const folders = readdirSync(blogContentRoot).filter((entry) => {
    try {
      return statSync(join(blogContentRoot, entry)).isDirectory();
    } catch {
      return false;
    }
  });
  const posts = [];
  for (const folder of folders) {
    const perLocale = {};
    for (const lang of ['de', 'en']) {
      const path = join(blogContentRoot, folder, `${lang}.md`);
      if (!existsSync(path)) continue;
      const data = readFrontmatter(path);
      perLocale[lang] = {
        slug: data.slug ?? folder,
        publishedAt: data.publishedAt,
      };
    }
    for (const lang of ['de', 'en']) {
      const entry = perLocale[lang];
      if (!entry) continue;
      const otherLang = lang === 'de' ? 'en' : 'de';
      const other = perLocale[otherLang];
      posts.push({
        slug: entry.slug,
        lang,
        translationSlug: other ? other.slug : undefined,
        publishedAt: String(entry.publishedAt ?? ''),
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

  // x-default points at the German variant: pushup-stats.de is a German
  // domain and the SSR locale-redirect picks `de` whenever Accept-Language
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

function buildTrainingPlanRoutes(slugs) {
  return slugs.map((slug) => ({
    path: `/training-plans/${slug}`,
    changefreq: 'monthly',
    priority: '0.8',
  }));
}

function buildBlogRoutes(posts) {
  const bySlug = new Map(posts.map((p) => [`${p.lang}:${p.slug}`, p]));
  return posts.map((post) => {
    const pairKey = post.translationSlug
      ? `${post.lang === 'de' ? 'en' : 'de'}:${post.translationSlug}`
      : null;
    const pair = pairKey ? bySlug.get(pairKey) : undefined;
    const alternates = pair
      ? [
          {
            lang: 'de',
            path: `/blog/${post.lang === 'de' ? post.slug : pair.slug}`,
          },
          {
            lang: 'en',
            path: `/blog/${post.lang === 'en' ? post.slug : pair.slug}`,
          },
        ]
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

function generateSitemap(posts, planSlugs = []) {
  const blogRoutes = buildBlogRoutes(posts);
  const planRoutes = buildTrainingPlanRoutes(planSlugs);
  const allRoutes = [...staticRoutes, ...planRoutes, ...blogRoutes];
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
  const total = staticRoutes.length + planSlugs.length + posts.length;
  console.log(`sitemap.xml written (${total} URLs)`);
}

if (require.main === module) {
  main();
}

module.exports = {
  staticRoutes,
  extractBlogPosts,
  extractTrainingPlanSlugs,
  scanMarkdownBlogPosts,
  buildUrl,
  buildBlogRoutes,
  buildTrainingPlanRoutes,
  generateSitemap,
};
