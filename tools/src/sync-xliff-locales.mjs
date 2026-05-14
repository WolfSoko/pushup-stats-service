#!/usr/bin/env node
/**
 * Seed missing XLIFF units in translation files using the source as
 * the target (fallback). Run after `nx run web:extract-i18n` when new
 * `$localize` strings have been added.
 *
 * Translation work then replaces the fallback `<target>` strings
 * locale-by-locale; this script only ensures the production build
 * (which sets `i18nMissingTranslation: "error"`) does not fail in
 * the meantime.
 */
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALE_DIR = join(__dirname, '..', '..', 'web', 'src', 'locale');
const SOURCE_FILE = 'messages.xlf';
const TRG_LOCALES = ['en', 'es', 'fr', 'it', 'la', 'nl', 'no', 'zh', 'el'];

function extractUnits(xml) {
  const map = new Map();
  const re = /<unit id="([^"]+)">[\s\S]*?<\/unit>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    map.set(m[1], m[0]);
  }
  return map;
}

function extractSource(unitXml) {
  const m = /<source>([\s\S]*?)<\/source>/.exec(unitXml);
  return m ? m[1] : '';
}

async function main() {
  const sourcePath = join(LOCALE_DIR, SOURCE_FILE);
  const sourceXml = await fs.readFile(sourcePath, 'utf-8');
  const sourceUnits = extractUnits(sourceXml);

  for (const locale of TRG_LOCALES) {
    const path = join(LOCALE_DIR, `messages.${locale}.xlf`);
    let xml = await fs.readFile(path, 'utf-8');
    const targetUnits = extractUnits(xml);
    const missing = [];
    for (const [id, sourceUnit] of sourceUnits) {
      if (!targetUnits.has(id)) {
        const src = extractSource(sourceUnit);
        missing.push(
          `    <unit id="${id}">\n      <segment state="initial">\n        <source>${src}</source>\n        <target>${src}</target>\n      </segment>\n    </unit>`
        );
      }
    }
    if (missing.length === 0) {
      console.log(`${locale}: up to date`);
      continue;
    }
    const closing = '  </file>\n</xliff>';
    if (!xml.includes(closing)) {
      throw new Error(`${path}: cannot find closing tags`);
    }
    xml = xml.replace(closing, `${missing.join('\n')}\n${closing}`);
    await fs.writeFile(path, xml);
    console.log(`${locale}: added ${missing.length} unit(s)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
