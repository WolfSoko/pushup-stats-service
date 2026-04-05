#!/usr/bin/env node
/**
 * Generates sitemap.xml from the canonical route + blog-post definitions.
 *
 * Run:  node tools/src/generate-sitemap.mjs
 * Or:   pnpm nx run tools:generate-sitemap
 *
 * The script reads blog post slugs from blog-posts.data.ts so the sitemap
 * stays in sync automatically when posts are added or removed.
 *
 * All URLs are generated with /de and /en locale prefixes (matching the
 * deployed app structure) and include hreflang alternate links.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const BASE_URL = 'https://pushup-stats.de';
const LOCALES = ['de', 'en'];

// ── Static public routes (paths WITHOUT locale prefix) ──────────────────
// Keep this list in sync with app.routes.ts (public, non-guarded routes).
const staticRoutes = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/blog', changefreq: 'weekly', priority: '0.9' },
  { path: '/leaderboard', changefreq: 'daily', priority: '0.7' },
  { path: '/impressum', changefreq: 'yearly', priority: '0.3' },
  { path: '/datenschutz', changefreq: 'yearly', priority: '0.3' },
  { path: '/login', changefreq: 'monthly', priority: '0.5' },
  { path: '/register', changefreq: 'monthly', priority: '0.5' },
];

// ── Extract blog slugs from source ─────────────────────────────────────
function extractBlogSlugs() {
  const blogDataPath = resolve(ROOT, 'web/src/app/blog/blog-posts.data.ts');
  const source = readFileSync(blogDataPath, 'utf-8');

  // Match all slug values – only German slugs (de blog posts define the canonical URL)
  const slugs = [];
  const regex = /slug:\s*'([^']+)',\s*\n\s*lang:\s*'de'/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    slugs.push(match[1]);
  }
  return slugs;
}

// ── Build XML ───────────────────────────────────────────────────────────
function buildUrl({ path, changefreq, priority }) {
  // Normalise: '/' -> '', '/blog' -> '/blog'
  const suffix = path === '/' ? '' : path;

  const loc = `${BASE_URL}/de${suffix}`;
  const hreflangLinks = LOCALES.map(
    (lang) =>
      `    <xhtml:link rel="alternate" hreflang="${lang}" href="${BASE_URL}/${lang}${suffix}"/>`
  ).join('\n');

  return `  <url>
    <loc>${loc}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${hreflangLinks}
  </url>`;
}

function generate() {
  const slugs = extractBlogSlugs();
  const blogRoutes = slugs.map((slug) => ({
    path: `/blog/${slug}`,
    changefreq: 'monthly',
    priority: '0.8',
  }));

  const allRoutes = [...staticRoutes, ...blogRoutes];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${allRoutes.map(buildUrl).join('\n')}
</urlset>
`;

  const outPath = resolve(ROOT, 'web/public/sitemap.xml');
  writeFileSync(outPath, xml, 'utf-8');
  console.log(`✔ sitemap.xml written (${allRoutes.length} URLs)`);
}

generate();
