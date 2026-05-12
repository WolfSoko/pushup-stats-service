'use strict';

const { mkdtempSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

jest.mock('node:child_process', () => ({ execSync: jest.fn() }));

const {
  extractUnits,
  getSourceText,
  buildNewUnit,
  replaceLiteral,
  syncTranslationFile,
} = require('./sync-xliff-translations');

// ── XLIFF fixture helpers ──────────────────────────────────────────────────

const SRC_HEADER = `<?xml version="1.0" encoding="UTF-8" ?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de">
  <file id="ngi18n" original="ng.template">`;
const SRC_FOOTER = `  </file>
</xliff>`;

const TRG_HEADER = `<?xml version="1.0" encoding="UTF-8" ?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="en">
  <file id="ngi18n" original="ng.template">`;
const TRG_FOOTER = `  </file>
</xliff>`;

function mkSource(...units) {
  return [SRC_HEADER, ...units, SRC_FOOTER].join('\n');
}

function mkTranslation(...units) {
  return [TRG_HEADER, ...units, TRG_FOOTER].join('\n');
}

function srcUnit(id, text) {
  return `    <unit id="${id}">
      <segment>
        <source>${text}</source>
      </segment>
    </unit>`;
}

function trgUnit(id, src, tgt, state = 'translated') {
  return `    <unit id="${id}">
      <segment state="${state}">
        <source>${src}</source>
        <target>${tgt}</target>
      </segment>
    </unit>`;
}

function makeTempFiles() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'xliff-sync-'));
  return {
    sourcePath: join(tmpDir, 'messages.xlf'),
    trgPath: join(tmpDir, 'messages.en.xlf'),
  };
}

// ── extractUnits ──────────────────────────────────────────────────────────

describe('extractUnits', () => {
  it('extracts all units by id', () => {
    const content = mkSource(srcUnit('foo', 'Hallo'), srcUnit('bar', 'Welt'));
    const units = extractUnits(content);
    expect(units.size).toBe(2);
    expect(units.has('foo')).toBe(true);
    expect(units.has('bar')).toBe(true);
  });

  it('returns empty map when no units exist', () => {
    expect(extractUnits('<xliff></xliff>').size).toBe(0);
  });

  it('preserves the full raw block for each unit', () => {
    const block = srcUnit('id1', 'Text');
    const content = mkSource(block);
    const units = extractUnits(content);
    expect(units.get('id1')).toContain('<source>Text</source>');
  });
});

// ── getSourceText ─────────────────────────────────────────────────────────

describe('getSourceText', () => {
  it('returns source text from a normal unit', () => {
    expect(getSourceText(srcUnit('id1', 'Hallo Welt'))).toBe('Hallo Welt');
  });

  it('returns empty string for self-closing <source/>', () => {
    const unit = `<unit id="x"><segment><source/></segment></unit>`;
    expect(getSourceText(unit)).toBe('');
  });

  it('returns null when no source element is present', () => {
    expect(getSourceText('<unit id="x"></unit>')).toBeNull();
  });

  it('handles multiline source text', () => {
    const unit = `<unit id="x"><segment><source>Line 1\nLine 2</source></segment></unit>`;
    expect(getSourceText(unit)).toBe('Line 1\nLine 2');
  });
});

// ── replaceLiteral ────────────────────────────────────────────────────────

describe('replaceLiteral', () => {
  it('replaces the first occurrence of the search string', () => {
    expect(replaceLiteral('aXa', 'X', 'Y')).toBe('aYa');
  });

  it('returns the original string when search is not found', () => {
    expect(replaceLiteral('abc', 'X', 'Y')).toBe('abc');
  });

  it('does not replace regex special characters as patterns', () => {
    expect(replaceLiteral('a$&b', '$&', 'Z')).toBe('aZb');
  });

  it('replaces only the first occurrence when search appears multiple times', () => {
    expect(replaceLiteral('aXaXa', 'X', 'Y')).toBe('aYaXa');
  });
});

// ── buildNewUnit ──────────────────────────────────────────────────────────

describe('buildNewUnit', () => {
  it('creates a unit with state="new" and DE source as placeholder target', () => {
    const srcBlock = srcUnit('greeting', 'Hallo');
    const result = buildNewUnit(srcBlock);
    expect(result).toContain('id="greeting"');
    expect(result).toContain('state="new"');
    expect(result).toContain('<source>Hallo</source>');
    expect(result).toContain('<target>Hallo</target>');
  });

  it('uses self-closing source and target for empty source text', () => {
    const srcBlock = `<unit id="empty"><segment><source/></segment></unit>`;
    const result = buildNewUnit(srcBlock);
    expect(result).toContain('<source/>');
    expect(result).toContain('<target/>');
    expect(result).not.toContain('<source><');
  });

  it('preserves the notes block from the source unit', () => {
    const srcBlock = `    <unit id="noted">
      <notes>
        <note category="location">some/path.ts:42</note>
      </notes>
      <segment>
        <source>Text</source>
      </segment>
    </unit>`;
    const result = buildNewUnit(srcBlock);
    expect(result).toContain('<notes>');
    expect(result).toContain('some/path.ts:42');
  });

  it('omits notes block when source unit has none', () => {
    const srcBlock = `<unit id="no-notes"><segment><source>Text</source></segment></unit>`;
    const result = buildNewUnit(srcBlock);
    expect(result).not.toContain('<notes>');
  });
});

// ── syncTranslationFile ───────────────────────────────────────────────────

describe('syncTranslationFile', () => {
  describe('given a new unit in source that is missing from translation', () => {
    it('adds the unit with state="new" and the German source as placeholder', () => {
      const { sourcePath, trgPath } = makeTempFiles();
      writeFileSync(sourcePath, mkSource(srcUnit('new.key', 'Neuer Eintrag')));
      writeFileSync(trgPath, mkTranslation());

      const { content, addedCount } = syncTranslationFile(sourcePath, trgPath);

      expect(addedCount).toBe(1);
      expect(content).toContain('id="new.key"');
      expect(content).toContain('state="new"');
      expect(content).toContain('<target>Neuer Eintrag</target>');
    });
  });

  describe('given a unit in translation that no longer exists in source', () => {
    it('removes the orphaned unit', () => {
      const { sourcePath, trgPath } = makeTempFiles();
      writeFileSync(sourcePath, mkSource(srcUnit('kept', 'Behalten')));
      writeFileSync(
        trgPath,
        mkTranslation(
          trgUnit('kept', 'Behalten', 'Kept'),
          trgUnit('orphan', 'Veraltet', 'Old')
        )
      );

      const { content, removedCount } = syncTranslationFile(
        sourcePath,
        trgPath
      );

      expect(removedCount).toBe(1);
      expect(content).not.toContain('id="orphan"');
      expect(content).toContain('id="kept"');
    });
  });

  describe('given a unit whose German source text changed', () => {
    it('updates the <source> element and preserves the <target>', () => {
      const { sourcePath, trgPath } = makeTempFiles();
      writeFileSync(sourcePath, mkSource(srcUnit('id1', 'Neuer Text')));
      writeFileSync(
        trgPath,
        mkTranslation(trgUnit('id1', 'Alter Text', 'Old translation'))
      );

      const { content, updatedCount } = syncTranslationFile(
        sourcePath,
        trgPath
      );

      expect(updatedCount).toBe(1);
      expect(content).toContain('<source>Neuer Text</source>');
      expect(content).toContain('<target>Old translation</target>');
    });
  });

  describe('given source and translation are already in sync', () => {
    it('reports zero changes', () => {
      const { sourcePath, trgPath } = makeTempFiles();
      writeFileSync(sourcePath, mkSource(srcUnit('id1', 'Text')));
      writeFileSync(
        trgPath,
        mkTranslation(trgUnit('id1', 'Text', 'Translation'))
      );

      const { addedCount, removedCount, updatedCount } = syncTranslationFile(
        sourcePath,
        trgPath
      );

      expect(addedCount).toBe(0);
      expect(removedCount).toBe(0);
      expect(updatedCount).toBe(0);
    });
  });

  describe('given multiple units with a mix of add, remove, and update', () => {
    it('handles all changes in one pass', () => {
      const { sourcePath, trgPath } = makeTempFiles();
      writeFileSync(
        sourcePath,
        mkSource(
          srcUnit('unchanged', 'Gleich'),
          srcUnit('updated', 'Neuer Text'),
          srcUnit('added', 'Neu')
        )
      );
      writeFileSync(
        trgPath,
        mkTranslation(
          trgUnit('unchanged', 'Gleich', 'Same'),
          trgUnit('updated', 'Alter Text', 'Old translation'),
          trgUnit('orphan', 'Weg', 'Gone')
        )
      );

      const { content, addedCount, removedCount, updatedCount } =
        syncTranslationFile(sourcePath, trgPath);

      expect(addedCount).toBe(1);
      expect(removedCount).toBe(1);
      expect(updatedCount).toBe(1);
      expect(content).toContain('id="unchanged"');
      expect(content).toContain('id="updated"');
      expect(content).toContain('id="added"');
      expect(content).not.toContain('id="orphan"');
      expect(content).toContain('<source>Neuer Text</source>');
      expect(content).toContain('<target>Old translation</target>');
    });
  });

  describe('given a new unit with special characters in source text', () => {
    it('adds the unit preserving XML entities as-is', () => {
      const { sourcePath, trgPath } = makeTempFiles();
      writeFileSync(
        sourcePath,
        mkSource(srcUnit('special', 'Text &amp; mehr'))
      );
      writeFileSync(trgPath, mkTranslation());

      const { content } = syncTranslationFile(sourcePath, trgPath);

      expect(content).toContain('<source>Text &amp; mehr</source>');
      expect(content).toContain('<target>Text &amp; mehr</target>');
    });
  });
});
