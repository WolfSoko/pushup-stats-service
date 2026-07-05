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
function buildFixture() {
  const root = mkdtempSync(join(tmpdir(), 'detect-gaps-fixture-'));
  const localeDir = join(root, 'web/src/locale');
  const blogDir = join(root, 'content/blog');
  const wikiDir = join(root, 'content/wiki/pushup-types');
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

  writeFileSync(join(wikiDir, 'arch.de.md'), '---\nname: Bogen\n---\n');
  writeFileSync(join(wikiDir, 'arch.en.md'), '---\nname: Arch\n---\n');
  // fr and la wiki files missing.

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
      ]);
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
});
