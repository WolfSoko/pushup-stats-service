#!/usr/bin/env node
// Generates sitemap.xml from route + blog-post definitions.
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

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
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const LOCALES = readSupportedLocales();

const staticRoutes = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/blog', changefreq: 'weekly', priority: '0.9' },
  { path: '/training-plans', changefreq: 'weekly', priority: '0.9' },
  { path: '/leaderboard', changefreq: 'daily', priority: '0.7' },
  { path: '/impressum', changefreq: 'yearly', priority: '0.3' },
  { path: '/datenschutz', changefreq: 'yearly', priority: '0.3' },
];

function extractBlogPosts(source) {
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

function readBlogPosts() {
  const blogDataPath = resolve(ROOT, 'web/src/app/blog/blog-posts.data.ts');
  let source;
  try {
    source = readFileSync(blogDataPath, 'utf-8');
  } catch (err) {
    console.error(`Failed to read blog-posts.data.ts: ${err.message}`);
    return [];
  }
  const posts = extractBlogPosts(source);
  if (posts.length === 0) {
    console.warn('No blog posts found - verify blog-posts.data.ts format');
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
  buildUrl,
  buildBlogRoutes,
  buildTrainingPlanRoutes,
  generateSitemap,
};
