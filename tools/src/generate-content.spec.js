const { execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');

const GENERATOR = resolve(__dirname, 'generate-content.mjs');

// `generate-content.mjs` is ESM; run `loadBlogPosts` in a throwaway node
// subprocess (mirrors the execFileSync pattern in
// detect-translation-gaps.spec.js) rather than importing it into this
// CommonJS Jest test, since `tools/jest.config.cjs` only transforms
// `.ts`/`.js`.
function runLoadBlogPosts(contentRoot) {
  const script = `
    import { loadBlogPosts } from ${JSON.stringify(GENERATOR)};
    process.stdout.write(JSON.stringify(loadBlogPosts(${JSON.stringify(contentRoot)})));
  `;
  const out = execFileSync('node', ['--input-type=module', '-e', script], {
    encoding: 'utf-8',
  });
  return JSON.parse(out);
}

function writePost(contentRoot, folder, lang, frontmatter) {
  const dir = join(contentRoot, 'blog', folder);
  mkdirSync(dir, { recursive: true });
  const yaml = Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n');
  writeFileSync(join(dir, `${lang}.md`), `---\n${yaml}\n---\n\nBody text.\n`);
}

describe('loadBlogPosts', () => {
  let contentRoot;

  beforeEach(() => {
    contentRoot = mkdtempSync(join(tmpdir(), 'generate-content-'));
  });

  afterEach(() => {
    rmSync(contentRoot, { recursive: true, force: true });
  });

  it('maps every sibling locale to its own slug when a post has more than two translations', () => {
    // given — a folder with 3 locale files, each with a different slug
    // (regression: the old `translationSlug` field was only ever set
    // for exactly-2-locale folders, so posts translated into 3+
    // locales got no cross-locale slug mapping at all).
    writePost(contentRoot, 'liegestuetze-fehler', 'de', {
      slug: 'liegestuetze-fehler',
      title: 'Titel',
      description: 'Beschreibung',
      publishedAt: '2026-04-30',
    });
    writePost(contentRoot, 'liegestuetze-fehler', 'en', {
      slug: 'pushup-mistakes',
      title: 'Title',
      description: 'Description',
      publishedAt: '2026-04-30',
    });
    writePost(contentRoot, 'liegestuetze-fehler', 'zh', {
      slug: 'pushup-mistakes',
      title: '标题',
      description: '描述',
      publishedAt: '2026-04-30',
    });

    // when
    const posts = runLoadBlogPosts(contentRoot);
    const zhPost = posts.find((post) => post.lang === 'zh');

    // then
    expect(zhPost.alternateSlugs).toEqual({
      de: 'liegestuetze-fehler',
      en: 'pushup-mistakes',
      zh: 'pushup-mistakes',
    });
  });

  it('maps to itself when a post has no sibling translations', () => {
    // given
    writePost(contentRoot, 'solo-post', 'de', {
      slug: 'solo-post',
      title: 'Titel',
      description: 'Beschreibung',
      publishedAt: '2026-04-30',
    });

    // when
    const posts = runLoadBlogPosts(contentRoot);

    // then
    expect(posts[0].alternateSlugs).toEqual({ de: 'solo-post' });
  });
});
