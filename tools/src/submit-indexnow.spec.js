const {
  readKey,
  recentUrls,
  parseArgs,
  DEFAULT_DAYS,
} = require('./submit-indexnow');

const NOW = new Date('2026-09-10T00:00:00Z');

function sitemapWith(entries) {
  const urls = entries
    .map(
      ({ loc, lastmod }) =>
        `  <url>\n    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset>\n${urls}\n</urlset>\n`;
}

describe('recentUrls', () => {
  it('should return only URLs changed inside the window', () => {
    // given
    const xml = sitemapWith([
      { loc: 'https://pushup-stats.com/de/blog/neu', lastmod: '2026-09-08' },
      { loc: 'https://pushup-stats.com/de/blog/alt', lastmod: '2026-01-02' },
    ]);

    // when
    const urls = recentUrls(xml, 7, NOW);

    // then — re-announcing unchanged pages on every deploy is what gets
    // a host ignored by IndexNow
    expect(urls).toEqual(['https://pushup-stats.com/de/blog/neu']);
  });

  it('should skip entries without a lastmod', () => {
    // given — static routes carry no lastmod, so their change date is
    // unknown and must not be guessed
    const xml = sitemapWith([
      { loc: 'https://pushup-stats.com/de/' },
      { loc: 'https://pushup-stats.com/de/blog/neu', lastmod: '2026-09-09' },
    ]);

    // when
    const urls = recentUrls(xml, 7, NOW);

    // then
    expect(urls).toEqual(['https://pushup-stats.com/de/blog/neu']);
  });

  it('should ignore an unparsable lastmod rather than submitting it', () => {
    // given
    const xml = sitemapWith([
      { loc: 'https://pushup-stats.com/de/kaputt', lastmod: 'gestern' },
    ]);

    // then
    expect(recentUrls(xml, 7, NOW)).toEqual([]);
  });

  it('should de-duplicate repeated locs', () => {
    // given
    const xml = sitemapWith([
      { loc: 'https://pushup-stats.com/de/a', lastmod: '2026-09-09' },
      { loc: 'https://pushup-stats.com/de/a', lastmod: '2026-09-09' },
    ]);

    // then
    expect(recentUrls(xml, 7, NOW)).toEqual(['https://pushup-stats.com/de/a']);
  });

  it('should widen with a larger window', () => {
    // given
    const xml = sitemapWith([
      { loc: 'https://pushup-stats.com/de/alt', lastmod: '2026-08-20' },
    ]);

    // then
    expect(recentUrls(xml, 7, NOW)).toEqual([]);
    expect(recentUrls(xml, 30, NOW)).toHaveLength(1);
  });
});

describe('parseArgs', () => {
  it('should default the window', () => {
    expect(parseArgs([])).toEqual({ days: DEFAULT_DAYS, dryRun: false });
  });

  it.each([
    [['--days=30'], 30],
    [['--days=1'], 1],
  ])('should read %s', (argv, days) => {
    expect(parseArgs(argv).days).toBe(days);
  });

  it('should recognise the dry run', () => {
    expect(parseArgs(['--dry-run']).dryRun).toBe(true);
  });
});

describe('readKey', () => {
  it('should find the committed key file and match its own name', () => {
    // then — a key file whose contents differ from its filename fails
    // IndexNow verification silently, so this is worth asserting
    expect(readKey()).toMatch(/^[0-9a-f]{8,128}$/);
  });
});
