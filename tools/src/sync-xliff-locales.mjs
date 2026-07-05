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
const TRG_LOCALES = ['en', 'es', 'fr', 'it', 'nl', 'no', 'zh', 'el'];

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
    let refreshed = 0;
    for (const [id, sourceUnit] of sourceUnits) {
      const src = extractSource(sourceUnit);
      const existing = targetUnits.get(id);
      if (!existing) {
        missing.push(
          `    <unit id="${id}">\n      <segment state="initial">\n        <source>${src}</source>\n        <target>${src}</target>\n      </segment>\n    </unit>`
        );
        continue;
      }
      // Refresh stale fallback units: when the source in messages.xlf
      // has changed but the locale still carries the previous text as
      // a target == source fallback, update both to the new German
      // source. Skip units the translator has actually filled in
      // (state="translated", or target != source).
      const existingSrc = extractSource(existing);
      const tgtMatch = /<target>([\s\S]*?)<\/target>/.exec(existing);
      const existingTgt = tgtMatch ? tgtMatch[1] : '';
      const isFallback =
        existing.includes('state="initial"') && existingSrc === existingTgt;
      if (isFallback && existingSrc !== src) {
        const updated = `    <unit id="${id}">\n      <segment state="initial">\n        <source>${src}</source>\n        <target>${src}</target>\n      </segment>\n    </unit>`;
        // Pass the replacement as a function so `$&`, `$1` etc. in the
        // existing XML are not interpreted as backreferences.
        xml = xml.replace(existing, () => updated);
        refreshed++;
      }
    }
    if (missing.length === 0 && refreshed === 0) {
      console.log(`${locale}: up to date`);
      continue;
    }
    if (missing.length > 0) {
      // Locale files vary on whether `</file>` is indented (the
      // canonical source uses two spaces, hand-edited locales drop
      // them). Match either form so we don't lose the trailing tag.
      const closingMatch = /(\n?)([ \t]*)<\/file>\s*<\/xliff>\s*$/.exec(xml);
      if (!closingMatch) {
        throw new Error(`${path}: cannot find closing tags`);
      }
      const insert = `${missing.join('\n')}\n${closingMatch[2]}</file>\n</xliff>\n`;
      // Function-form replacement so `$&`, `$1` etc. in any unit's
      // source text are not interpreted as backreferences.
      xml = xml.replace(closingMatch[0], () => `\n${insert}`);
    }
    await fs.writeFile(path, xml);
    console.log(
      `${locale}: added ${missing.length} unit(s), refreshed ${refreshed} fallback(s)`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
