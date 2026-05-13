#!/usr/bin/env node
// Sync newly-extracted units from the source XLIFF (messages.xlf) into
// each locale XLIFF (messages.<locale>.xlf) so the production build's
// `i18nMissingTranslation: error` gate doesn't choke on the
// movement-pattern category rename and the new exercises/variants.
//
// Adds missing units with a `state="initial"` target containing the
// source string so the app still renders the German fallback until a
// human translation lands. Existing translated units are left alone.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const localeDir = join(repoRoot, 'web/src/locale');
const sourcePath = join(localeDir, 'messages.xlf');

const UNIT_RE = /<unit\s+id="([^"]+)">[\s\S]*?<\/unit>/g;

function indexUnits(xliff) {
  const map = new Map();
  for (const match of xliff.matchAll(UNIT_RE)) {
    map.set(match[1], match[0]);
  }
  return map;
}

function extractSource(unitXml) {
  const m = unitXml.match(/<source>([\s\S]*?)<\/source>/);
  return m ? m[1] : '';
}

function buildLocaleUnit(id, sourceText) {
  return `    <unit id="${id}">
      <segment state="initial">
        <source>${sourceText}</source>
        <target>${sourceText}</target>
      </segment>
    </unit>`;
}

async function syncFile(localePath, sourceMap) {
  const xliff = await readFile(localePath, 'utf8');
  const existing = indexUnits(xliff);
  const missingIds = [...sourceMap.keys()].filter((id) => !existing.has(id));
  if (missingIds.length === 0) return { localePath, added: 0 };

  const additions = missingIds
    .map((id) => buildLocaleUnit(id, extractSource(sourceMap.get(id))))
    .join('\n');

  // Find the start of the line containing the closing `</file>` so we
  // insert *before* its leading whitespace (typically 2 spaces). Inserting
  // at the `<` character itself leaves that indentation in front of the
  // first new unit and skews formatting across locale files.
  const closingTag = xliff.lastIndexOf('</file>');
  if (closingTag === -1) {
    throw new Error(`No </file> tag in ${localePath}`);
  }
  const lineStart = xliff.lastIndexOf('\n', closingTag) + 1;
  const next =
    xliff.slice(0, lineStart) + additions + '\n' + xliff.slice(lineStart);
  await writeFile(localePath, next, 'utf8');
  return { localePath, added: missingIds.length };
}

async function main() {
  const sourceXliff = await readFile(sourcePath, 'utf8');
  const sourceMap = indexUnits(sourceXliff);

  const files = (await readdir(localeDir)).filter((f) =>
    /^messages\.[a-z]{2}\.xlf$/.test(f)
  );
  for (const f of files) {
    const result = await syncFile(join(localeDir, f), sourceMap);
    console.log(`${result.localePath}: +${result.added} units`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
