#!/usr/bin/env node
/**
 * Sync web/src/locale/messages.xlf (source) into every messages.<lang>.xlf.
 *
 * Rules:
 *   - Unit missing in target  → append with state="new", target = source text
 *   - Unit present in target  → update <source> if text changed (keep <target>)
 *   - Orphaned target units   → preserved as-is
 */
const { readFileSync, writeFileSync, readdirSync } = require('node:fs');
const { join, resolve } = require('node:path');

const LOCALE_DIR = resolve(__dirname, '../../web/src/locale');
const SOURCE_FILE = join(LOCALE_DIR, 'messages.xlf');

/**
 * Parse all <unit id="...">…</unit> blocks from XLF content.
 * Returns Map<id, { fullXml, source, notesXml }>
 */
function parseUnits(content) {
  const map = new Map();
  const re = /<unit id="([^"]+)">([\s\S]*?)<\/unit>/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const fullXml = m[0];
    const id = m[1];
    const body = m[2];
    map.set(id, {
      fullXml,
      source: extractSource(body),
      notesXml: extractNotesXml(body),
    });
  }
  return map;
}

/**
 * Extract the text content of the <source> element from a unit body.
 * Handles: <source/>, <source></source>, <source>text with inline XML</source>
 */
function extractSource(unitBody) {
  if (/<source\s*\/>/.test(unitBody)) return '';
  const m = unitBody.match(/<source>([\s\S]*?)<\/source>/);
  return m ? m[1] : '';
}

/** Extract the raw <notes>…</notes> block from a unit body, if present. */
function extractNotesXml(unitBody) {
  const m = unitBody.match(/<notes>[\s\S]*?<\/notes>/);
  return m ? m[0] : null;
}

/**
 * Replace the <source> element inside a unit XML block.
 * Uses function-form replace to avoid treating $ in newText as backreferences.
 */
function setSourceInUnit(unitXml, newText) {
  const newSrcXml =
    newText === '' ? '<source/>' : `<source>${newText}</source>`;
  const replacer = () => newSrcXml;
  // Try self-closing form first
  const afterSelfClose = unitXml.replace(/<source\s*\/>/, replacer);
  if (afterSelfClose !== unitXml) return afterSelfClose;
  // Try with-content form
  return unitXml.replace(/<source>[\s\S]*?<\/source>/, replacer);
}

/**
 * Index-based string replacement to avoid RegExp special-char issues in
 * searchStr (which can contain angle brackets, parens, etc.).
 */
function replaceOnce(content, searchStr, replacementStr) {
  const idx = content.indexOf(searchStr);
  if (idx === -1) return content;
  return (
    content.slice(0, idx) +
    replacementStr +
    content.slice(idx + searchStr.length)
  );
}

/** Build the XML block for a new unit to append to a translation file. */
function buildNewUnit(id, sourceText, notesXml) {
  const notesBlock = notesXml ? `\n      ${notesXml}` : '';
  const srcXml =
    sourceText === '' ? '<source/>' : `<source>${sourceText}</source>`;
  return [
    `    <unit id="${id}">${notesBlock}`,
    `      <segment state="new">`,
    `        ${srcXml}`,
    `        <target>${sourceText}</target>`,
    `      </segment>`,
    `    </unit>`,
  ].join('\n');
}

/**
 * Merge source units into a single translation file.
 * Writes the file only when changes are needed.
 * Returns { added, updated } counts.
 */
function syncTranslationFile(targetPath, sourceUnits) {
  let content = readFileSync(targetPath, 'utf-8');
  const targetUnits = parseUnits(content);

  const newBlocks = [];
  let added = 0;
  let updated = 0;

  for (const [id, src] of sourceUnits) {
    if (!targetUnits.has(id)) {
      newBlocks.push(buildNewUnit(id, src.source, src.notesXml));
      added++;
    } else {
      const tgt = targetUnits.get(id);
      if (src.source !== tgt.source) {
        const updatedUnit = setSourceInUnit(tgt.fullXml, src.source);
        content = replaceOnce(content, tgt.fullXml, updatedUnit);
        updated++;
      }
    }
  }

  if (newBlocks.length > 0) {
    // Insert before the closing </file> tag
    content = content.replace(
      /\n {2}<\/file>/,
      `\n${newBlocks.join('\n')}\n  </file>`
    );
  }

  if (added > 0 || updated > 0) {
    writeFileSync(targetPath, content);
  }

  return { added, updated };
}

// ─── CLI entry point ─────────────────────────────────────────────────────────
if (require.main === module) {
  const sourceUnits = parseUnits(readFileSync(SOURCE_FILE, 'utf-8'));
  const translationFiles = readdirSync(LOCALE_DIR)
    .filter((f) => /^messages\..+\.xlf$/.test(f))
    .map((f) => join(LOCALE_DIR, f));

  console.log(
    `Syncing ${sourceUnits.size} source units → ${translationFiles.length} translation files...`
  );

  for (const file of translationFiles) {
    const lang = file.match(/messages\.(.+)\.xlf$/)?.[1] ?? '?';
    const { added, updated } = syncTranslationFile(file, sourceUnits);
    if (added > 0 || updated > 0) {
      console.log(`  [${lang}] +${added} new, ${updated} source updated`);
    } else {
      console.log(`  [${lang}] up to date`);
    }
  }

  console.log('Done.');
}

module.exports = {
  parseUnits,
  extractSource,
  extractNotesXml,
  setSourceInUnit,
  replaceOnce,
  buildNewUnit,
  syncTranslationFile,
};
