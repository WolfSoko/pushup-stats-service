'use strict';

const { readFileSync, writeFileSync, readdirSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');
const { execSync } = require('node:child_process');

/**
 * Extracts all <unit> blocks from an XLIFF 2.0 file as a Map<id, rawXmlBlock>.
 * @param {string} content
 * @returns {Map<string, string>}
 */
function extractUnits(content) {
  const units = new Map();
  const regex = /<unit\s+id="([^"]+)">([\s\S]*?)<\/unit>/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    units.set(m[1], m[0]);
  }
  return units;
}

/**
 * Returns the text content of the first <source> element in a unit block.
 * Returns '' for self-closing <source/>, null when no <source> element exists.
 * @param {string} unitBlock
 * @returns {string|null}
 */
function getSourceText(unitBlock) {
  const m = unitBlock.match(/<source>([\s\S]*?)<\/source>/);
  if (m) return m[1];
  if (/<source\s*\/>/.test(unitBlock)) return '';
  return null;
}

/**
 * Builds a new translation unit block for a language file from a source unit block.
 * Uses the German source text as the placeholder target with state="new".
 * @param {string} srcUnitBlock - raw unit XML from messages.xlf
 * @returns {string}
 */
function buildNewUnit(srcUnitBlock) {
  const id = srcUnitBlock.match(/id="([^"]+)"/)[1];
  const notesMatch = srcUnitBlock.match(/<notes>[\s\S]*?<\/notes>/);
  const sourceText = getSourceText(srcUnitBlock);

  const notesXml = notesMatch ? `      ${notesMatch[0]}\n` : '';
  const isEmpty = sourceText === null || sourceText === '';
  const srcEl = isEmpty ? '<source/>' : `<source>${sourceText}</source>`;
  const tgtEl = isEmpty ? '<target/>' : `<target>${sourceText}</target>`;

  return `    <unit id="${id}">
${notesXml}      <segment state="new">
        ${srcEl}
        ${tgtEl}
      </segment>
    </unit>`;
}

/**
 * Replaces the first literal occurrence of `search` in `str` with `replacement`.
 * Unlike String.replace(), this treats the search as a plain string (no regex specials).
 * @param {string} str
 * @param {string} search
 * @param {string} replacement
 * @returns {string}
 */
function replaceLiteral(str, search, replacement) {
  const idx = str.indexOf(search);
  if (idx === -1) return str;
  return str.slice(0, idx) + replacement + str.slice(idx + search.length);
}

/**
 * Syncs a single translation file against the source messages.xlf:
 *  - Adds units present in source but missing from translation (state="new", DE text as placeholder)
 *  - Removes units present in translation but no longer in source (orphans)
 *  - Updates <source> text in existing units when the German source changed
 *
 * Does NOT write to disk or run git — returns the updated content and change counts.
 * @param {string} sourcePath - absolute path to messages.xlf
 * @param {string} trgPath    - absolute path to messages.<lang>.xlf
 * @returns {{ content: string, addedCount: number, removedCount: number, updatedCount: number }}
 */
function syncTranslationFile(sourcePath, trgPath) {
  const sourceContent = readFileSync(sourcePath, 'utf8');
  const sourceUnits = extractUnits(sourceContent);
  const sourceIds = new Set(sourceUnits.keys());

  let content = readFileSync(trgPath, 'utf8');
  const trgUnits = extractUnits(content);

  let addedCount = 0;
  let removedCount = 0;
  let updatedCount = 0;

  // Remove orphaned units (in translation but not in source)
  for (const [id, block] of trgUnits) {
    if (!sourceIds.has(id)) {
      content = replaceLiteral(content, block, '');
      removedCount++;
    }
  }

  // Update <source> text in existing units when the German source changed
  for (const [id, srcBlock] of sourceUnits) {
    const trgBlock = trgUnits.get(id);
    if (!trgBlock) continue;

    const newSrc = getSourceText(srcBlock);
    const oldSrc = getSourceText(trgBlock);
    if (newSrc === oldSrc) continue;

    const newSrcXml = newSrc ? `<source>${newSrc}</source>` : '<source/>';
    const oldSrcXml = oldSrc ? `<source>${oldSrc}</source>` : '<source/>';
    const updatedBlock = replaceLiteral(trgBlock, oldSrcXml, newSrcXml);
    content = replaceLiteral(content, trgBlock, updatedBlock);
    updatedCount++;
  }

  // Add missing units before </file>
  const missingBlocks = [];
  for (const [id, srcBlock] of sourceUnits) {
    if (!trgUnits.has(id)) {
      missingBlocks.push(buildNewUnit(srcBlock));
      addedCount++;
    }
  }

  if (missingBlocks.length > 0) {
    content = content.replace(
      '</file>',
      () => missingBlocks.join('\n') + '\n  </file>'
    );
  }

  return { content, addedCount, removedCount, updatedCount };
}

/**
 * Entry point: syncs all messages.<lang>.xlf files in the same directory as messages.xlf.
 * Writes changed files to disk and runs `git add` on them.
 * @param {string} sourcePath - path to messages.xlf (absolute or relative to cwd)
 */
function run(sourcePath) {
  const resolvedSource = resolve(sourcePath);
  const localeDir = dirname(resolvedSource);

  const translationFiles = readdirSync(localeDir)
    .filter((f) => /^messages\.[a-z]{2,}\.xlf$/.test(f))
    .map((f) => join(localeDir, f));

  for (const trgPath of translationFiles) {
    const { content, addedCount, removedCount, updatedCount } =
      syncTranslationFile(resolvedSource, trgPath);

    if (addedCount === 0 && removedCount === 0 && updatedCount === 0) continue;

    writeFileSync(trgPath, content);
    execSync(`git add ${JSON.stringify(trgPath)}`);

    const lang = trgPath.match(/messages\.(\w+)\.xlf$/)[1];
    console.log(
      `[xliff-sync] ${lang}: +${addedCount} added, -${removedCount} removed, ~${updatedCount} source updated`
    );
  }
}

if (require.main === module) {
  const sourcePath = process.argv[2];
  if (!sourcePath) {
    console.error('Usage: sync-xliff-translations.js <path-to-messages.xlf>');
    process.exit(1);
  }
  run(sourcePath);
}

module.exports = {
  extractUnits,
  getSourceText,
  buildNewUnit,
  replaceLiteral,
  syncTranslationFile,
};
