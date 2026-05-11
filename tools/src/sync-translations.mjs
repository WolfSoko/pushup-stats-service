#!/usr/bin/env node
/**
 * Syncs all messages.<lang>.xlf files in web/src/locale/ against the
 * auto-generated source file messages.xlf.
 *
 * For each translation file:
 *   - Adds units present in the source but missing in the translation
 *     (state="initial", no <target> yet).
 *   - Updates the <source> text of existing units to match the source file.
 *   - Removes units that no longer exist in the source.
 *   - Preserves existing <target> translations and their state.
 *
 * Run directly:  node tools/src/sync-translations.mjs
 * Or via pnpm:   pnpm nx run web:sync-translations
 *
 * The lint-staged config triggers this automatically when messages.xlf
 * is included in a commit.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALE_DIR = resolve(__dirname, '../../web/src/locale');
const SOURCE_FILE = join(LOCALE_DIR, 'messages.xlf');

/** @returns {Map<string, {notes: string, source: string}>} */
function parseSourceUnits(xml) {
  const units = new Map();
  const re = /<unit\s+id="([^"]+)">([\s\S]*?)<\/unit>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const id = m[1];
    const inner = m[2];
    const notesM = /<notes>([\s\S]*?)<\/notes>/.exec(inner);
    const sourceM = /<source>([\s\S]*?)<\/source>/.exec(inner);
    units.set(id, {
      notes: notesM ? notesM[0] : '',
      source: sourceM ? sourceM[1] : '',
    });
  }
  return units;
}

/** @returns {Map<string, {target: string|null, state: string}>} */
function parseTranslations(xml) {
  const trans = new Map();
  const re = /<unit\s+id="([^"]+)">([\s\S]*?)<\/unit>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const id = m[1];
    const inner = m[2];
    const targetM = /<target>([\s\S]*?)<\/target>/.exec(inner);
    const stateM = /<segment\s+state="([^"]+)"/.exec(inner);
    trans.set(id, {
      target: targetM ? targetM[1] : null,
      state: stateM ? stateM[1] : 'translated',
    });
  }
  return trans;
}

/** Extracts the trgLang attribute from the xliff element. */
function extractTrgLang(xml) {
  const m = /trgLang="([^"]+)"/.exec(xml);
  return m ? m[1] : 'unknown';
}

function buildUnit(id, { notes, source }, translation) {
  const { target, state } = translation ?? { target: null, state: 'initial' };
  const notesBlock = notes ? `\n      ${notes.trim()}` : '';
  const segState = target ? ` state="${state || 'translated'}"` : ' state="initial"';
  const targetLine = target ? `\n        <target>${target}</target>` : '';
  return (
    `    <unit id="${id}">${notesBlock}\n` +
    `      <segment${segState}>\n` +
    `        <source>${source}</source>${targetLine}\n` +
    `      </segment>\n` +
    `    </unit>`
  );
}

function syncFile(translationPath, sourceUnits) {
  const xml = readFileSync(translationPath, 'utf8');
  const trgLang = extractTrgLang(xml);
  const existing = parseTranslations(xml);

  const added = [];
  const removed = [];
  let sourceChanged = 0;

  for (const id of existing.keys()) {
    if (!sourceUnits.has(id)) removed.push(id);
  }

  const units = [];
  for (const [id, { notes, source: newSource }] of sourceUnits) {
    const translation = existing.get(id) ?? null;
    if (!translation) added.push(id);
    else {
      const oldSourceM = /<source>([\s\S]*?)<\/source>/.exec(
        xml.slice(xml.indexOf(`id="${id}"`))
      );
      if (oldSourceM && oldSourceM[1] !== newSource) sourceChanged++;
    }
    units.push(buildUnit(id, { notes, source: newSource }, translation));
  }

  const header =
    `<?xml version="1.0" encoding="UTF-8" ?>\n` +
    `<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="de" trgLang="${trgLang}">\n` +
    `  <file id="ngi18n" original="ng.template">`;
  const footer = `  </file>\n</xliff>`;
  const output = `${header}\n${units.join('\n')}\n${footer}\n`;

  writeFileSync(translationPath, output, 'utf8');

  const lang = trgLang.padEnd(5);
  if (added.length || removed.length || sourceChanged) {
    console.log(
      `[${lang}]  +${added.length} added  -${removed.length} removed  ~${sourceChanged} source updated`
    );
    if (added.length) console.log(`         added:   ${added.slice(0, 5).join(', ')}${added.length > 5 ? ' …' : ''}`);
    if (removed.length)
      console.log(`         removed: ${removed.slice(0, 5).join(', ')}${removed.length > 5 ? ' …' : ''}`);
  } else {
    console.log(`[${lang}]  already in sync`);
  }
}

const sourceXml = readFileSync(SOURCE_FILE, 'utf8');
const sourceUnits = parseSourceUnits(sourceXml);
console.log(`Source units: ${sourceUnits.size}`);

const translationFiles = readdirSync(LOCALE_DIR)
  .filter((f) => /^messages\.[a-z]{2,5}\.xlf$/.test(f))
  .map((f) => join(LOCALE_DIR, f));

for (const file of translationFiles) {
  syncFile(file, sourceUnits);
}
