#!/usr/bin/env node
// One-shot translator for the new PR #360 quick-add keys across all
// non-DE/EN locale files. Replaces the German fallback targets the
// sync-xliff-units tool wrote and flips `state="initial"` →
// `state="translated"`. Run once, then delete.

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const localeDir = join(repoRoot, 'web/src/locale');

const PC_VIDEO =
  '<pc id="0" equivStart="START_TAG_MAT_ICON" equivEnd="CLOSE_TAG_MAT_ICON" type="other" dispStart="&lt;mat-icon&gt;" dispEnd="&lt;/mat-icon&gt;">videocam</pc>';
const PH_MAX_ROWS = '<ph id="0" equiv="INTERPOLATION" disp="{{ maxRows }}"/>';

// id → { [locale]: target }
const TRANSLATIONS = {
  'quickAddConfig.hintV2': {
    el: ` Όρισε έως ${PH_MAX_ROWS} γρήγορες ενέργειες. Επίλεξε για κάθε κουμπί την άσκηση και – όπου υποστηρίζεται – αυτόματη μέτρηση μέσω κάμερας. Τα κενά πεδία αγνοούνται. `,
    es: ` Configura hasta ${PH_MAX_ROWS} acciones rápidas. Elige el ejercicio para cada botón y, donde esté disponible, la medición automática con la cámara. Los campos vacíos se ignoran. `,
    fr: ` Configurez jusqu'à ${PH_MAX_ROWS} actions rapides. Choisissez l'exercice pour chaque bouton et — lorsque disponible — le comptage automatique via la caméra. Les champs vides sont ignorés. `,
    it: ` Imposta fino a ${PH_MAX_ROWS} azioni rapide. Scegli per ogni pulsante l'esercizio e, dove disponibile, il conteggio automatico con la fotocamera. I campi vuoti vengono ignorati. `,
    la: ` Constitue ad ${PH_MAX_ROWS} actiones celeres. Pro singulis bullis exercitium elige et – ubi praesto est – mensuram automaticam per camerulam. Campi vacui ignorantur. `,
    nl: ` Stel tot ${PH_MAX_ROWS} snelle acties in. Kies per knop de oefening en – waar beschikbaar – automatische meting via de camera. Lege velden worden genegeerd. `,
    no: ` Definer opptil ${PH_MAX_ROWS} hurtighandlinger. Velg øvelse per knapp og – der tilgjengelig – automatisk måling via kamera. Tomme felt ignoreres. `,
    zh: ` 最多可设置 ${PH_MAX_ROWS} 个快速操作。为每个按钮选择训练项目，并在支持时启用通过相机进行自动计数。空白项将被忽略。 `,
  },
  'quickAddConfig.exerciseLabel': {
    el: 'Άσκηση',
    es: 'Ejercicio',
    fr: 'Exercice',
    it: 'Esercizio',
    la: 'Exercitium',
    nl: 'Oefening',
    no: 'Øvelse',
    zh: '训练项目',
  },
  'quickAddConfig.autoCountBadge': {
    el: `${PC_VIDEO} Αυτόματο `,
    es: `${PC_VIDEO} Auto `,
    fr: `${PC_VIDEO} Auto `,
    it: `${PC_VIDEO} Auto `,
    la: `${PC_VIDEO} Auto `,
    nl: `${PC_VIDEO} Auto `,
    no: `${PC_VIDEO} Auto `,
    zh: `${PC_VIDEO} 自动 `,
  },
  'quickAddConfig.autoCount': {
    el: 'Αυτόματη μέτρηση',
    es: 'Medición automática',
    fr: 'Comptage automatique',
    it: 'Conteggio automatico',
    la: 'Mensura automatica',
    nl: 'Automatische meting',
    no: 'Automatisk måling',
    zh: '自动计数',
  },
  'dashboard.quickAdd.autoPrefix': {
    el: 'Αυτόματο:',
    es: 'Auto:',
    fr: 'Auto :',
    it: 'Auto:',
    la: 'Auto:',
    nl: 'Auto:',
    no: 'Auto:',
    zh: '自动：',
  },
  'quickAddConfig.clearRowAria': {
    el: 'Διαγραφή γρήγορης ενέργειας',
    es: 'Borrar acción rápida',
    fr: 'Effacer l’action rapide',
    it: 'Cancella azione rapida',
    la: 'Dele actionem celerem',
    nl: 'Snelle actie wissen',
    no: 'Slett hurtighandling',
    zh: '清除快速操作',
  },
};

function escapeRegex(s) {
  // CodeQL: complete regex escape, not just dots — dot-only escaping
  // would miss `\\`, `[`, `(` etc. and break the wrapping regex below.
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceUnit(xliff, id, newTarget) {
  // Match the whole <unit id="..."> ... </unit> block, then within it
  // replace state="initial" with state="translated" and the <target>...</target>.
  const unitRe = new RegExp(
    `(<unit id="${escapeRegex(id)}">)([\\s\\S]*?)(</unit>)`,
    'g'
  );
  return xliff.replace(unitRe, (_full, open, body, close) => {
    const updatedBody = body
      .replace(/state="initial"/, 'state="translated"')
      .replace(/<target>[\s\S]*?<\/target>/, `<target>${newTarget}</target>`);
    return `${open}${updatedBody}${close}`;
  });
}

const LOCALES = ['el', 'es', 'fr', 'it', 'la', 'nl', 'no', 'zh'];

for (const locale of LOCALES) {
  const path = join(localeDir, `messages.${locale}.xlf`);
  let xliff = await readFile(path, 'utf8');
  let touched = 0;
  for (const [id, byLocale] of Object.entries(TRANSLATIONS)) {
    const target = byLocale[locale];
    if (target == null) continue;
    const before = xliff;
    xliff = replaceUnit(xliff, id, target);
    if (xliff !== before) touched += 1;
  }
  await writeFile(path, xliff, 'utf8');
  console.log(`${path}: updated ${touched} units`);
}
