/**
 * Curated catalog of push-up variations referenced in the training
 * plans and offered in the entry-creation dialog. The wiki page
 * (`/wiki/liegestuetz-typen`) renders every entry, the plan detail
 * UI uses `detectPushupTypes()` to surface tooltips with the short
 * summary plus a deep link to the matching wiki anchor, and the
 * entry dialog derives its autocomplete options from `entryLabel`.
 *
 * Why static and bilingual: like `training-plan.catalog.ts`, these
 * are curated editorial entries with technique cues that must stay
 * in lockstep across languages — putting them in XLIFF would lose
 * the per-step pairing.
 *
 * **Migration in progress:** translatable copy is moving to per-locale
 * markdown frontmatter under `content/wiki/pushup-types/<id>.{de,en}.md`
 * (see AGENTS.md). Until every type is ported, `localizePushupType()`
 * checks the generated override first and falls back to the legacy
 * `*En` parallel fields below.
 */

import { PUSHUP_TYPE_CONTENT } from './pushup-type-content.generated';

export type PushupTypeId =
  | 'standard'
  | 'knee'
  | 'incline'
  | 'decline'
  | 'wide'
  | 'diamond'
  | 'pike'
  | 'knuckle'
  | 'archer'
  | 'wall-one-arm'
  | 'negative-one-arm'
  | 'partial-one-arm'
  | 'one-arm';

export type PushupDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface PushupTypeInfo {
  id: PushupTypeId;
  /**
   * Default slug used as the wiki anchor and as the canonical wiki
   * detail URL for the source locale (German). Per-locale overrides
   * live in `slugs` below; this field is the fallback when a locale
   * has no override.
   */
  slug: string;
  /**
   * Per-locale slug overrides for the wiki detail URL. Each
   * locale-specific slug becomes the canonical
   * `/<lang>/wiki/liegestuetz-typen/<slug>` URL for that locale, with
   * hreflang alternates pointing at every other locale's slug. Locales
   * not listed fall back to `slug` above so old URLs and unsupported
   * locales keep resolving.
   *
   * URL-safety: every slug must be lowercase ASCII (no diacritics),
   * because URL-encoded paths confuse SEO crawlers and many social-card
   * scrapers. Transliterate Greek/Latin/Chinese rather than dropping
   * the locale.
   */
  slugs?: Partial<Record<string, string>>;
  /**
   * Stable English label persisted to Firestore as
   * `PushupRecord.type` and shown in the entry-dialog autocomplete.
   * Keep in sync with existing user data — do NOT rename without a
   * migration.
   */
  entryLabel: string;
  difficulty: PushupDifficulty;
  /** German display name (e.g. "Standard-Liegestütze"). */
  name: string;
  /** English display name. */
  nameEn: string;
  /** Short German one-liner used in tooltips. */
  summary: string;
  /** Short English one-liner used in tooltips. */
  summaryEn: string;
  /** Ordered German technique cues for the wiki page. */
  instructions: ReadonlyArray<string>;
  /** Ordered English technique cues for the wiki page. */
  instructionsEn: ReadonlyArray<string>;
  /** Optional German coaching tips / common mistakes. */
  tips?: ReadonlyArray<string>;
  /** Optional English coaching tips / common mistakes. */
  tipsEn?: ReadonlyArray<string>;
  /**
   * German keywords that, if present in a `TrainingPlanDay.description`,
   * indicate this type. Lower-case substring match.
   */
  keywordsDe: ReadonlyArray<string>;
  /** English keywords (lower-case substring match). */
  keywordsEn: ReadonlyArray<string>;
}

export const PUSHUP_TYPES: ReadonlyArray<PushupTypeInfo> = [
  {
    id: 'standard',
    slug: 'standard',
    slugs: {
      en: 'standard-pushup',
      fr: 'pompe-standard',
      es: 'flexion-estandar',
      it: 'push-up-standard',
      nl: 'standaard-pushup',
      el: 'standard-push-up',
      la: 'pulsus-classicus',
      no: 'standard-armheving',
      zh: 'biaozhun-fuwocheng',
    },
    entryLabel: 'Standard',
    difficulty: 'beginner',
    name: 'Standard-Liegestütze',
    nameEn: 'Standard push-up',
    summary:
      'Klassische Liegestütze mit schulterbreitem Stand und gerader Körperlinie.',
    summaryEn:
      'Classic push-up with shoulder-width hand position and a straight body line.',
    instructions: [
      'Hände schulterbreit, direkt unter den Schultern, Finger zeigen nach vorne.',
      'Körper bildet eine gerade Linie von Kopf bis Ferse — Bauch und Po angespannt.',
      'Ellenbogen in einem 45°-Winkel zum Oberkörper, nicht weit abspreizen.',
      'Brust kontrolliert in Richtung Boden senken, bis sie knapp darüber ist.',
      'Kraftvoll wieder hochdrücken, Ellenbogen oben nicht durchstrecken.',
    ],
    instructionsEn: [
      'Hands shoulder-width apart, directly under the shoulders, fingers pointing forward.',
      'Body forms a straight line from head to heels — brace abs and glutes.',
      'Elbows at roughly 45° to the torso, not flared out wide.',
      'Lower the chest under control until it nearly touches the floor.',
      'Press back up powerfully, do not lock the elbows at the top.',
    ],
    tips: [
      'Blick leicht nach vorne auf den Boden, nicht den Nacken überstrecken.',
      'Atmung: beim Absenken einatmen, beim Hochdrücken ausatmen.',
    ],
    tipsEn: [
      'Look slightly forward at the floor — do not crane the neck.',
      'Breathing: inhale on the way down, exhale on the press up.',
    ],
    keywordsDe: ['standard', 'sauber', 'volle bewegung'],
    keywordsEn: ['standard', 'clean push-up', 'clean reps', 'full range'],
  },
  {
    id: 'knee',
    slug: 'knie',
    slugs: {
      en: 'knee-pushup',
      fr: 'pompe-genoux',
      es: 'flexion-rodillas',
      it: 'push-up-ginocchia',
      nl: 'knie-pushup',
      el: 'gonatistos-push-up',
      la: 'pulsus-genuum',
      no: 'knearmheving',
      zh: 'xigai-fuwocheng',
    },
    entryLabel: 'Knee',
    difficulty: 'beginner',
    name: 'Knie-Liegestütze',
    nameEn: 'Knee push-up',
    summary:
      'Vereinfachte Variante mit Knien als Auflagepunkt — ideal für Einsteiger.',
    summaryEn:
      'Easier regression with the knees on the floor — ideal for beginners.',
    instructions: [
      'Knie auf dem Boden, Füße angehoben oder gekreuzt.',
      'Hände schulterbreit, gerade Linie von Knien bis Schultern.',
      'Hüfte stabil halten — nicht durchhängen oder hochschieben.',
      'Brust kontrolliert absenken, dann wieder hochdrücken.',
    ],
    instructionsEn: [
      'Place the knees on the floor, feet lifted or crossed.',
      'Hands shoulder-width, keep a straight line from knees to shoulders.',
      'Stabilise the hips — no sagging or piking.',
      'Lower the chest under control, then press back up.',
    ],
    tips: [
      'Nutze Knie-Liegestütze, bis du 3×8 saubere Wiederholungen schaffst, dann steige auf Standard um.',
    ],
    tipsEn: [
      'Stay on knee push-ups until you can do 3×8 clean reps, then progress to the standard version.',
    ],
    keywordsDe: ['knie-liegestütze', 'knie liegestütze', 'knie-'],
    keywordsEn: ['knee push-up', 'knee pushup', 'knee '],
  },
  {
    id: 'incline',
    slug: 'incline',
    slugs: {
      en: 'incline-pushup',
      fr: 'pompe-inclinee',
      es: 'flexion-inclinada',
      it: 'push-up-inclinato',
      nl: 'incline-pushup',
      el: 'klisi-push-up',
      la: 'pulsus-inclinatus',
      no: 'hellende-armheving',
      zh: 'qingxie-fuwocheng',
    },
    entryLabel: 'Incline',
    difficulty: 'beginner',
    name: 'Incline-Liegestütze (Hände erhöht)',
    nameEn: 'Incline push-up (hands elevated)',
    summary:
      'Hände auf einer Bank, Tisch oder Wand — reduziert das Körpergewicht auf den Armen.',
    summaryEn:
      'Hands on a bench, table or wall — reduces the load on the arms.',
    instructions: [
      'Hände auf einer stabilen Erhöhung (Bank, Tisch, Treppenstufe).',
      'Füße am Boden, Körper bildet eine gerade Linie.',
      'Brust kontrolliert zur Erhöhung absenken, dann hochdrücken.',
      'Je niedriger die Erhöhung, desto schwieriger die Übung.',
    ],
    instructionsEn: [
      'Place the hands on a stable elevation (bench, table, stair).',
      'Feet on the floor, body in a straight line.',
      'Lower the chest under control to the elevation, then press up.',
      'The lower the elevation, the harder the exercise.',
    ],
    tips: ['Schrittweise tiefer gehen, sobald 3×10 sauber gelingen.'],
    tipsEn: ['Step the elevation down once 3×10 reps feel clean.'],
    keywordsDe: ['erhöht', 'erhoeht', 'incline'],
    keywordsEn: ['incline', 'hands elevated'],
  },
  {
    id: 'decline',
    slug: 'decline',
    slugs: {
      en: 'decline-pushup',
      fr: 'pompe-declinee',
      es: 'flexion-declinada',
      it: 'push-up-declinato',
      nl: 'decline-pushup',
      el: 'katapherus-push-up',
      la: 'pulsus-inversus',
      no: 'synkende-armheving',
      zh: 'xiaqing-fuwocheng',
    },
    entryLabel: 'Decline',
    difficulty: 'intermediate',
    name: 'Decline-Liegestütze (Füße erhöht)',
    nameEn: 'Decline push-up (feet elevated)',
    summary:
      'Füße auf einer Erhöhung, Hände am Boden — zusätzliche Belastung für die obere Brust und Schultern.',
    summaryEn:
      'Feet on an elevation, hands on the floor — extra load on the upper chest and shoulders.',
    instructions: [
      'Füße auf einer stabilen Erhöhung (Bank, Stuhl, Stufe).',
      'Hände schulterbreit am Boden, gerade Linie von Kopf bis Ferse halten.',
      'Brust kontrolliert zum Boden senken, dabei Bauchspannung halten.',
      'Kraftvoll hochdrücken — je höher die Füße, desto mehr Schulteranteil.',
    ],
    instructionsEn: [
      'Feet on a stable elevation (bench, chair, step).',
      'Hands shoulder-width on the floor, keep a straight line from head to heels.',
      'Lower the chest under control, keep the abs braced.',
      'Press up powerfully — the higher the feet, the more shoulder involvement.',
    ],
    tips: [
      'Nicht ins Hohlkreuz fallen — Bauch und Po aktiv anspannen, besonders mit hohen Füßen.',
    ],
    tipsEn: [
      'Do not let the lower back arch — actively brace abs and glutes, especially with high feet.',
    ],
    keywordsDe: ['decline', 'füße erhöht'],
    keywordsEn: ['decline', 'feet elevated'],
  },
  {
    id: 'wide',
    slug: 'weit',
    slugs: {
      en: 'wide-pushup',
      fr: 'pompe-large',
      es: 'flexion-amplia',
      it: 'push-up-largo',
      nl: 'wijde-pushup',
      el: 'euros-push-up',
      la: 'pulsus-latus',
      no: 'bred-armheving',
      zh: 'kuanju-fuwocheng',
    },
    entryLabel: 'Wide',
    difficulty: 'intermediate',
    name: 'Weite Liegestütze',
    nameEn: 'Wide push-up',
    summary:
      'Breiter Handstand für mehr Brustaktivierung und weniger Trizeps-Belastung.',
    summaryEn:
      'Wider hand placement that emphasises the chest and offloads the triceps.',
    instructions: [
      'Hände deutlich breiter als schulterbreit, Finger leicht nach außen.',
      'Ellenbogen zeigen seitlich, beim Absenken weiter nach außen klappen.',
      'Brust kontrolliert absenken, dabei spürbares Stretchgefühl in der Brust.',
      'Bewusst aus der Brust hochdrücken — nicht mit dem Trizeps "schummeln".',
    ],
    instructionsEn: [
      'Hands set noticeably wider than shoulders, fingers angled slightly out.',
      'Elbows track to the sides, opening further as you descend.',
      'Lower the chest under control with a clear stretch sensation across the chest.',
      'Press up consciously from the chest — do not "cheat" with the triceps.',
    ],
    tips: [
      'Schultergesundheit: Schulterblätter aktiv zusammenziehen, nicht in den Gelenken hängen.',
    ],
    tipsEn: [
      'Shoulder health: keep the shoulder blades retracted, do not hang in the joints.',
    ],
    keywordsDe: ['weite liegestütze', 'weit '],
    keywordsEn: ['wide push-up', 'wide pushup'],
  },
  {
    id: 'diamond',
    slug: 'diamant',
    slugs: {
      en: 'diamond-pushup',
      fr: 'pompe-diamant',
      es: 'flexion-diamante',
      it: 'push-up-diamante',
      nl: 'diamant-pushup',
      el: 'diamantenios-push-up',
      la: 'pulsus-adamantinus',
      no: 'diamantarmheving',
      zh: 'zuanshi-fuwocheng',
    },
    entryLabel: 'Diamond',
    difficulty: 'intermediate',
    name: 'Diamant-Liegestütze',
    nameEn: 'Diamond push-up',
    summary:
      'Hände bilden ein Dreieck unter der Brust — maximale Trizeps-Aktivierung.',
    summaryEn:
      'Hands form a triangle under the chest — maximum triceps engagement.',
    instructions: [
      'Daumen und Zeigefinger berühren sich, bilden ein "Diamant"-Dreieck.',
      'Hände direkt unter der unteren Brust, nicht zu weit Richtung Bauch.',
      'Ellenbogen eng am Körper halten, nach hinten zeigend.',
      'Brust zum Diamant absenken, dann gerade hochdrücken.',
    ],
    instructionsEn: [
      'Thumbs and index fingers touch, forming a "diamond" triangle.',
      'Hands directly under the lower chest, not too far down toward the belly.',
      'Keep the elbows close to the torso, pointing back.',
      'Lower the chest to the diamond, then press straight up.',
    ],
    tips: [
      'Anfänger: an Knie-Diamant gewöhnen, bevor die volle Variante gemacht wird.',
    ],
    tipsEn: [
      'Beginners: get comfortable with knee-diamonds before attempting the full version.',
    ],
    keywordsDe: ['diamant', 'diamant-liegestütze'],
    keywordsEn: ['diamond push-up', 'diamond pushup'],
  },
  {
    id: 'pike',
    slug: 'pike',
    slugs: {
      en: 'pike-pushup',
      fr: 'pompe-pike',
      es: 'flexion-pike',
      it: 'push-up-pike',
      nl: 'pike-pushup',
      el: 'pike-push-up',
      la: 'pulsus-cunei',
      no: 'pike-armheving',
      zh: 'qiandao-fuwocheng',
    },
    entryLabel: 'Pike',
    difficulty: 'intermediate',
    name: 'Pike-Liegestütze',
    nameEn: 'Pike push-up',
    summary:
      'Liegestütze in V-Position — fast vertikales Drücken, Vorstufe zu Handstand-Liegestützen.',
    summaryEn:
      'Push-ups from a V-shape — near-vertical pressing, a stepping stone to handstand push-ups.',
    instructions: [
      'Aus dem Vierfüßlerstand Hüfte nach oben schieben — Körper bildet ein umgekehrtes V.',
      'Hände schulterbreit, Beine gestreckt oder leicht gebeugt, Po hoch.',
      'Kopf zwischen den Armen Richtung Boden senken — Ellenbogen nach hinten.',
      'Wieder hochdrücken, ohne in eine Liegestützposition abzukippen.',
    ],
    instructionsEn: [
      'From a quadruped position push the hips up — the body forms an inverted V.',
      'Hands shoulder-width, legs straight or slightly bent, hips high.',
      'Lower the head between the arms toward the floor — elbows track back.',
      'Press back up without dropping into a regular push-up position.',
    ],
    tips: [
      'Schwieriger machen: Füße auf eine Erhöhung stellen, fast vertikale Position.',
    ],
    tipsEn: [
      'Make it harder: put the feet on an elevation for a near-vertical position.',
    ],
    keywordsDe: ['pike', 'pike-liegestütze'],
    keywordsEn: ['pike push-up', 'pike pushup'],
  },
  {
    id: 'knuckle',
    slug: 'faust',
    slugs: {
      en: 'knuckle-pushup',
      fr: 'pompe-poings',
      es: 'flexion-punos',
      it: 'push-up-pugno',
      nl: 'vuist-pushup',
      el: 'grothies-push-up',
      la: 'pulsus-pugnis',
      no: 'knokearmheving',
      zh: 'quantou-fuwocheng',
    },
    entryLabel: 'Knuckle',
    difficulty: 'intermediate',
    name: 'Faust-Liegestütze',
    nameEn: 'Knuckle push-up',
    summary:
      'Auf den Knöcheln statt mit flachen Händen — schont die Handgelenke und stärkt Unterarme.',
    summaryEn:
      'Done on the knuckles instead of flat hands — easier on the wrists and strengthens the forearms.',
    instructions: [
      'Hände zu Fäusten ballen, auf den ersten zwei Knöcheln (Zeige- und Mittelfinger) abstützen.',
      'Handrücken gerade — Handgelenk nicht knicken.',
      'Auf weichem Untergrund (Matte, Handtuch) starten, später auf hartem Boden.',
      'Sonst wie Standard-Liegestütze ausführen.',
    ],
    instructionsEn: [
      'Make fists, support on the first two knuckles (index and middle finger).',
      'Keep the back of the hand straight — do not bend the wrist.',
      'Start on a soft surface (mat, towel), progress to hard floor later.',
      'Otherwise execute like a standard push-up.',
    ],
    tips: [
      'Hilfreich bei empfindlichen Handgelenken — Belastung wandert vom Gelenk in die Fingerknöchel.',
    ],
    tipsEn: [
      'Useful for sensitive wrists — load shifts from the joint into the knuckles.',
    ],
    keywordsDe: ['faust-liegestütze', 'knöchel', 'knuckle'],
    keywordsEn: ['knuckle push-up', 'knuckle pushup', 'fist push-up'],
  },
  {
    id: 'archer',
    slug: 'archer',
    slugs: {
      en: 'archer-pushup',
      fr: 'pompe-archer',
      es: 'flexion-arquero',
      it: 'push-up-archer',
      nl: 'archer-pushup',
      el: 'toxotis-push-up',
      la: 'pulsus-sagittarius',
      no: 'archer-armheving',
      zh: 'gongjianshou-fuwocheng',
    },
    entryLabel: 'Archer',
    difficulty: 'advanced',
    name: 'Archer-Liegestütze',
    nameEn: 'Archer push-up',
    summary:
      'Asymmetrische Liegestütze: ein Arm beugt, der andere bleibt gestreckt — Vorstufe zur einarmigen Liegestütze.',
    summaryEn:
      'Asymmetric push-up: one arm bends while the other stays extended — a stepping stone to the one-arm push-up.',
    instructions: [
      'Hände deutlich breiter als schulterbreit, Finger leicht nach außen.',
      'Beim Absenken zur einen Seite verlagern: ein Arm beugt, der andere bleibt fast gestreckt.',
      'Gestreckter Arm dient als Stütze, Hauptlast liegt auf dem beugenden Arm.',
      'Kontrolliert hochdrücken, dabei wieder zur Mitte verlagern, dann zur anderen Seite.',
      'Wiederholungen pro Seite zählen — die Liste meint typischerweise pro Arm.',
    ],
    instructionsEn: [
      'Hands set noticeably wider than shoulders, fingers angled slightly out.',
      'On the descent shift to one side: one arm bends, the other stays nearly straight.',
      'The straight arm acts as support; most of the load lives on the bending arm.',
      'Press back up under control, return to centre, then shift to the other side.',
      'Count reps per side — the plan usually lists the per-arm number.',
    ],
    tips: [
      'Tempo 3-1-1 (3 s runter, 1 s halten, 1 s hoch) baut spürbar mehr Kraft auf.',
    ],
    tipsEn: [
      'Tempo 3-1-1 (3 s down, 1 s hold, 1 s up) builds noticeably more strength.',
    ],
    keywordsDe: ['archer'],
    keywordsEn: ['archer'],
  },
  {
    id: 'wall-one-arm',
    slug: 'wand-einarmig',
    slugs: {
      en: 'wall-one-arm-pushup',
      fr: 'pompe-mur-un-bras',
      es: 'flexion-pared-un-brazo',
      it: 'push-up-muro-un-braccio',
      nl: 'muur-een-arm-pushup',
      el: 'toixou-monos-push-up',
      la: 'pulsus-parietis-uno-bracchio',
      no: 'vegg-en-arm-armheving',
      zh: 'qiangshang-danbi-fuwocheng',
    },
    entryLabel: 'Wall One-Arm',
    difficulty: 'intermediate',
    name: 'Wand-Einarmige',
    nameEn: 'Wall one-arm push-up',
    summary:
      'Einarmige Liegestütze gegen die Wand — sichere Einstiegsübung für die einarmige Progression.',
    summaryEn:
      'One-arm push-ups against a wall — a safe entry exercise for the one-arm progression.',
    instructions: [
      'In ungefähr einer Armlänge Abstand zur Wand stehen.',
      'Eine Hand auf Schulterhöhe an die Wand, andere Hand am Rücken oder seitlich.',
      'Körper als feste Linie kippen lassen, Ellenbogen kontrolliert beugen.',
      'Mit langsamer Exzentrik (3 s) Richtung Wand absenken, kraftvoll wegdrücken.',
    ],
    instructionsEn: [
      'Stand about an arm length away from the wall.',
      'Place one hand on the wall at shoulder height; the other hand rests on the lower back or hip.',
      'Tilt the body as a solid plank toward the wall, bending the elbow under control.',
      'Lower with a slow eccentric (3 s) toward the wall, then press away powerfully.',
    ],
    keywordsDe: ['wand-einarmig', 'wand einarmig'],
    keywordsEn: ['wall one-arm', 'wall one arm'],
  },
  {
    id: 'negative-one-arm',
    slug: 'negative-einarmig',
    slugs: {
      en: 'negative-one-arm-pushup',
      fr: 'pompe-negative-un-bras',
      es: 'flexion-negativa-un-brazo',
      it: 'push-up-negativo-un-braccio',
      nl: 'negatieve-een-arm-pushup',
      el: 'arnitiki-monos-push-up',
      la: 'pulsus-negativus-uno-bracchio',
      no: 'negativ-en-arm-armheving',
      zh: 'xiaji-danbi-fuwocheng',
    },
    entryLabel: 'Negative One-Arm',
    difficulty: 'advanced',
    name: 'Negative Einarmige',
    nameEn: 'Negative one-arm push-up',
    summary:
      'Nur die Absenkphase einarmig — kontrollierte Exzentrik baut die Kraft für die volle Bewegung auf.',
    summaryEn:
      'Only the lowering phase done one-armed — a controlled eccentric builds the strength for the full movement.',
    instructions: [
      'Eine Hand auf einer Bank/Erhöhung, Füße breit für Stabilität.',
      'Andere Hand am Rücken oder seitlich, Körper als Plank halten.',
      'In 3-5 Sekunden langsam zur Bank absenken — keine "Aufschlag"-Phase.',
      'Mit beiden Händen oder von der erhöhten Position hochdrücken — die positive Phase wird hier nicht einarmig gemacht.',
    ],
    instructionsEn: [
      'Place one hand on a bench/elevation; feet wide for stability.',
      'Other hand on the lower back or hip; hold the body as a plank.',
      'Lower toward the bench over 3-5 seconds — no "crash" phase.',
      'Press up with both hands or from the elevated position — the concentric is not done one-armed here.',
    ],
    tips: [
      'Bauen Sie die negative Zeit langsam aus: 3 s → 5 s → 8 s über mehrere Wochen.',
    ],
    tipsEn: [
      'Build the eccentric time slowly: 3 s → 5 s → 8 s across multiple weeks.',
    ],
    keywordsDe: ['negative einarmige', 'negative einarmig'],
    keywordsEn: ['negative one-arm', 'negative one arm'],
  },
  {
    id: 'partial-one-arm',
    slug: 'partielle-einarmig',
    slugs: {
      en: 'partial-one-arm-pushup',
      fr: 'pompe-partielle-un-bras',
      es: 'flexion-parcial-un-brazo',
      it: 'push-up-parziale-un-braccio',
      nl: 'gedeeltelijke-een-arm-pushup',
      el: 'meriki-monos-push-up',
      la: 'pulsus-partialis-uno-bracchio',
      no: 'delvis-en-arm-armheving',
      zh: 'bufen-danbi-fuwocheng',
    },
    entryLabel: 'Partial One-Arm',
    difficulty: 'advanced',
    name: 'Partielle Einarmige',
    nameEn: 'Partial-ROM one-arm push-up',
    summary:
      'Einarmige Liegestütze über reduzierten Bewegungsumfang (z. B. von einer niedrigen Bank).',
    summaryEn:
      'One-arm push-ups over a reduced range of motion (e.g. from a low bench).',
    instructions: [
      'Eine Hand auf einer niedrigen Bank/Stufe, Füße sehr breit (mindestens hüftbreit).',
      'Andere Hand am Rücken, Körper als Plank — Hüfte nicht rotieren lassen.',
      'Bewusst nur bis zur Bankhöhe absenken (reduzierter ROM).',
      'Mit der einen Hand hochdrücken; Höhe der Bank schrittweise reduzieren.',
    ],
    instructionsEn: [
      'Place one hand on a low bench/step; feet very wide (at least hip-width).',
      'Other hand on the lower back; hold the body as a plank — do not rotate the hips.',
      'Intentionally only descend to the bench height (reduced ROM).',
      'Press up one-armed; lower the bench height progressively.',
    ],
    keywordsDe: ['partielle einarmige', 'partielle einarmig'],
    keywordsEn: ['partial one-arm', 'partial-rom one-arm', 'partial one arm'],
  },
  {
    id: 'one-arm',
    slug: 'einarmig',
    slugs: {
      en: 'one-arm-pushup',
      fr: 'pompe-un-bras',
      es: 'flexion-un-brazo',
      it: 'push-up-un-braccio',
      nl: 'een-arm-pushup',
      el: 'monos-push-up',
      la: 'pulsus-uno-bracchio',
      no: 'en-arm-armheving',
      zh: 'danbi-fuwocheng',
    },
    entryLabel: 'One-Arm',
    difficulty: 'advanced',
    name: 'Einarmige Liegestütze',
    nameEn: 'One-arm push-up',
    summary:
      'Volle Liegestütze mit einer Hand — Königsklasse der Brust-/Trizepsübungen.',
    summaryEn:
      'Full push-up with a single hand — the king of bodyweight pressing.',
    instructions: [
      'Füße deutlich breiter als hüftbreit für maximale Stabilität (anfangs sehr breit).',
      'Eine Hand unter der Brustmitte, andere am Rücken oder seitlich.',
      'Körper bewusst als Plank halten — Hüfte und Schultern dürfen nicht rotieren.',
      'Brust kontrolliert zur Hand absenken, dann gerade hochdrücken.',
      'Mit fortschreitender Kraft die Standbreite Schritt für Schritt verringern.',
    ],
    instructionsEn: [
      'Feet noticeably wider than hip-width for maximum stability (very wide at the start).',
      'One hand under the centre of the chest; the other on the lower back or hip.',
      'Hold the body intentionally as a plank — hips and shoulders must not rotate.',
      'Lower the chest to the hand under control, then press straight up.',
      'As strength grows, narrow the foot stance step by step.',
    ],
    tips: [
      'Wiederholungen werden pro Seite gezählt — dominante Seite zuerst, schwächere danach.',
    ],
    tipsEn: [
      'Reps are counted per side — start with the dominant side and match it on the weaker side.',
    ],
    keywordsDe: ['volle einarmige', 'einarmige liegestütze', 'einarmige'],
    keywordsEn: [
      'full one-arm',
      'one-arm push-up',
      'one arm push-up',
      'one-arm',
    ],
  },
];

const TYPES_BY_ID: ReadonlyMap<PushupTypeId, PushupTypeInfo> = new Map(
  PUSHUP_TYPES.map((t) => [t.id, t])
);

/**
 * Build a slug → type lookup that includes the default slug AND every
 * per-locale override. A slug that exists in multiple types would be
 * a catalog bug; the build asserts uniqueness via this map (Map keys
 * silently overwrite, so a duplicate would surface as a wrong-type
 * resolution at runtime — caught by tests).
 */
const TYPES_BY_SLUG: ReadonlyMap<string, PushupTypeInfo> = (() => {
  const map = new Map<string, PushupTypeInfo>();
  for (const t of PUSHUP_TYPES) {
    map.set(t.slug, t);
    if (t.slugs) {
      for (const localeSlug of Object.values(t.slugs)) {
        if (localeSlug) map.set(localeSlug, t);
      }
    }
  }
  return map;
})();

const TYPES_BY_ENTRY_LABEL: ReadonlyMap<string, PushupTypeInfo> = new Map(
  PUSHUP_TYPES.map((t) => [t.entryLabel.toLowerCase(), t])
);

export function findPushupType(id: PushupTypeId): PushupTypeInfo | null {
  return TYPES_BY_ID.get(id) ?? null;
}

/**
 * Resolve a wiki slug back to a catalog entry. Accepts the default
 * (German) slug and every per-locale override emitted by
 * `localizePushupTypeSlug`, so old DE URLs and current locale-specific
 * URLs both render the same detail page. Returns null only for slugs
 * outside the catalog (which the detail component redirects to the
 * overview).
 */
export function findPushupTypeBySlug(slug: string): PushupTypeInfo | null {
  return TYPES_BY_SLUG.get(slug) ?? null;
}

/**
 * Returns the locale-specific slug for the wiki detail URL, falling
 * back to the catalog default (`type.slug`) for any locale without an
 * override. Always returns the canonical slug for the active locale —
 * call this when emitting `routerLink`, canonical URLs, hreflang
 * alternates, or sitemap entries to keep the URL set consistent.
 */
export function localizePushupTypeSlug(
  type: PushupTypeInfo,
  locale: string
): string {
  const primary = locale.toLowerCase().split(/[-_]/)[0];
  return type.slugs?.[primary] ?? type.slug;
}

/**
 * Map of `<locale> → <slug>` for one type, including the default
 * locale (German) under `de`. Useful for emitting hreflang alternate
 * sets and the sitemap's `alternateSlugs`.
 */
export function pushupTypeSlugByLocale(
  type: PushupTypeInfo,
  locales: ReadonlyArray<string>
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const lang of locales) {
    out[lang] = type.slugs?.[lang] ?? type.slug;
  }
  return out;
}

/**
 * Look up a catalog entry by the entry-dialog's stored label
 * (case-insensitive). Returns null when the label is unknown — e.g.
 * when the user typed a custom value.
 */
export function findPushupTypeByEntryLabel(
  label: string | null | undefined
): PushupTypeInfo | null {
  if (!label) return null;
  return TYPES_BY_ENTRY_LABEL.get(label.toLowerCase().trim()) ?? null;
}

/**
 * Returns the localized name + summary for the active Angular locale.
 * Resolves the locale's primary subtag (e.g. `fr-CH` → `fr`) and looks
 * up the markdown-sourced override in `PUSHUP_TYPE_CONTENT`. Falls back
 * through `en` → `de` → legacy parallel `*En`/`*` fields on
 * PUSHUP_TYPES so unsupported locales still render something.
 */
export function localizePushupType(
  type: PushupTypeInfo,
  locale: string
): {
  name: string;
  summary: string;
  instructions: ReadonlyArray<string>;
  tips: ReadonlyArray<string>;
} {
  const primary = locale.toLowerCase().split(/[-_]/)[0];
  const overrides = PUSHUP_TYPE_CONTENT[type.id];
  const override =
    overrides?.[primary] ?? overrides?.['en'] ?? overrides?.['de'];
  if (override) {
    return {
      name: override.name,
      summary: override.summary,
      instructions: override.instructions,
      tips: override.tips,
    };
  }
  const isEnglish = primary === 'en';
  return {
    name: isEnglish ? type.nameEn : type.name,
    summary: isEnglish ? type.summaryEn : type.summary,
    instructions: isEnglish ? type.instructionsEn : type.instructions,
    tips: (isEnglish ? type.tipsEn : type.tips) ?? [],
  };
}

/**
 * Detects the push-up types referenced by a training-plan day's
 * description. Scans both the German and English keyword sets against
 * the (already-localized) description, returning a de-duplicated list
 * in catalog order.
 *
 * Why keyword detection: the static training-plan catalog references
 * types only inline in human-readable descriptions. Doing the matching
 * here keeps the catalog editorial (no per-day type tagging) while
 * still enabling tooltips and wiki deep-links.
 *
 * Why both keyword sets in one pass: the catalog descriptions are
 * emitted via `$localize` and the runtime sees only the active-locale
 * string. By matching against both `keywordsDe` and `keywordsEn`, the
 * same detection works on the German source and on every translated
 * locale without per-locale keyword tables.
 */
export function detectPushupTypes(
  description: string
): ReadonlyArray<PushupTypeInfo> {
  const text = description.toLowerCase();
  const matched: PushupTypeInfo[] = [];
  for (const type of PUSHUP_TYPES) {
    const hit =
      type.keywordsDe.some((kw) => text.includes(kw)) ||
      type.keywordsEn.some((kw) => text.includes(kw));
    if (hit) {
      matched.push(type);
    }
  }
  // Specificity rule 1: when "einarmige" matches but a more specific
  // variant (wall-one-arm, negative-one-arm, partial-one-arm) also
  // matches, drop the generic "one-arm" entry.
  const hasSpecificOneArm = matched.some(
    (t) =>
      t.id === 'wall-one-arm' ||
      t.id === 'negative-one-arm' ||
      t.id === 'partial-one-arm'
  );
  let result = hasSpecificOneArm
    ? matched.filter((t) => t.id !== 'one-arm')
    : matched;

  // Specificity rule 2: "standard" is the implicit fallback; if any
  // explicit variant is mentioned (e.g. "saubere einarmige" → both
  // standard and one-arm), keep only the variant.
  const hasNonStandard = result.some((t) => t.id !== 'standard');
  if (hasNonStandard) {
    result = result.filter((t) => t.id !== 'standard');
  }
  return result;
}
