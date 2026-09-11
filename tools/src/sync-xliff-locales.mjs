#!/usr/bin/env node
/**
 * Syncs every locale file against `messages.xlf` after
 * `nx run web:extract-i18n`.
 *
 * Seeds missing units with the German source as the target, so the
 * production build (`i18nMissingTranslation: "error"`) stays green until a
 * real translation lands. Repairs units that lost their `<source>`. And
 * flags units whose German text has changed since they were translated —
 * those keep their old target but go back to `state="initial"`, which is
 * how `detect-translation-gaps.mjs` and the translation routine see them.
 * The decisions live in `xliff-sync-plan.mjs`.
 */
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { countActions, extractUnits, planLocale } from './xliff-sync-plan.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALE_DIR = join(__dirname, '..', '..', 'web', 'src', 'locale');
const SOURCE_FILE = 'messages.xlf';
const TRG_LOCALES = ['en', 'es', 'fr', 'it', 'nl', 'no', 'zh', 'el'];

async function syncLocale(locale, sourceUnits) {
  const path = join(LOCALE_DIR, `messages.${locale}.xlf`);
  let xml = await fs.readFile(path, 'utf-8');
  const localeUnits = extractUnits(xml);
  const plans = planLocale(sourceUnits, localeUnits);
  const counts = countActions(plans);

  for (const plan of plans) {
    if (plan.action === 'missing' || plan.action === 'same') continue;
    const existing = localeUnits.get(plan.id);
    // Function-form replacement so `$&`, `$1` etc. in the text are not
    // read as backreferences.
    xml = xml.replace(existing, () => plan.xml);
  }

  const missing = plans.filter((plan) => plan.action === 'missing');
  if (missing.length > 0) {
    // Locale files vary on whether `</file>` is indented (the canonical
    // source uses two spaces, hand-edited locales drop them). Match either
    // form so we don't lose the trailing tag.
    const closingMatch = /(\n?)([ \t]*)<\/file>\s*<\/xliff>\s*$/.exec(xml);
    if (!closingMatch) {
      throw new Error(`${path}: cannot find closing tags`);
    }
    const insert = `${missing.map((plan) => plan.xml).join('\n')}\n${closingMatch[2]}</file>\n</xliff>\n`;
    xml = xml.replace(closingMatch[0], () => `\n${insert}`);
  }

  const changed =
    counts.missing + counts.refresh + counts.repair + counts.stale;
  if (changed === 0) {
    console.log(`${locale}: up to date`);
    return;
  }
  await fs.writeFile(path, xml);
  console.log(
    `${locale}: added ${counts.missing}, refreshed ${counts.refresh}, repaired ${counts.repair}, flagged ${counts.stale} stale`
  );
}

async function main() {
  const sourceXml = await fs.readFile(join(LOCALE_DIR, SOURCE_FILE), 'utf-8');
  const sourceUnits = extractUnits(sourceXml);
  for (const locale of TRG_LOCALES) {
    await syncLocale(locale, sourceUnits);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
