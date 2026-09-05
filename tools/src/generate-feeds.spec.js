const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const {
  buildFeed,
  collectPosts,
  escapeXml,
  toRfc822,
  MAX_ITEMS,
} = require('./generate-feeds');
const { LOCALES } = require('./generate-sitemap');

const ROOT = resolve(__dirname, '../..');

/**
 * Minimal well-formedness check: every opened tag is closed in order and
 * nothing escapes as raw markup. The repo has no XML parser dependency
 * and the sitemap spec asserts on strings too, so this stays in kind —
 * it catches the failure that actually matters here (unescaped `&` or
 * `<` from post copy breaking the document), not schema validity.
 */
function assertWellFormed(xml) {
  const stack = [];
  const tag = /<(\/?)([A-Za-z][\w:.-]*)([^>]*?)(\/?)>/g;
  let match;
  while ((match = tag.exec(xml)) !== null) {
    const [, closing, name, , selfClosing] = match;
    if (selfClosing === '/') continue;
    if (closing === '/') {
      expect(stack.pop()).toBe(name);
    } else {
      stack.push(name);
    }
  }
  expect(stack).toEqual([]);
  // A stray `&` that is not the start of an entity is the classic way a
  // feed breaks in readers.
  expect(xml).not.toMatch(/&(?!(amp|lt|gt|quot|apos|#\d+);)/);
}

describe('toRfc822', () => {
  it('should convert a frontmatter date to the format RSS readers sort on', () => {
    // then
    expect(toRfc822('2026-09-02')).toBe('Wed, 02 Sep 2026 08:00:00 GMT');
  });

  it('should fall back instead of emitting an invalid date', () => {
    // given — an unparsable date would scramble reader ordering
    // then
    expect(toRfc822('kein-datum')).toBe(new Date(0).toUTCString());
  });
});

describe('escapeXml', () => {
  it.each([
    ['Push & Pull', 'Push &amp; Pull'],
    ['<script>', '&lt;script&gt;'],
    ['"zitat"', '&quot;zitat&quot;'],
  ])('should escape %s', (input, expected) => {
    expect(escapeXml(input)).toBe(expected);
  });
});

describe('buildFeed', () => {
  const post = {
    slug: 'liegestuetze-atmung',
    title: 'Atmung & Technik',
    description: 'Ein <Test>',
    publishedAt: '2026-04-28',
    heroImage: 'https://pushup-stats.com/assets/blog/hero.jpg',
  };

  it('should produce parsable XML even with markup in the copy', () => {
    // when
    const xml = buildFeed('de', [post]);

    // then
    assertWellFormed(xml);
    expect(xml).toContain('Atmung &amp; Technik');
    expect(xml).not.toContain('<Test>');
  });

  it('should point items at the locale the feed belongs to', () => {
    // when
    const xml = buildFeed('it', [post]);

    // then
    expect(xml).toContain(
      '<link>https://pushup-stats.com/it/blog/liegestuetze-atmung</link>'
    );
    expect(xml).toContain('<language>it</language>');
    expect(xml).toContain('https://pushup-stats.com/it/feed.xml');
  });

  it('should stay valid with no posts at all', () => {
    // given — a brand-new locale before any article is translated
    // when
    const xml = buildFeed('no', []);

    // then
    assertWellFormed(xml);
    expect(xml).not.toContain('<item>');
  });
});

describe('collectPosts', () => {
  it('should return the newest posts first', () => {
    // when
    const posts = collectPosts('de');

    // then
    expect(posts.length).toBeGreaterThan(0);
    const dates = posts.map((p) => p.publishedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('should cap the feed length', () => {
    // then — readers do not need the full archive
    expect(collectPosts('de').length).toBeLessThanOrEqual(MAX_ITEMS);
  });
});

describe('the committed feed artifacts', () => {
  it.each(LOCALES.map((lang) => [lang]))(
    'should ship a parsable feed.%s.xml',
    (lang) => {
      // given
      const path = resolve(ROOT, `web/public/feed.${lang}.xml`);

      // then
      expect(existsSync(path)).toBe(true);
      assertWellFormed(readFileSync(path, 'utf-8'));
    }
  );
});
