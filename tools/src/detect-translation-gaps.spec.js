const { execFileSync } = require('node:child_process');
const {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');

const SCRIPT = resolve(__dirname, 'detect-translation-gaps.mjs');
const REPO_ROOT = resolve(__dirname, '..', '..');
const LOCALE_CONST = resolve(REPO_ROOT, 'web/src/server-locale-redirect.ts');

function runScript({ extraEnv = {}, args = [] } = {}) {
  const sandbox = mkdtempSync(join(tmpdir(), 'detect-gaps-'));
  try {
    const reportPath = join(sandbox, 'report.md');
    const summaryPath = join(sandbox, 'summary.env');
    const jsonPath = join(sandbox, 'gaps.json');
    const result = execFileSync(
      'node',
      [
        SCRIPT,
        '--report',
        reportPath,
        '--summary',
        summaryPath,
        '--json',
        jsonPath,
        ...args,
      ],
      { env: { ...process.env, ...extraEnv }, stdio: 'pipe' }
    );
    return {
      report: readFileSync(reportPath, 'utf-8'),
      summary: readFileSync(summaryPath, 'utf-8'),
      gaps: JSON.parse(readFileSync(jsonPath, 'utf-8')),
      stderr: result.toString(),
    };
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

// Build an isolated sandbox tree so the detector exercises every gap
// branch deterministically, regardless of how complete the real repo's
// translations happen to be at test time.
function buildFixture({
  sourceOnlyBlogFolders = [],
  wikiArticleIds = [],
  wikiExerciseArticleIds = [],
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'detect-gaps-fixture-'));
  const localeDir = join(root, 'web/src/locale');
  const blogDir = join(root, 'content/blog');
  const wikiDir = join(root, 'content/wiki/pushup-types');
  const wikiExercisesDir = join(root, 'content/wiki/exercises');
  const localeConstPath = join(root, 'web/src/server-locale-redirect.ts');
  mkdirSync(localeDir, { recursive: true });
  mkdirSync(join(blogDir, 'mein-post'), { recursive: true });
  mkdirSync(wikiDir, { recursive: true });
  mkdirSync(join(root, 'web/src'), { recursive: true });

  writeFileSync(
    localeConstPath,
    "export const SUPPORTED_LOCALES = ['de', 'en', 'fr', 'la'] as const;\n"
  );
  writeFileSync(
    join(localeDir, 'messages.xlf'),
    [
      '<?xml version="1.0" encoding="UTF-8" ?>',
      '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">',
      '  <file id="ngi18n" original="ng.template">',
      '    <unit id="needs.translation">',
      '      <segment>',
      '        <source>Hallo Welt</source>',
      '      </segment>',
      '    </unit>',
      '  </file>',
      '</xliff>',
      '',
    ].join('\n')
  );
  // la has an initial-state unit whose target == source → must be flagged.
  writeFileSync(
    join(localeDir, 'messages.la.xlf'),
    [
      '<?xml version="1.0" encoding="UTF-8" ?>',
      '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="la">',
      '  <file id="ngi18n" original="ng.template">',
      '    <unit id="needs.translation">',
      '      <segment state="initial">',
      '        <source>Hallo Welt</source>',
      '        <target>Hallo Welt</target>',
      '      </segment>',
      '    </unit>',
      // German source was edited: the old translation is deliberately kept
      // so the page does not fall back to German, and only the state flips.
      '    <unit id="source.changed">',
      '      <segment state="initial">',
      '        <source>Neuer deutscher Text</source>',
      '        <target>Vetus textus</target>',
      '      </segment>',
      '    </unit>',
      '  </file>',
      '</xliff>',
      '',
    ].join('\n')
  );
  // en has a real translation → must NOT be flagged.
  writeFileSync(
    join(localeDir, 'messages.en.xlf'),
    [
      '<?xml version="1.0" encoding="UTF-8" ?>',
      '<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="en">',
      '  <file id="ngi18n" original="ng.template">',
      '    <unit id="needs.translation">',
      '      <segment state="translated">',
      '        <source>Hallo Welt</source>',
      '        <target>Hello world</target>',
      '      </segment>',
      '    </unit>',
      '  </file>',
      '</xliff>',
      '',
    ].join('\n')
  );
  // fr file missing entirely → xliff-file-missing gap.

  writeFileSync(join(blogDir, 'mein-post/de.md'), '---\ntitle: Hallo\n---\n');
  writeFileSync(join(blogDir, 'mein-post/en.md'), '---\ntitle: Hello\n---\n');
  // fr.md and la.md missing → blog gaps for both.

  // Brand-new articles: the German source and nothing else, so every
  // target locale must be flagged. Opt-in per fixture — the baseline
  // tree deliberately keeps 'en' fully covered, and an article missing
  // its en.md would blunt that assertion.
  for (const folder of sourceOnlyBlogFolders) {
    mkdirSync(join(blogDir, folder), { recursive: true });
    writeFileSync(
      join(blogDir, `${folder}/de.md`),
      `---\ntitle: ${folder}\n---\n`
    );
  }

  writeFileSync(join(wikiDir, 'arch.de.md'), '---\nname: Bogen\n---\n');
  writeFileSync(join(wikiDir, 'arch.en.md'), '---\nname: Arch\n---\n');
  // fr and la wiki files missing.

  // Wiki entries whose German source has grown a long-form body while a
  // sibling locale still holds frontmatter only. Opt-in per fixture: the
  // baseline tree keeps 'en' fully covered, and a body gap would blunt
  // that assertion.
  for (const id of wikiArticleIds) {
    writeFileSync(
      join(wikiDir, `${id}.de.md`),
      `---\nname: ${id}\n---\n\n<h2>Ausführung</h2>\n<p>Langtext.</p>\n`
    );
    writeFileSync(join(wikiDir, `${id}.en.md`), `---\nname: ${id}\n---\n`);
    writeFileSync(join(wikiDir, `${id}.fr.md`), `---\nname: ${id}\n---\n`);
    writeFileSync(join(wikiDir, `${id}.la.md`), `---\nname: ${id}\n---\n`);
  }

  // The exercise wiki lives beside the push-up types and is resolved from
  // REPO_ROOT, so the fixture must create it explicitly to be seen.
  if (wikiExerciseArticleIds.length > 0) {
    mkdirSync(wikiExercisesDir, { recursive: true });
    for (const id of wikiExerciseArticleIds) {
      writeFileSync(
        join(wikiExercisesDir, `${id}.de.md`),
        `---\nname: ${id}\n---\n\n<h2>Ausführung</h2>\n<p>Langtext.</p>\n`
      );
      writeFileSync(
        join(wikiExercisesDir, `${id}.en.md`),
        `---\nname: ${id}\n---\n`
      );
    }
  }

  return {
    root,
    env: {
      DETECT_GAPS_REPO_ROOT: root,
      DETECT_GAPS_LOCALE_DIR: localeDir,
      DETECT_GAPS_BLOG_DIR: blogDir,
      DETECT_GAPS_WIKI_DIR: wikiDir,
      DETECT_GAPS_LOCALE_CONST_FILE: localeConstPath,
    },
  };
}

describe('detect-translation-gaps', () => {
  describe('against the real repo', () => {
    it('returns a structured report and summary env file', () => {
      const { report, summary, gaps } = runScript();
      expect(report).toContain('# Translation gaps');
      expect(summary).toMatch(/^has_gaps=(true|false)$/m);
      expect(summary).toMatch(/^gap_count=\d+$/m);
      expect(summary).toMatch(/^xliff_count=\d+$/m);
      expect(summary).toMatch(/^blog_count=\d+$/m);
      expect(summary).toMatch(/^wiki_count=\d+$/m);
      expect(Array.isArray(gaps.gaps)).toBe(true);
      expect(gaps.locales).toEqual(
        expect.arrayContaining(['en', 'fr', 'es', 'it', 'nl', 'el', 'no', 'zh'])
      );
      // de is the source locale — never a target.
      expect(gaps.locales).not.toContain('de');
    });

    it('respects --locales filter and excludes the source locale', () => {
      const { gaps } = runScript({ args: ['--locales', 'fr,de,it'] });
      expect(gaps.locales.sort()).toEqual(['fr', 'it']);
    });

    it('reports an empty summary when only the source locale is requested', () => {
      const { summary } = runScript({ args: ['--locales', 'de'] });
      expect(summary).toContain('has_gaps=false');
      expect(summary).toContain('gap_count=0');
    });

    it('rejects unsupported locales loudly', () => {
      let threw = false;
      try {
        runScript({ args: ['--locales', 'xx,fr'] });
      } catch (err) {
        threw = true;
        expect(err.stderr.toString()).toMatch(/Unsupported locale\(s\): xx/);
      }
      expect(threw).toBe(true);
    });

    it('locale const file is the source of truth for SUPPORTED_LOCALES', () => {
      // Guards against drift: if someone renames or deletes the file the
      // detector should fail loudly, not silently fall back to a hard-
      // coded list.
      expect(existsSync(LOCALE_CONST)).toBe(true);
      const src = readFileSync(LOCALE_CONST, 'utf-8');
      expect(src).toMatch(/export const SUPPORTED_LOCALES\s*=\s*\[/);
    });
  });

  describe('against a sandbox fixture', () => {
    let fixture;
    beforeAll(() => {
      fixture = buildFixture();
    });
    afterAll(() => {
      rmSync(fixture.root, { recursive: true, force: true });
    });

    it('flags xliff units whose target equals source as a gap', () => {
      const { gaps } = runScript({ extraEnv: fixture.env });
      const xliffUnitGaps = gaps.gaps.filter((g) => g.kind === 'xliff-unit');
      expect(xliffUnitGaps).toEqual([
        expect.objectContaining({
          locale: 'la',
          kind: 'xliff-unit',
          unitId: 'needs.translation',
          source: 'Hallo Welt',
        }),
        expect.objectContaining({
          locale: 'la',
          kind: 'xliff-unit',
          unitId: 'source.changed',
          source: 'Neuer deutscher Text',
        }),
      ]);
    });

    it('flags an initial unit even when it still carries a usable target', () => {
      // given — the German source changed; the old translation is kept so
      // the page does not fall back to German, which makes it invisible to
      // a target-vs-source comparison.
      // when
      const { gaps } = runScript({ extraEnv: fixture.env });

      // then
      expect(gaps.gaps).toContainEqual(
        expect.objectContaining({
          locale: 'la',
          kind: 'xliff-unit',
          unitId: 'source.changed',
          source: 'Neuer deutscher Text',
        })
      );
    });

    it('reports missing xliff files, blog files, and wiki files', () => {
      const { gaps } = runScript({ extraEnv: fixture.env });
      const kinds = gaps.gaps.map((g) => `${g.kind}:${g.locale}`).sort();
      expect(kinds).toEqual(
        expect.arrayContaining([
          'xliff-file-missing:fr',
          'xliff-unit:la',
          'blog:fr',
          'blog:la',
          'wiki:fr',
          'wiki:la',
        ])
      );
      // en has full coverage in the fixture — no gaps reported for it.
      expect(kinds.filter((k) => k.endsWith(':en'))).toEqual([]);
    });
  });

  describe('against a fixture whose wiki source grew a long-form body', () => {
    let fixture;
    beforeAll(() => {
      fixture = buildFixture({ wikiArticleIds: ['stuetz'] });
    });
    afterAll(() => {
      rmSync(fixture.root, { recursive: true, force: true });
    });

    it('flags every locale whose file exists but has no body', () => {
      // when
      const { gaps } = runScript({ extraEnv: fixture.env });

      // then — the file exists, so a plain existence check sees nothing;
      // without this the page would stay noindexed forever.
      const articleGaps = gaps.gaps
        .filter((g) => g.kind === 'wiki-article')
        .map((g) => `${g.id}:${g.locale}`)
        .sort();
      expect(articleGaps).toEqual(['stuetz:en', 'stuetz:fr', 'stuetz:la']);
    });

    it('does not flag the entry that is frontmatter-only on both sides', () => {
      // given — `arch` has no body in any locale, so nothing is missing
      // when
      const { gaps } = runScript({ extraEnv: fixture.env });

      // then
      const archArticleGaps = gaps.gaps.filter(
        (g) => g.kind === 'wiki-article' && g.id === 'arch'
      );
      expect(archArticleGaps).toEqual([]);
    });

    it('counts body gaps separately in the summary env file', () => {
      // when
      const { summary } = runScript({ extraEnv: fixture.env });

      // then
      expect(summary).toMatch(/^wiki_article_count=3$/m);
    });
  });

  describe('against a fixture with an exercise-wiki body', () => {
    let fixture;
    beforeAll(() => {
      fixture = buildFixture({ wikiExerciseArticleIds: ['plank.standard'] });
    });
    afterAll(() => {
      rmSync(fixture.root, { recursive: true, force: true });
    });

    it('scans content/wiki/exercises, not just the push-up types', () => {
      // given — this directory was never scanned before, so its 40 entries
      // were invisible to the translations routine.
      // when
      const { gaps } = runScript({ extraEnv: fixture.env });

      // then
      const articleGaps = gaps.gaps
        .filter((g) => g.kind === 'wiki-article')
        .map((g) => `${g.id}:${g.locale}`);
      expect(articleGaps).toContain('plank.standard:en');
    });

    it('keeps the dotted exercise id intact in the reported path', () => {
      // when
      const { gaps } = runScript({ extraEnv: fixture.env });

      // then
      const gap = gaps.gaps.find(
        (g) => g.kind === 'wiki-article' && g.id === 'plank.standard'
      );
      expect(gap.path).toContain('content/wiki/exercises/plank.standard.en.md');
    });
  });

  describe('against a fixture holding a brand-new blog article', () => {
    let fixture;
    beforeAll(() => {
      fixture = buildFixture({ sourceOnlyBlogFolders: ['neuer-artikel'] });
    });
    afterAll(() => {
      rmSync(fixture.root, { recursive: true, force: true });
    });

    it('should flag every target locale when a brand-new blog article has only de.md', () => {
      // given — 'neuer-artikel' carries just its German source, the shape
      // a freshly written article has before any translation exists

      // when
      const { gaps } = runScript({ extraEnv: fixture.env });

      // then
      const newArticleGaps = gaps.gaps.filter(
        (g) => g.kind === 'blog' && g.folder === 'neuer-artikel'
      );
      expect(newArticleGaps.map((g) => g.locale).sort()).toEqual([
        'en',
        'fr',
        'la',
      ]);
      // sourcePath must point back to the German source
      for (const gap of newArticleGaps) {
        expect(gap.sourcePath).toMatch(/neuer-artikel\/de\.md$/);
      }
    });
  });
});
