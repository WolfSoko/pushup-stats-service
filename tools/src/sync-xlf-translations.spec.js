const { mkdtempSync, writeFileSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const {
  parseUnits,
  extractSource,
  extractNotesXml,
  setSourceInUnit,
  replaceOnce,
  buildNewUnit,
  syncTranslationFile,
} = require('./sync-xlf-translations');

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SOURCE_XLF = `<?xml version="1.0" encoding="UTF-8" ?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">
  <file id="ngi18n" original="ng.template">
    <unit id="greeting">
      <notes>
        <note category="location">src/app.component.ts:10</note>
      </notes>
      <segment>
        <source>Hallo Welt</source>
      </segment>
    </unit>
    <unit id="farewell">
      <notes>
        <note category="location">src/app.component.ts:11</note>
      </notes>
      <segment>
        <source>Auf Wiedersehen</source>
      </segment>
    </unit>
    <unit id="empty.unit">
      <segment>
        <source/>
      </segment>
    </unit>
  </file>
</xliff>`;

const TARGET_XLF_PARTIAL = `<?xml version="1.0" encoding="UTF-8" ?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="en">
  <file id="ngi18n" original="ng.template">
    <unit id="greeting">
      <notes>
        <note category="location">src/app.component.ts:10</note>
      </notes>
      <segment state="translated">
        <source>Hallo Welt</source>
        <target>Hello World</target>
      </segment>
    </unit>
  </file>
</xliff>`;

// ─── parseUnits ───────────────────────────────────────────────────────────────

describe('parseUnits', () => {
  it('returns a Map with correct size', () => {
    const units = parseUnits(SOURCE_XLF);
    expect(units.size).toBe(3);
  });

  it('extracts source text correctly', () => {
    const units = parseUnits(SOURCE_XLF);
    expect(units.get('greeting').source).toBe('Hallo Welt');
    expect(units.get('farewell').source).toBe('Auf Wiedersehen');
  });

  it('handles self-closing <source/> as empty string', () => {
    const units = parseUnits(SOURCE_XLF);
    expect(units.get('empty.unit').source).toBe('');
  });

  it('extracts notesXml when present', () => {
    const units = parseUnits(SOURCE_XLF);
    expect(units.get('greeting').notesXml).toContain('<notes>');
    expect(units.get('greeting').notesXml).toContain('src/app.component.ts:10');
  });

  it('sets notesXml to null when notes are absent', () => {
    const units = parseUnits(SOURCE_XLF);
    expect(units.get('empty.unit').notesXml).toBeNull();
  });

  it('stores the full original XML for each unit', () => {
    const units = parseUnits(SOURCE_XLF);
    expect(units.get('greeting').fullXml).toContain('<unit id="greeting">');
    expect(units.get('greeting').fullXml).toContain('</unit>');
  });
});

// ─── extractSource ────────────────────────────────────────────────────────────

describe('extractSource', () => {
  it('extracts plain text', () => {
    expect(extractSource('<source>Hello</source>')).toBe('Hello');
  });

  it('returns empty string for self-closing <source/>', () => {
    expect(extractSource('<source/>')).toBe('');
  });

  it('returns empty string for <source />', () => {
    expect(extractSource('<source />')).toBe('');
  });

  it('handles inline XML in source', () => {
    const body = '<source><pc id="0">bold</pc> text</source>';
    expect(extractSource(body)).toBe('<pc id="0">bold</pc> text');
  });

  it('returns empty string when no source element', () => {
    expect(extractSource('<target>no source here</target>')).toBe('');
  });
});

// ─── extractNotesXml ─────────────────────────────────────────────────────────

describe('extractNotesXml', () => {
  it('extracts notes block', () => {
    const body =
      '\n      <notes>\n        <note category="location">file:1</note>\n      </notes>\n';
    expect(extractNotesXml(body)).toBe(
      '<notes>\n        <note category="location">file:1</note>\n      </notes>'
    );
  });

  it('returns null when no notes', () => {
    expect(
      extractNotesXml('<segment><source>text</source></segment>')
    ).toBeNull();
  });
});

// ─── setSourceInUnit ──────────────────────────────────────────────────────────

describe('setSourceInUnit', () => {
  it('replaces text in <source>…</source>', () => {
    const unit =
      '<unit id="x"><segment><source>Alter Text</source><target>old</target></segment></unit>';
    const result = setSourceInUnit(unit, 'Neuer Text');
    expect(result).toContain('<source>Neuer Text</source>');
    expect(result).toContain('<target>old</target>');
    expect(result).not.toContain('Alter Text');
  });

  it('replaces self-closing <source/> with content', () => {
    const unit =
      '<unit id="x"><segment><source/><target>old</target></segment></unit>';
    const result = setSourceInUnit(unit, 'New text');
    expect(result).toContain('<source>New text</source>');
  });

  it('replaces text content with self-closing when new text is empty', () => {
    const unit =
      '<unit id="x"><segment><source>Some text</source><target>old</target></segment></unit>';
    const result = setSourceInUnit(unit, '');
    expect(result).toContain('<source/>');
    expect(result).not.toContain('Some text');
  });

  it('handles $ signs in source text without treating as backreferences', () => {
    const unit = '<unit id="x"><segment><source>old</source></segment></unit>';
    const result = setSourceInUnit(unit, '$100 Rabatt');
    expect(result).toContain('<source>$100 Rabatt</source>');
  });
});

// ─── replaceOnce ─────────────────────────────────────────────────────────────

describe('replaceOnce', () => {
  it('replaces the first occurrence only', () => {
    const result = replaceOnce('aaa', 'a', 'b');
    expect(result).toBe('baa');
  });

  it('handles strings with regex special characters', () => {
    const result = replaceOnce('x[foo]y', '[foo]', 'BAR');
    expect(result).toBe('xBARy');
  });

  it('returns content unchanged when search not found', () => {
    expect(replaceOnce('hello', 'xyz', 'abc')).toBe('hello');
  });
});

// ─── buildNewUnit ─────────────────────────────────────────────────────────────

describe('buildNewUnit', () => {
  it('builds a unit with state="new" and target = source text', () => {
    const xml = buildNewUnit('my.id', 'Deutsch', null);
    expect(xml).toContain('<unit id="my.id">');
    expect(xml).toContain('state="new"');
    expect(xml).toContain('<source>Deutsch</source>');
    expect(xml).toContain('<target>Deutsch</target>');
  });

  it('includes notes block when provided', () => {
    const notes = '<notes><note category="location">file:1</note></notes>';
    const xml = buildNewUnit('my.id', 'text', notes);
    expect(xml).toContain(notes);
  });

  it('uses self-closing <source/> for empty text', () => {
    const xml = buildNewUnit('my.id', '', null);
    expect(xml).toContain('<source/>');
  });
});

// ─── syncTranslationFile ─────────────────────────────────────────────────────

describe('syncTranslationFile', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'xlf-sync-'));
  });

  function writeTarget(filename, content) {
    const path = join(tmpDir, filename);
    writeFileSync(path, content);
    return path;
  }

  it('adds missing units to the translation file', () => {
    const sourceUnits = parseUnits(SOURCE_XLF);
    const targetPath = writeTarget('messages.en.xlf', TARGET_XLF_PARTIAL);

    const { added, updated } = syncTranslationFile(targetPath, sourceUnits);

    expect(added).toBe(2); // farewell + empty.unit
    expect(updated).toBe(0);

    const result = readFileSync(targetPath, 'utf-8');
    expect(result).toContain('<unit id="farewell">');
    expect(result).toContain('state="new"');
    expect(result).toContain('<target>Auf Wiedersehen</target>');
    expect(result).toContain('<unit id="empty.unit">');
  });

  it('keeps existing translations when adding new units', () => {
    const sourceUnits = parseUnits(SOURCE_XLF);
    const targetPath = writeTarget('messages.en.xlf', TARGET_XLF_PARTIAL);

    syncTranslationFile(targetPath, sourceUnits);

    const result = readFileSync(targetPath, 'utf-8');
    expect(result).toContain('<target>Hello World</target>');
  });

  it('updates <source> text when it changed', () => {
    const modifiedSource = SOURCE_XLF.replace(
      '<source>Hallo Welt</source>',
      '<source>Hallo Erde</source>'
    );
    const sourceUnits = parseUnits(modifiedSource);
    const targetPath = writeTarget('messages.en.xlf', TARGET_XLF_PARTIAL);

    const { updated } = syncTranslationFile(targetPath, sourceUnits);

    expect(updated).toBe(1);
    const result = readFileSync(targetPath, 'utf-8');
    expect(result).toContain('<source>Hallo Erde</source>');
    expect(result).toContain('<target>Hello World</target>');
    expect(result).not.toContain('<source>Hallo Welt</source>');
  });

  it('does not write the file when nothing changed', () => {
    const sourceUnits = parseUnits(SOURCE_XLF);
    // Target already has all source units with correct source text
    const fullTarget = TARGET_XLF_PARTIAL.replace(
      '</file>',
      `    <unit id="farewell">
      <segment state="translated">
        <source>Auf Wiedersehen</source>
        <target>Goodbye</target>
      </segment>
    </unit>
    <unit id="empty.unit">
      <segment state="translated">
        <source/>
        <target/>
      </segment>
    </unit>
  </file>`
    );

    const targetPath = writeTarget('messages.en.xlf', fullTarget);
    const statBefore = require('node:fs').statSync(targetPath).mtimeMs;

    const { added: _added, updated } = syncTranslationFile(
      targetPath,
      sourceUnits
    );

    expect(_added).toBe(0);
    expect(updated).toBe(0);
    // File should not have been rewritten
    const statAfter = require('node:fs').statSync(targetPath).mtimeMs;
    expect(statAfter).toBe(statBefore);
  });

  it('is idempotent – running twice produces the same result', () => {
    const sourceUnits = parseUnits(SOURCE_XLF);
    const targetPath = writeTarget('messages.en.xlf', TARGET_XLF_PARTIAL);

    syncTranslationFile(targetPath, sourceUnits);
    const afterFirst = readFileSync(targetPath, 'utf-8');

    syncTranslationFile(targetPath, sourceUnits);
    const afterSecond = readFileSync(targetPath, 'utf-8');

    expect(afterSecond).toBe(afterFirst);
  });

  it('preserves orphaned units that are not in the source', () => {
    const orphanTarget = `<?xml version="1.0" encoding="UTF-8" ?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="en">
  <file id="ngi18n" original="ng.template">
    <unit id="greeting">
      <segment state="translated">
        <source>Hallo Welt</source>
        <target>Hello World</target>
      </segment>
    </unit>
    <unit id="orphaned.old.key">
      <segment state="translated">
        <source>Alter Schlüssel</source>
        <target>Old key</target>
      </segment>
    </unit>
  </file>
</xliff>`;

    const sourceUnits = parseUnits(SOURCE_XLF);
    const targetPath = writeTarget('messages.en.xlf', orphanTarget);

    syncTranslationFile(targetPath, sourceUnits);

    const result = readFileSync(targetPath, 'utf-8');
    expect(result).toContain('<unit id="orphaned.old.key">');
    expect(result).toContain('<target>Old key</target>');
  });
});
