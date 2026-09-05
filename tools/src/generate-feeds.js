#!/usr/bin/env node
// Generates one RSS 2.0 feed per locale from content/blog/**.
//
// Per locale, not one German feed: the blog ships all nine locales and
// Italy is currently the strongest market, so a single feed would be
// useless to most readers. Files land as `feed.<lang>.xml`; `server.ts`
// maps `/<locale>/feed.xml` and the bare `/feed.xml` onto them, so the
// URLs readers see stay conventional.
const {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} = require('node:fs');
const { join, resolve } = require('node:path');
const { parse: parseYaml } = require('yaml');

const { LOCALES } = require('./generate-sitemap');

const ROOT = resolve(__dirname, '../..');
const BASE_URL = 'https://pushup-stats.com';
const BLOG_DIR = resolve(ROOT, 'content/blog');
const OUT_DIR = resolve(ROOT, 'web/public');
/** Feed readers do not need the full archive; newest first. */
const MAX_ITEMS = 20;

/** Feed channel title/description per locale, source locale first. */
const CHANNEL = {
  de: ['Pushup Tracker Blog', 'Training, Technik und Hintergrundwissen.'],
  en: ['Pushup Tracker Blog', 'Training, technique and background reading.'],
  fr: ['Pushup Tracker Blog', 'Entraînement, technique et connaissances.'],
  es: ['Pushup Tracker Blog', 'Entrenamiento, técnica y conocimientos.'],
  it: ['Pushup Tracker Blog', 'Allenamento, tecnica e approfondimenti.'],
  nl: ['Pushup Tracker Blog', 'Training, techniek en achtergrond.'],
  el: ['Pushup Tracker Blog', 'Προπόνηση, τεχνική και γνώση.'],
  no: ['Pushup Tracker Blog', 'Trening, teknikk og bakgrunnskunnskap.'],
  zh: ['Pushup Tracker Blog', '训练、技术与背景知识。'],
};

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function readFrontmatter(path) {
  const source = readFileSync(path, 'utf-8');
  const afterOpen = source.indexOf('\n', 3) + 1;
  const closeIdx = source.indexOf('\n---', afterOpen);
  if (closeIdx === -1) return null;
  return parseYaml(source.slice(afterOpen, closeIdx)) ?? null;
}

/**
 * Posts of one locale, newest first. Unlike the sitemap scanner this
 * needs `title` and `description` too, which a feed item cannot omit.
 */
function collectPosts(lang) {
  if (!existsSync(BLOG_DIR)) return [];
  const posts = [];
  for (const folder of readdirSync(BLOG_DIR).sort()) {
    const dir = join(BLOG_DIR, folder);
    if (!statSync(dir).isDirectory()) continue;
    const file = join(dir, `${lang}.md`);
    if (!existsSync(file)) continue;
    const data = readFrontmatter(file);
    if (!data?.title || !data?.publishedAt) continue;
    posts.push({
      slug: String(data.slug ?? folder),
      title: String(data.title),
      description: String(data.description ?? ''),
      publishedAt: String(data.publishedAt),
      heroImage: data.heroImage ? String(data.heroImage) : null,
    });
  }
  return posts
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, MAX_ITEMS);
}

/**
 * `publishedAt` is a plain `YYYY-MM-DD`. RFC 822 is what RSS wants, and
 * readers sort on it, so an unparsable date would scramble the order.
 */
function toRfc822(isoDate) {
  const date = new Date(`${isoDate}T08:00:00Z`);
  return Number.isNaN(date.getTime())
    ? new Date(0).toUTCString()
    : date.toUTCString();
}

function buildFeed(lang, posts) {
  const [title, description] = CHANNEL[lang] ?? CHANNEL.de;
  const self = `${BASE_URL}/${lang}/feed.xml`;
  const items = posts
    .map((post) => {
      const link = `${BASE_URL}/${lang}/blog/${post.slug}`;
      const image = post.heroImage
        ? `\n      <enclosure url="${escapeXml(post.heroImage)}" type="image/jpeg" length="0"/>`
        : '';
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${toRfc822(post.publishedAt)}</pubDate>
      <description>${escapeXml(post.description)}</description>${image}
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${BASE_URL}/${lang}/blog</link>
    <description>${escapeXml(description)}</description>
    <language>${lang}</language>
    <atom:link href="${self}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

function main() {
  const summary = [];
  for (const lang of LOCALES) {
    const posts = collectPosts(lang);
    writeFileSync(
      join(OUT_DIR, `feed.${lang}.xml`),
      buildFeed(lang, posts),
      'utf-8'
    );
    summary.push(`${lang}=${posts.length}`);
  }
  console.log(
    `feeds written (${LOCALES.length} locales) | ${summary.join(' | ')}`
  );
}

if (require.main === module) main();

module.exports = { buildFeed, collectPosts, toRfc822, escapeXml, MAX_ITEMS };
