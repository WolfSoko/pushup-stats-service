#!/usr/bin/env node
// Notifies IndexNow (Bing, Yandex, Seznam, Naver) about recently changed
// URLs instead of waiting to be crawled.
//
// Deliberately submits only URLs whose sitemap `lastmod` falls inside a
// recent window, not the whole sitemap: IndexNow is for *changed* URLs,
// and re-announcing 500 unchanged pages on every deploy is the kind of
// thing that gets a host ignored. Run it after a deploy that published
// or updated content.
//
//   node tools/src/submit-indexnow.js            # last 7 days
//   node tools/src/submit-indexnow.js --days=30
//   node tools/src/submit-indexnow.js --dry-run
const { readdirSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '../..');
const PUBLIC_DIR = resolve(ROOT, 'web/public');
const HOST = 'pushup-stats.com';
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const DEFAULT_DAYS = 7;
/** IndexNow caps a single submission at 10 000 URLs. */
const MAX_URLS = 10000;

/**
 * The key is a public file served from the domain root — that file is
 * what proves ownership, so it is not a secret and belongs in the repo.
 */
function readKey() {
  const candidates = readdirSync(PUBLIC_DIR).filter((f) =>
    /^[0-9a-f]{8,128}\.txt$/.test(f)
  );
  if (candidates.length !== 1) {
    throw new Error(
      `expected exactly one IndexNow key file in web/public, found ${candidates.length}`
    );
  }
  const file = candidates[0];
  const key = readFileSync(resolve(PUBLIC_DIR, file), 'utf-8').trim();
  if (`${key}.txt` !== file) {
    throw new Error(
      `IndexNow key file ${file} must contain exactly its own key; verification fails otherwise`
    );
  }
  return key;
}

/** `<loc>` values whose sibling `<lastmod>` is within `days`. */
function recentUrls(sitemapXml, days, now = new Date()) {
  const cutoff = new Date(now.getTime() - days * 86400000);
  const urls = [];
  for (const block of sitemapXml.split('<url>').slice(1)) {
    const loc = /<loc>([^<]+)<\/loc>/.exec(block)?.[1];
    const lastmod = /<lastmod>([^<]+)<\/lastmod>/.exec(block)?.[1];
    if (!loc || !lastmod) continue;
    const date = new Date(lastmod);
    if (Number.isNaN(date.getTime()) || date < cutoff) continue;
    urls.push(loc);
  }
  return [...new Set(urls)].slice(0, MAX_URLS);
}

function parseArgs(argv) {
  const days = Number(/--days=(\d+)/.exec(argv.join(' '))?.[1] ?? DEFAULT_DAYS);
  return { days, dryRun: argv.includes('--dry-run') };
}

async function main() {
  const { days, dryRun } = parseArgs(process.argv.slice(2));
  const key = readKey();
  const sitemap = readFileSync(resolve(PUBLIC_DIR, 'sitemap.xml'), 'utf-8');
  const urlList = recentUrls(sitemap, days);

  if (urlList.length === 0) {
    console.log(
      `IndexNow: no URL changed in the last ${days} day(s), nothing to submit`
    );
    return;
  }
  console.log(
    `IndexNow: ${urlList.length} URL(s) changed in the last ${days} day(s)`
  );
  if (dryRun) {
    for (const url of urlList.slice(0, 10)) console.log(`  ${url}`);
    if (urlList.length > 10) console.log(`  … and ${urlList.length - 10} more`);
    console.log('IndexNow: --dry-run, nothing submitted');
    return;
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key,
      keyLocation: `https://${HOST}/${key}.txt`,
      urlList,
    }),
  });
  // 200 and 202 both mean accepted; 422 means the key could not be
  // verified, which is the failure worth shouting about.
  console.log(`IndexNow: HTTP ${res.status} ${res.statusText}`);
  if (!res.ok) {
    console.error(await res.text());
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`IndexNow: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = { readKey, recentUrls, parseArgs, MAX_URLS, DEFAULT_DAYS };
