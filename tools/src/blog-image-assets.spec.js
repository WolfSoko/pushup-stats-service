const { existsSync, readdirSync, readFileSync, statSync } = require('node:fs');
const { join, resolve } = require('node:path');

const ROOT = resolve(__dirname, '../..');
const BLOG_DIR = resolve(ROOT, 'content/blog');
const PUBLIC_DIR = resolve(ROOT, 'web/public');
const SITE_ORIGIN = 'https://pushup-stats.com';

function listBlogMarkdownFiles() {
  const files = [];
  for (const folder of readdirSync(BLOG_DIR)) {
    const dir = join(BLOG_DIR, folder);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir)) {
      if (file.endsWith('.md')) files.push(join(dir, file));
    }
  }
  return files;
}

function selfHostedAssetPaths(source) {
  const paths = new Set();
  const srcRe = /<img\b[^>]*\ssrc="([^"]+)"/g;
  for (const match of source.matchAll(srcRe)) paths.add(match[1]);
  const heroRe = /^heroImage:\s*'?([^'\n]+)'?\s*$/m;
  const hero = heroRe.exec(source)?.[1];
  if (hero?.startsWith(`${SITE_ORIGIN}/`)) {
    paths.add(hero.slice(SITE_ORIGIN.length));
  }
  return [...paths].filter((p) => p.startsWith('/assets/'));
}

/**
 * Blog posts may embed infographics and hero images that live in
 * `web/public/assets/blog/`. A typo in the path or a forgotten asset
 * would ship a broken image to every locale of that post, so every
 * self-hosted reference must resolve to a file that is checked in.
 */
describe('blog image assets', () => {
  const files = listBlogMarkdownFiles();

  it('should find at least one blog markdown file', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f.slice(ROOT.length + 1), f]))(
    'should ship every self-hosted image referenced by %s',
    (_label, file) => {
      // given
      const source = readFileSync(file, 'utf-8');

      // when
      const paths = selfHostedAssetPaths(source);

      // then
      for (const assetPath of paths) {
        expect({
          assetPath,
          exists: existsSync(join(PUBLIC_DIR, assetPath)),
        }).toEqual({
          assetPath,
          exists: true,
        });
      }
    }
  );

  it.each(files.map((f) => [f.slice(ROOT.length + 1), f]))(
    'should give every inline image in %s a non-empty alt text',
    (_label, file) => {
      // given
      const source = readFileSync(file, 'utf-8');

      // when
      const images = [...source.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);

      // then
      for (const tag of images) {
        const alt = /\salt="([^"]*)"/.exec(tag)?.[1] ?? '';
        expect({ tag, hasAlt: alt.trim().length > 0 }).toEqual({
          tag,
          hasAlt: true,
        });
      }
    }
  );
});
