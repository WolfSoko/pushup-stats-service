#!/usr/bin/env node
// Generates sitemap.xml from route + blog-post definitions.
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '../..');
const BASE_URL = 'https://pushup-stats.de';
const LOCALES = ['de', 'en'];

const staticRoutes = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/blog', changefreq: 'weekly', priority: '0.9' },
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

  const hreflangLinks = alts
    .map(
      ({ lang, path: altPath }) =>
        `    <xhtml:link rel="alternate" hreflang="${lang}" href="${BASE_URL}/${lang}${altPath}"/>`
    )
    .join('\n');

  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';

  return `  <url>
    <loc>${loc}</loc>${lastmodTag}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${hreflangLinks}
  </url>`;
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

function generateSitemap(posts) {
  const blogRoutes = buildBlogRoutes(posts);
  const allRoutes = [...staticRoutes, ...blogRoutes];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${allRoutes.map(buildUrl).join('\n')}
</urlset>
`;
}

function main() {
  const posts = readBlogPosts();
  const xml = generateSitemap(posts);
  const outPath = resolve(ROOT, 'web/public/sitemap.xml');
  writeFileSync(outPath, xml, 'utf-8');
  const total = staticRoutes.length + posts.length;
  console.log(`sitemap.xml written (${total} URLs)`);
}

if (require.main === module) {
  main();
}

module.exports = {
  staticRoutes,
  extractBlogPosts,
  buildUrl,
  buildBlogRoutes,
  generateSitemap,
};
