#!/usr/bin/env node
/**
 * Translate every `plan.*` XLIFF unit added by the diverse-plans
 * feature into every supported target locale. Replaces
 * `translate-en-plans.mjs` (which only handled `en`) and also
 * normalises any mis-indented `plan.*` units left over from earlier
 * sync runs.
 *
 * For each locale we keep:
 *   - `titles` / `summaries`: hand-translated full strings keyed by
 *     unit id (10 entries per locale).
 *   - `phrases`: an ordered list of `[de, target]` tuples that are
 *     applied (longest-match first via length-sort) to every day
 *     description. The German source catalog is highly structured
 *     ("Push 3×N saubere Liegestütze · Pull 3×M …"), so a phrase
 *     dictionary handles 100+ day units cleanly.
 *
 * Re-run after `nx run web:extract-i18n` whenever a `plan.*` unit
 * changes. Idempotent.
 */
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALE_DIR = join(__dirname, '..', '..', 'web', 'src', 'locale');
const SOURCE_FILE = 'messages.xlf';

// ── Per-locale data ─────────────────────────────────────────────────
//
// `phrases` are applied in length-descending order; an entry like
// `'Hängendes Knieheben'` is rewritten before the bare `'Knieheben'`.
// XML entities in the source (`&amp;`, `&quot;`) must match literally
// because we operate on the XLIFF text, not on decoded strings.

/** @type {Record<string, {titles: Record<string,string>, summaries: Record<string,string>, phrases: Array<[string,string]>}>} */
const LOCALES = {
  en: {
    titles: {
      'plan.push-pull-6w.title': 'Push &amp; Pull Balance — 6-week plan',
      'plan.full-body-6w.title': 'Full Body Strong — 6-week full-body plan',
      'plan.core-4w.title': 'Core Foundations — 4-week core plan',
      'plan.hiit-4w.title': 'HIIT Burner — 4-week conditioning plan',
      'plan.mobility-2w.title': 'Mobility &amp; Recovery — 2-week deload',
    },
    summaries: {
      'plan.push-pull-6w.summary':
        'Symmetric 6-week plan for push-ups and pulling work (rows, pull-up negatives, face pulls). Avoids the classic &quot;push only&quot; imbalance and strengthens the posterior chain equally. One dedicated pull day per week on top of the push progression.',
      'plan.full-body-6w.summary':
        'Six weeks of full-body circuits: push-ups, squats, lunges, glute bridges, and planks in 3-, 4-, and 5-round circuits. Three training days per week, clearly increasing volume, functional final test in week 6.',
      'plan.core-4w.summary':
        'Four weeks of core stability: plank, hollow hold, dead bug, leg raises, and rotational work. Each training day also includes a moderate push-up activation. Four training days plus one light day per week, final test with plank hold and hollow hold.',
      'plan.hiit-4w.summary':
        'Four weeks of high-intensity intervals with push-ups, burpees, mountain climbers, jumping jacks, and squats. Tabata, pyramid, and EMOM structures. Works well as a conditioning booster between classic push-up plans.',
      'plan.mobility-2w.summary':
        'Two weeks of active recovery: daily mobility, yoga, and stretching sessions with light push-up volume. Ideal as a deload between two hard plans or to ease back in after a training break.',
    },
    phrases: [
      ['saubere Liegestütze', 'clean push-ups'],
      ['Knie-Liegestütze als Aktivierung', 'knee push-ups as activation'],
      ['Knie-Liegestütze', 'knee push-ups'],
      ['Hängendes Knieheben', 'hanging knee raises'],
      ['invertierte Ruderzüge', 'inverted rows'],
      ['Klimmzug-Negative', 'pull-up negatives'],
      ['Sumo-Kniebeugen', 'sumo squats'],
      ['Jump Squats', 'jump squats'],
      ['Aktive Erholung', 'Active recovery'],
      ['Leichter Tag', 'Light day'],
      ['Pull-Tag', 'Pull day'],
      ['Pull-Schwerpunkt', 'Pull focus'],
      ['Brust- und Rücken-Mobility', 'chest and back mobility'],
      ['Brust-Stretching', 'chest stretching'],
      ['Schulter-Mobility', 'shoulder mobility'],
      ['Hip Opener', 'hip opener'],
      ['Dead Bugs', 'dead bugs'],
      ['Dead Bug', 'dead bug'],
      ['Russian Twists', 'Russian twists'],
      ['Russian Twist', 'Russian twist'],
      ['Side Plank', 'side plank'],
      ['Wall-Sit', 'wall-sit'],
      ['Glute Bridges', 'glute bridges'],
      ['Hip Thrusts', 'hip thrusts'],
      ['Step-Ups', 'step-ups'],
      ['Hollow Hold', 'hollow hold'],
      ['Hollow-Hold-Zeit', 'hollow-hold time'],
      ['Plank-Halt', 'plank hold'],
      ['Plank-Zeit', 'plank time'],
      ['Mountain Climbers', 'mountain climbers'],
      ['Jumping Jacks', 'jumping jacks'],
      ['Hampelmänner', 'jumping jacks'],
      ['Burpees', 'burpees'],
      ['Squats', 'squats'],
      ['Kniebeugen', 'squats'],
      ['Ausfallschritte', 'lunges'],
      ['Liegestützen', 'push-ups'],
      ['Liegestütze', 'push-ups'],
      ['Klimmzügen', 'pull-ups'],
      ['Klimmzüge', 'pull-ups'],
      ['Klimmzug', 'pull-up'],
      ['Australian Rows', 'Australian rows'],
      ['Face Pulls', 'face pulls'],
      ['Rudern', 'rows'],
      ['Cat-Cow', 'cat-cow'],
      ['Foam Rolling', 'foam rolling'],
      ['Yoga-Flow', 'yoga flow'],
      ['Dynamisches Aufwärmen', 'dynamic warm-up'],
      ['lockeres Cardio', 'easy cardio'],
      ['Spaziergang', 'walk'],
      ['Mobility-Session', 'mobility session'],
      ['vollständige', 'full'],
      ['Stretching', 'stretching'],
      ['Mobility', 'mobility'],
      ['Yoga', 'yoga'],
      ['Gehen', 'walking'],
      ['Ruhetag', 'Rest day'],
      ['Form-Check', 'form check'],
      ['Peak-Zirkel', 'Peak circuit'],
      ['Taper-Zirkel', 'Taper circuit'],
      ['Taper-Tag', 'Taper day'],
      ['Core-Power', 'Core power'],
      ['Core-Zirkel', 'Core circuit'],
      ['Baseline-Test', 'Baseline test'],
      ['Konditionstest', 'Conditioning test'],
      ['Funktionstest', 'Functional test'],
      ['Endtest', 'Final test'],
      ['Baseline', 'Baseline'],
      ['Zirkel', 'Circuit'],
      ['HIIT-Finale', 'HIIT finale'],
      ['HIIT-Ladder', 'HIIT ladder'],
      ['Sätze', 'sets'],
      ['Satz', 'set'],
      ['Runden', 'rounds'],
      ['Runde', 'round'],
      ['Pause', 'rest'],
      ['Wiederholungen', 'reps'],
      ['Wiederholung', 'rep'],
      ['weniger', 'fewer'],
      ['Bestzeit notieren', 'record your best time'],
      ['auf Zeit', 'for time'],
      ['in einem Satz', 'in a single set'],
      ['je Bein', 'per leg'],
      ['je Seite', 'per side'],
      ['pro Minute', 'per minute'],
      ['jede Runde', 'each round'],
      ['saubere', 'clean'],
      ['kontrolliertes Tempo', 'controlled tempo'],
      ['schwer', 'heavy'],
      ['oder Negative', 'or negatives'],
      ['Ziel', 'target'],
      ['Exzentrik', 'eccentric'],
      ['nach Bedarf', 'as needed'],
      ['abwechselnd', 'alternating'],
      ['maximale', 'max'],
      ['Plank', 'plank'],
      ['LS', 'push-ups'],
    ],
  },

  es: {
    titles: {
      'plan.push-pull-6w.title': 'Push &amp; Pull Balance — plan de 6 semanas',
      'plan.full-body-6w.title':
        'Full Body Strong — plan de cuerpo completo de 6 semanas',
      'plan.core-4w.title': 'Core Foundations — plan de core de 4 semanas',
      'plan.hiit-4w.title':
        'HIIT Burner — plan de acondicionamiento de 4 semanas',
      'plan.mobility-2w.title':
        'Mobility &amp; Recovery — descarga de 2 semanas',
    },
    summaries: {
      'plan.push-pull-6w.summary':
        'Plan simétrico de 6 semanas para flexiones y trabajo de tracción (remos, dominadas negativas, face pulls). Evita el clásico desequilibrio &quot;solo empuje&quot; y fortalece la cadena posterior por igual. Un día dedicado a la tracción por semana, además de la progresión de empuje.',
      'plan.full-body-6w.summary':
        'Seis semanas de circuitos de cuerpo completo: flexiones, sentadillas, zancadas, puentes de glúteo y planchas en circuitos de 3, 4 y 5 rondas. Tres días de entrenamiento por semana, volumen creciente y test funcional final en la semana 6.',
      'plan.core-4w.summary':
        'Cuatro semanas de estabilidad de core: plancha, hollow hold, dead bug, elevaciones de piernas y trabajo de rotación. Cada día de entrenamiento incluye también una activación moderada con flexiones. Cuatro días de entrenamiento más un día ligero por semana, test final con plancha mantenida y hollow hold.',
      'plan.hiit-4w.summary':
        'Cuatro semanas de intervalos de alta intensidad con flexiones, burpees, escaladores, jumping jacks y sentadillas. Estructuras Tabata, pirámide y EMOM. Funciona bien como impulso de acondicionamiento entre planes clásicos de flexiones.',
      'plan.mobility-2w.summary':
        'Dos semanas de recuperación activa: sesiones diarias de movilidad, yoga y estiramientos con un volumen ligero de flexiones. Ideal como descarga entre dos planes exigentes o para retomar el entrenamiento tras una pausa.',
    },
    phrases: [
      ['saubere Liegestütze', 'flexiones limpias'],
      [
        'Knie-Liegestütze als Aktivierung',
        'flexiones de rodillas como activación',
      ],
      ['Knie-Liegestütze', 'flexiones de rodillas'],
      ['Hängendes Knieheben', 'elevación de rodillas colgado'],
      ['invertierte Ruderzüge', 'remos invertidos'],
      ['Klimmzug-Negative', 'dominadas negativas'],
      ['Sumo-Kniebeugen', 'sentadillas sumo'],
      ['Jump Squats', 'sentadillas con salto'],
      ['Aktive Erholung', 'Recuperación activa'],
      ['Leichter Tag', 'Día ligero'],
      ['Pull-Tag', 'Día de tracción'],
      ['Pull-Schwerpunkt', 'Enfoque de tracción'],
      ['Brust- und Rücken-Mobility', 'movilidad de pecho y espalda'],
      ['Brust-Stretching', 'estiramiento de pecho'],
      ['Schulter-Mobility', 'movilidad de hombros'],
      ['Hip Opener', 'apertura de cadera'],
      ['Dead Bugs', 'dead bugs'],
      ['Dead Bug', 'dead bug'],
      ['Russian Twists', 'giros rusos'],
      ['Russian Twist', 'giro ruso'],
      ['Side Plank', 'plancha lateral'],
      ['Wall-Sit', 'sentadilla isométrica'],
      ['Glute Bridges', 'puentes de glúteo'],
      ['Hip Thrusts', 'empujes de cadera'],
      ['Step-Ups', 'subidas al cajón'],
      ['Hollow Hold', 'hollow hold'],
      ['Hollow-Hold-Zeit', 'tiempo de hollow hold'],
      ['Plank-Halt', 'plancha mantenida'],
      ['Plank-Zeit', 'tiempo de plancha'],
      ['Mountain Climbers', 'escaladores'],
      ['Jumping Jacks', 'jumping jacks'],
      ['Hampelmänner', 'jumping jacks'],
      ['Burpees', 'burpees'],
      ['Squats', 'sentadillas'],
      ['Kniebeugen', 'sentadillas'],
      ['Ausfallschritte', 'zancadas'],
      ['Liegestützen', 'flexiones'],
      ['Liegestütze', 'flexiones'],
      ['Klimmzügen', 'dominadas'],
      ['Klimmzüge', 'dominadas'],
      ['Klimmzug', 'dominada'],
      ['Australian Rows', 'remos australianos'],
      ['Face Pulls', 'face pulls'],
      ['Rudern', 'remos'],
      ['Cat-Cow', 'gato-vaca'],
      ['Foam Rolling', 'rodillo de espuma'],
      ['Yoga-Flow', 'flujo de yoga'],
      ['Dynamisches Aufwärmen', 'Calentamiento dinámico'],
      ['lockeres Cardio', 'cardio suave'],
      ['Spaziergang', 'paseo'],
      ['Mobility-Session', 'sesión de movilidad'],
      ['vollständige', 'completa'],
      ['Stretching', 'estiramientos'],
      ['Mobility', 'movilidad'],
      ['Yoga', 'yoga'],
      ['Gehen', 'caminar'],
      ['Ruhetag', 'Día de descanso'],
      ['Form-Check', 'control de forma'],
      ['Peak-Zirkel', 'Circuito pico'],
      ['Taper-Zirkel', 'Circuito de descarga'],
      ['Taper-Tag', 'Día de descarga'],
      ['Core-Power', 'Core potencia'],
      ['Core-Zirkel', 'Circuito de core'],
      ['Baseline-Test', 'Test de referencia'],
      ['Konditionstest', 'Test de condición'],
      ['Funktionstest', 'Test funcional'],
      ['Endtest', 'Test final'],
      ['Baseline', 'Referencia'],
      ['Zirkel', 'Circuito'],
      ['HIIT-Finale', 'Final HIIT'],
      ['HIIT-Ladder', 'Escalera HIIT'],
      ['Sätze', 'series'],
      ['Satz', 'serie'],
      ['Runden', 'rondas'],
      ['Runde', 'ronda'],
      ['Pause', 'descanso'],
      ['Wiederholungen', 'repeticiones'],
      ['Wiederholung', 'repetición'],
      ['weniger', 'menos'],
      ['Bestzeit notieren', 'anota tu mejor tiempo'],
      ['auf Zeit', 'por tiempo'],
      ['in einem Satz', 'en una serie'],
      ['je Bein', 'por pierna'],
      ['je Seite', 'por lado'],
      ['pro Minute', 'por minuto'],
      ['jede Runde', 'cada ronda'],
      ['saubere', 'limpias'],
      ['kontrolliertes Tempo', 'ritmo controlado'],
      ['schwer', 'pesado'],
      ['oder Negative', 'o negativas'],
      ['Ziel', 'objetivo'],
      ['Exzentrik', 'excéntrica'],
      ['nach Bedarf', 'según necesidad'],
      ['abwechselnd', 'alternando'],
      ['maximale', 'máximo'],
      ['Plank', 'plancha'],
      ['LS', 'flexiones'],
    ],
  },

  fr: {
    titles: {
      'plan.push-pull-6w.title': 'Push &amp; Pull Balance — plan de 6 semaines',
      'plan.full-body-6w.title':
        'Full Body Strong — plan corps complet de 6 semaines',
      'plan.core-4w.title': 'Core Foundations — plan gainage de 4 semaines',
      'plan.hiit-4w.title':
        'HIIT Burner — plan de conditionnement de 4 semaines',
      'plan.mobility-2w.title':
        'Mobility &amp; Recovery — décharge de 2 semaines',
    },
    summaries: {
      'plan.push-pull-6w.summary':
        'Plan symétrique de 6 semaines pour les pompes et le travail de tirage (rangées, tractions négatives, face pulls). Évite le déséquilibre classique &quot;poussée seule&quot; et renforce la chaîne postérieure à parts égales. Une journée de tirage dédiée par semaine en plus de la progression de poussée.',
      'plan.full-body-6w.summary':
        "Six semaines de circuits corps complet : pompes, squats, fentes, ponts fessiers et planches en circuits de 3, 4 et 5 tours. Trois jours d'entraînement par semaine, volume croissant et test fonctionnel final en semaine 6.",
      'plan.core-4w.summary':
        "Quatre semaines de stabilité du tronc : planche, hollow hold, dead bug, relevés de jambes et travail rotationnel. Chaque jour inclut aussi une activation modérée des pompes. Quatre jours d'entraînement plus un jour léger par semaine, test final avec planche maintenue et hollow hold.",
      'plan.hiit-4w.summary':
        "Quatre semaines d'intervalles à haute intensité avec pompes, burpees, mountain climbers, jumping jacks et squats. Structures Tabata, pyramide et EMOM. Idéal comme booster de conditionnement entre des plans classiques de pompes.",
      'plan.mobility-2w.summary':
        "Deux semaines de récupération active : séances quotidiennes de mobilité, yoga et étirements avec un volume léger de pompes. Idéal comme décharge entre deux plans intenses ou pour reprendre après une pause d'entraînement.",
    },
    phrases: [
      ['saubere Liegestütze', 'pompes propres'],
      [
        'Knie-Liegestütze als Aktivierung',
        'pompes sur les genoux en activation',
      ],
      ['Knie-Liegestütze', 'pompes sur les genoux'],
      ['Hängendes Knieheben', 'relevés de genoux suspendus'],
      ['invertierte Ruderzüge', 'rangées inversées'],
      ['Klimmzug-Negative', 'tractions négatives'],
      ['Sumo-Kniebeugen', 'squats sumo'],
      ['Jump Squats', 'squats sautés'],
      ['Aktive Erholung', 'Récupération active'],
      ['Leichter Tag', 'Jour léger'],
      ['Pull-Tag', 'Jour de tirage'],
      ['Pull-Schwerpunkt', 'Accent sur le tirage'],
      ['Brust- und Rücken-Mobility', 'mobilité poitrine et dos'],
      ['Brust-Stretching', 'étirement de la poitrine'],
      ['Schulter-Mobility', 'mobilité des épaules'],
      ['Hip Opener', 'ouverture des hanches'],
      ['Dead Bugs', 'dead bugs'],
      ['Dead Bug', 'dead bug'],
      ['Russian Twists', 'russian twists'],
      ['Russian Twist', 'russian twist'],
      ['Side Plank', 'planche latérale'],
      ['Wall-Sit', 'chaise murale'],
      ['Glute Bridges', 'ponts fessiers'],
      ['Hip Thrusts', 'hip thrusts'],
      ['Step-Ups', 'montées sur banc'],
      ['Hollow Hold', 'hollow hold'],
      ['Hollow-Hold-Zeit', 'temps de hollow hold'],
      ['Plank-Halt', 'planche maintenue'],
      ['Plank-Zeit', 'temps de planche'],
      ['Mountain Climbers', 'mountain climbers'],
      ['Jumping Jacks', 'jumping jacks'],
      ['Hampelmänner', 'jumping jacks'],
      ['Burpees', 'burpees'],
      ['Squats', 'squats'],
      ['Kniebeugen', 'squats'],
      ['Ausfallschritte', 'fentes'],
      ['Liegestützen', 'pompes'],
      ['Liegestütze', 'pompes'],
      ['Klimmzügen', 'tractions'],
      ['Klimmzüge', 'tractions'],
      ['Klimmzug', 'traction'],
      ['Australian Rows', 'rangées australiennes'],
      ['Face Pulls', 'face pulls'],
      ['Rudern', 'rangées'],
      ['Cat-Cow', 'chat-vache'],
      ['Foam Rolling', 'rouleau de massage'],
      ['Yoga-Flow', 'flow de yoga'],
      ['Dynamisches Aufwärmen', 'Échauffement dynamique'],
      ['lockeres Cardio', 'cardio léger'],
      ['Spaziergang', 'marche'],
      ['Mobility-Session', 'séance de mobilité'],
      ['vollständige', 'complète'],
      ['Stretching', 'étirements'],
      ['Mobility', 'mobilité'],
      ['Yoga', 'yoga'],
      ['Gehen', 'marche'],
      ['Ruhetag', 'Jour de repos'],
      ['Form-Check', 'vérification de la forme'],
      ['Peak-Zirkel', 'Circuit pic'],
      ['Taper-Zirkel', "Circuit d'affûtage"],
      ['Taper-Tag', "Jour d'affûtage"],
      ['Core-Power', 'Core puissance'],
      ['Core-Zirkel', 'Circuit gainage'],
      ['Baseline-Test', 'Test de référence'],
      ['Konditionstest', 'Test de condition'],
      ['Funktionstest', 'Test fonctionnel'],
      ['Endtest', 'Test final'],
      ['Baseline', 'Référence'],
      ['Zirkel', 'Circuit'],
      ['HIIT-Finale', 'Finale HIIT'],
      ['HIIT-Ladder', 'Échelle HIIT'],
      ['Sätze', 'séries'],
      ['Satz', 'série'],
      ['Runden', 'tours'],
      ['Runde', 'tour'],
      ['Pause', 'repos'],
      ['Wiederholungen', 'répétitions'],
      ['Wiederholung', 'répétition'],
      ['weniger', 'de moins'],
      ['Bestzeit notieren', 'note ton meilleur temps'],
      ['auf Zeit', 'contre la montre'],
      ['in einem Satz', 'en une série'],
      ['je Bein', 'par jambe'],
      ['je Seite', 'par côté'],
      ['pro Minute', 'par minute'],
      ['jede Runde', 'chaque tour'],
      ['saubere', 'propres'],
      ['kontrolliertes Tempo', 'tempo contrôlé'],
      ['schwer', 'lourd'],
      ['oder Negative', 'ou négatives'],
      ['Ziel', 'objectif'],
      ['Exzentrik', 'excentrique'],
      ['nach Bedarf', 'selon les besoins'],
      ['abwechselnd', 'en alternance'],
      ['maximale', 'maximales'],
      ['Plank', 'planche'],
      ['LS', 'pompes'],
    ],
  },

  it: {
    titles: {
      'plan.push-pull-6w.title':
        'Push &amp; Pull Balance — piano di 6 settimane',
      'plan.full-body-6w.title':
        'Full Body Strong — piano full body di 6 settimane',
      'plan.core-4w.title': 'Core Foundations — piano core di 4 settimane',
      'plan.hiit-4w.title':
        'HIIT Burner — piano di condizionamento di 4 settimane',
      'plan.mobility-2w.title':
        'Mobility &amp; Recovery — scarico di 2 settimane',
    },
    summaries: {
      'plan.push-pull-6w.summary':
        'Piano simmetrico di 6 settimane per piegamenti e lavoro di trazione (rematori, trazioni negative, face pull). Evita il classico squilibrio &quot;solo spinta&quot; e rafforza la catena posteriore in modo equilibrato. Un giorno dedicato alla trazione a settimana oltre alla progressione di spinta.',
      'plan.full-body-6w.summary':
        'Sei settimane di circuiti full body: piegamenti, squat, affondi, ponti per i glutei e plank in circuiti da 3, 4 e 5 round. Tre giorni di allenamento a settimana, volume in chiara crescita e test funzionale finale alla settimana 6.',
      'plan.core-4w.summary':
        "Quattro settimane di stabilità del core: plank, hollow hold, dead bug, sollevamenti delle gambe e lavoro rotazionale. Ogni giorno di allenamento prevede anche un'attivazione moderata di piegamenti. Quattro giorni di allenamento più un giorno leggero a settimana, test finale con plank mantenuto e hollow hold.",
      'plan.hiit-4w.summary':
        'Quattro settimane di intervalli ad alta intensità con piegamenti, burpees, mountain climber, jumping jack e squat. Strutture Tabata, piramide ed EMOM. Funziona bene come booster di condizionamento tra piani classici di piegamenti.',
      'plan.mobility-2w.summary':
        'Due settimane di recupero attivo: sessioni quotidiane di mobilità, yoga e stretching con un volume leggero di piegamenti. Ideale come scarico tra due piani intensi o per riprendere dopo una pausa.',
    },
    phrases: [
      ['saubere Liegestütze', 'piegamenti puliti'],
      [
        'Knie-Liegestütze als Aktivierung',
        'piegamenti sulle ginocchia come attivazione',
      ],
      ['Knie-Liegestütze', 'piegamenti sulle ginocchia'],
      ['Hängendes Knieheben', 'sollevamento ginocchia appeso'],
      ['invertierte Ruderzüge', 'rematori invertiti'],
      ['Klimmzug-Negative', 'trazioni negative'],
      ['Sumo-Kniebeugen', 'squat sumo'],
      ['Jump Squats', 'jump squat'],
      ['Aktive Erholung', 'Recupero attivo'],
      ['Leichter Tag', 'Giorno leggero'],
      ['Pull-Tag', 'Giorno di trazione'],
      ['Pull-Schwerpunkt', 'Focus trazione'],
      ['Brust- und Rücken-Mobility', 'mobilità petto e schiena'],
      ['Brust-Stretching', 'stretching del petto'],
      ['Schulter-Mobility', 'mobilità delle spalle'],
      ['Hip Opener', 'apertura delle anche'],
      ['Dead Bugs', 'dead bug'],
      ['Dead Bug', 'dead bug'],
      ['Russian Twists', 'russian twist'],
      ['Russian Twist', 'russian twist'],
      ['Side Plank', 'side plank'],
      ['Wall-Sit', 'wall sit'],
      ['Glute Bridges', 'ponti per i glutei'],
      ['Hip Thrusts', 'hip thrust'],
      ['Step-Ups', 'step-up'],
      ['Hollow Hold', 'hollow hold'],
      ['Hollow-Hold-Zeit', 'tempo di hollow hold'],
      ['Plank-Halt', 'plank mantenuto'],
      ['Plank-Zeit', 'tempo di plank'],
      ['Mountain Climbers', 'mountain climber'],
      ['Jumping Jacks', 'jumping jack'],
      ['Hampelmänner', 'jumping jack'],
      ['Burpees', 'burpees'],
      ['Squats', 'squat'],
      ['Kniebeugen', 'squat'],
      ['Ausfallschritte', 'affondi'],
      ['Liegestützen', 'piegamenti'],
      ['Liegestütze', 'piegamenti'],
      ['Klimmzügen', 'trazioni'],
      ['Klimmzüge', 'trazioni'],
      ['Klimmzug', 'trazione'],
      ['Australian Rows', 'rematori australiani'],
      ['Face Pulls', 'face pull'],
      ['Rudern', 'rematori'],
      ['Cat-Cow', 'gatto-mucca'],
      ['Foam Rolling', 'foam rolling'],
      ['Yoga-Flow', 'yoga flow'],
      ['Dynamisches Aufwärmen', 'Riscaldamento dinamico'],
      ['lockeres Cardio', 'cardio leggero'],
      ['Spaziergang', 'camminata'],
      ['Mobility-Session', 'sessione di mobilità'],
      ['vollständige', 'completa'],
      ['Stretching', 'stretching'],
      ['Mobility', 'mobilità'],
      ['Yoga', 'yoga'],
      ['Gehen', 'camminata'],
      ['Ruhetag', 'Giorno di riposo'],
      ['Form-Check', 'controllo della forma'],
      ['Peak-Zirkel', 'Circuito di picco'],
      ['Taper-Zirkel', 'Circuito di scarico'],
      ['Taper-Tag', 'Giorno di scarico'],
      ['Core-Power', 'Core potenza'],
      ['Core-Zirkel', 'Circuito core'],
      ['Baseline-Test', 'Test di riferimento'],
      ['Konditionstest', 'Test di condizione'],
      ['Funktionstest', 'Test funzionale'],
      ['Endtest', 'Test finale'],
      ['Baseline', 'Riferimento'],
      ['Zirkel', 'Circuito'],
      ['HIIT-Finale', 'Finale HIIT'],
      ['HIIT-Ladder', 'Scala HIIT'],
      ['Sätze', 'serie'],
      ['Satz', 'serie'],
      ['Runden', 'round'],
      ['Runde', 'round'],
      ['Pause', 'pausa'],
      ['Wiederholungen', 'ripetizioni'],
      ['Wiederholung', 'ripetizione'],
      ['weniger', 'in meno'],
      ['Bestzeit notieren', 'annota il tuo miglior tempo'],
      ['auf Zeit', 'a tempo'],
      ['in einem Satz', 'in una sola serie'],
      ['je Bein', 'per gamba'],
      ['je Seite', 'per lato'],
      ['pro Minute', 'al minuto'],
      ['jede Runde', 'ogni round'],
      ['saubere', 'pulite'],
      ['kontrolliertes Tempo', 'tempo controllato'],
      ['schwer', 'pesante'],
      ['oder Negative', 'o negative'],
      ['Ziel', 'obiettivo'],
      ['Exzentrik', 'eccentrica'],
      ['nach Bedarf', 'secondo necessità'],
      ['abwechselnd', 'alternando'],
      ['maximale', 'massimo'],
      ['Plank', 'plank'],
      ['LS', 'piegamenti'],
    ],
  },

  nl: {
    titles: {
      'plan.push-pull-6w.title': 'Push &amp; Pull Balance — 6-weken-plan',
      'plan.full-body-6w.title': 'Full Body Strong — 6-weken full-body plan',
      'plan.core-4w.title': 'Core Foundations — 4-weken core-plan',
      'plan.hiit-4w.title': 'HIIT Burner — 4-weken conditieplan',
      'plan.mobility-2w.title': 'Mobility &amp; Recovery — 2-weken deload',
    },
    summaries: {
      'plan.push-pull-6w.summary':
        'Symmetrisch 6-weken-plan voor push-ups en trekwerk (rows, pull-up negatives, face pulls). Vermijdt de klassieke &quot;alleen push&quot;-onbalans en versterkt de achterketen gelijkwaardig. Eén toegewijde pull-dag per week bovenop de push-progressie.',
      'plan.full-body-6w.summary':
        'Zes weken full-body circuits: push-ups, squats, lunges, glute bridges en planks in circuits van 3, 4 en 5 rondes. Drie trainingsdagen per week, duidelijk stijgend volume, functionele eindtest in week 6.',
      'plan.core-4w.summary':
        'Vier weken core-stabiliteit: plank, hollow hold, dead bug, beenheffen en rotatiewerk. Elke trainingsdag bevat ook een matige push-up-activering. Vier trainingsdagen plus één lichte dag per week, eindtest met plank-hold en hollow hold.',
      'plan.hiit-4w.summary':
        'Vier weken hoogintensieve intervallen met push-ups, burpees, mountain climbers, jumping jacks en squats. Tabata-, piramide- en EMOM-structuren. Werkt goed als conditiebooster tussen klassieke push-up-plannen.',
      'plan.mobility-2w.summary':
        'Twee weken actieve recuperatie: dagelijkse mobiliteits-, yoga- en stretching-sessies met een licht push-up-volume. Ideaal als deload tussen twee zware plannen of om weer in te stappen na een pauze.',
    },
    phrases: [
      ['saubere Liegestütze', 'schone push-ups'],
      ['Knie-Liegestütze als Aktivierung', 'knie-push-ups als activatie'],
      ['Knie-Liegestütze', 'knie-push-ups'],
      ['Hängendes Knieheben', 'hangend knieheffen'],
      ['invertierte Ruderzüge', 'omgekeerde rows'],
      ['Klimmzug-Negative', 'pull-up negatives'],
      ['Sumo-Kniebeugen', 'sumo squats'],
      ['Jump Squats', 'jump squats'],
      ['Aktive Erholung', 'Actief herstel'],
      ['Leichter Tag', 'Lichte dag'],
      ['Pull-Tag', 'Pull-dag'],
      ['Pull-Schwerpunkt', 'Pull-focus'],
      ['Brust- und Rücken-Mobility', 'mobiliteit borst en rug'],
      ['Brust-Stretching', 'borst-stretching'],
      ['Schulter-Mobility', 'schouder-mobiliteit'],
      ['Hip Opener', 'hip opener'],
      ['Dead Bugs', 'dead bugs'],
      ['Dead Bug', 'dead bug'],
      ['Russian Twists', 'russian twists'],
      ['Russian Twist', 'russian twist'],
      ['Side Plank', 'side plank'],
      ['Wall-Sit', 'wall sit'],
      ['Glute Bridges', 'glute bridges'],
      ['Hip Thrusts', 'hip thrusts'],
      ['Step-Ups', 'step-ups'],
      ['Hollow Hold', 'hollow hold'],
      ['Hollow-Hold-Zeit', 'hollow-hold tijd'],
      ['Plank-Halt', 'plank-hold'],
      ['Plank-Zeit', 'plank-tijd'],
      ['Mountain Climbers', 'mountain climbers'],
      ['Jumping Jacks', 'jumping jacks'],
      ['Hampelmänner', 'jumping jacks'],
      ['Burpees', 'burpees'],
      ['Squats', 'squats'],
      ['Kniebeugen', 'squats'],
      ['Ausfallschritte', 'lunges'],
      ['Liegestützen', 'push-ups'],
      ['Liegestütze', 'push-ups'],
      ['Klimmzügen', 'pull-ups'],
      ['Klimmzüge', 'pull-ups'],
      ['Klimmzug', 'pull-up'],
      ['Australian Rows', 'Australian rows'],
      ['Face Pulls', 'face pulls'],
      ['Rudern', 'rows'],
      ['Cat-Cow', 'cat-cow'],
      ['Foam Rolling', 'foam rolling'],
      ['Yoga-Flow', 'yoga-flow'],
      ['Dynamisches Aufwärmen', 'Dynamische warming-up'],
      ['lockeres Cardio', 'rustige cardio'],
      ['Spaziergang', 'wandeling'],
      ['Mobility-Session', 'mobiliteitssessie'],
      ['vollständige', 'volledige'],
      ['Stretching', 'stretching'],
      ['Mobility', 'mobiliteit'],
      ['Yoga', 'yoga'],
      ['Gehen', 'wandelen'],
      ['Ruhetag', 'Rustdag'],
      ['Form-Check', 'vorm-check'],
      ['Peak-Zirkel', 'Piek-circuit'],
      ['Taper-Zirkel', 'Taper-circuit'],
      ['Taper-Tag', 'Taper-dag'],
      ['Core-Power', 'Core-power'],
      ['Core-Zirkel', 'Core-circuit'],
      ['Baseline-Test', 'Baseline-test'],
      ['Konditionstest', 'Conditietest'],
      ['Funktionstest', 'Functionele test'],
      ['Endtest', 'Eindtest'],
      ['Baseline', 'Baseline'],
      ['Zirkel', 'Circuit'],
      ['HIIT-Finale', 'HIIT-finale'],
      ['HIIT-Ladder', 'HIIT-ladder'],
      ['Sätze', 'sets'],
      ['Satz', 'set'],
      ['Runden', 'rondes'],
      ['Runde', 'ronde'],
      ['Pause', 'rust'],
      ['Wiederholungen', 'herhalingen'],
      ['Wiederholung', 'herhaling'],
      ['weniger', 'minder'],
      ['Bestzeit notieren', 'noteer je beste tijd'],
      ['auf Zeit', 'op tijd'],
      ['in einem Satz', 'in één set'],
      ['je Bein', 'per been'],
      ['je Seite', 'per kant'],
      ['pro Minute', 'per minuut'],
      ['jede Runde', 'elke ronde'],
      ['saubere', 'schone'],
      ['kontrolliertes Tempo', 'gecontroleerd tempo'],
      ['schwer', 'zwaar'],
      ['oder Negative', 'of negatives'],
      ['Ziel', 'doel'],
      ['Exzentrik', 'excentriek'],
      ['nach Bedarf', 'naar behoefte'],
      ['abwechselnd', 'afwisselend'],
      ['maximale', 'maximale'],
      ['Plank', 'plank'],
      ['LS', 'push-ups'],
    ],
  },

  no: {
    titles: {
      'plan.push-pull-6w.title': 'Push &amp; Pull Balance — 6-ukers plan',
      'plan.full-body-6w.title': 'Full Body Strong — 6-ukers helkroppsplan',
      'plan.core-4w.title': 'Core Foundations — 4-ukers core-plan',
      'plan.hiit-4w.title': 'HIIT Burner — 4-ukers kondisjonsplan',
      'plan.mobility-2w.title': 'Mobility &amp; Recovery — 2-ukers deload',
    },
    summaries: {
      'plan.push-pull-6w.summary':
        'Symmetrisk 6-ukers plan for push-ups og trekkarbeid (roing, pull-up-negativer, face pulls). Unngår den klassiske &quot;bare push&quot;-ubalansen og styrker bakkjeden likt. Én dedikert pull-dag per uke i tillegg til push-progresjonen.',
      'plan.full-body-6w.summary':
        'Seks uker med helkropps-sirkler: push-ups, knebøy, utfall, glute bridges og planke i sirkler på 3, 4 og 5 runder. Tre treningsdager per uke, klart økende volum, funksjonell sluttest i uke 6.',
      'plan.core-4w.summary':
        'Fire uker med core-stabilitet: planke, hollow hold, dead bug, beinhev og rotasjonsarbeid. Hver treningsdag inkluderer også en moderat push-up-aktivering. Fire treningsdager pluss én lett dag per uke, sluttest med planke-hold og hollow hold.',
      'plan.hiit-4w.summary':
        'Fire uker med høyintensive intervaller med push-ups, burpees, mountain climbers, jumping jacks og knebøy. Tabata-, pyramide- og EMOM-strukturer. Fungerer godt som kondisjonsbooster mellom klassiske push-up-planer.',
      'plan.mobility-2w.summary':
        'To uker aktiv restitusjon: daglige mobilitets-, yoga- og stretching-økter med lett push-up-volum. Ideell som deload mellom to harde planer eller for å komme i gang igjen etter en pause.',
    },
    phrases: [
      ['saubere Liegestütze', 'rene push-ups'],
      ['Knie-Liegestütze als Aktivierung', 'kne-push-ups som aktivering'],
      ['Knie-Liegestütze', 'kne-push-ups'],
      ['Hängendes Knieheben', 'hengende kne-hev'],
      ['invertierte Ruderzüge', 'inverterte roinger'],
      ['Klimmzug-Negative', 'pull-up-negativer'],
      ['Sumo-Kniebeugen', 'sumo-knebøy'],
      ['Jump Squats', 'jump squats'],
      ['Aktive Erholung', 'Aktiv restitusjon'],
      ['Leichter Tag', 'Lett dag'],
      ['Pull-Tag', 'Pull-dag'],
      ['Pull-Schwerpunkt', 'Pull-fokus'],
      ['Brust- und Rücken-Mobility', 'mobilitet bryst og rygg'],
      ['Brust-Stretching', 'bryst-stretching'],
      ['Schulter-Mobility', 'skulder-mobilitet'],
      ['Hip Opener', 'hip opener'],
      ['Dead Bugs', 'dead bugs'],
      ['Dead Bug', 'dead bug'],
      ['Russian Twists', 'russian twists'],
      ['Russian Twist', 'russian twist'],
      ['Side Plank', 'sideplanke'],
      ['Wall-Sit', 'veggsitt'],
      ['Glute Bridges', 'glute bridges'],
      ['Hip Thrusts', 'hip thrusts'],
      ['Step-Ups', 'step-ups'],
      ['Hollow Hold', 'hollow hold'],
      ['Hollow-Hold-Zeit', 'hollow-hold-tid'],
      ['Plank-Halt', 'planke-hold'],
      ['Plank-Zeit', 'planke-tid'],
      ['Mountain Climbers', 'mountain climbers'],
      ['Jumping Jacks', 'jumping jacks'],
      ['Hampelmänner', 'jumping jacks'],
      ['Burpees', 'burpees'],
      ['Squats', 'knebøy'],
      ['Kniebeugen', 'knebøy'],
      ['Ausfallschritte', 'utfall'],
      ['Liegestützen', 'push-ups'],
      ['Liegestütze', 'push-ups'],
      ['Klimmzügen', 'pull-ups'],
      ['Klimmzüge', 'pull-ups'],
      ['Klimmzug', 'pull-up'],
      ['Australian Rows', 'Australian rows'],
      ['Face Pulls', 'face pulls'],
      ['Rudern', 'roing'],
      ['Cat-Cow', 'katt-ku'],
      ['Foam Rolling', 'foam rolling'],
      ['Yoga-Flow', 'yoga-flow'],
      ['Dynamisches Aufwärmen', 'Dynamisk oppvarming'],
      ['lockeres Cardio', 'rolig kondis'],
      ['Spaziergang', 'spasertur'],
      ['Mobility-Session', 'mobilitetsøkt'],
      ['vollständige', 'fullstendig'],
      ['Stretching', 'stretching'],
      ['Mobility', 'mobilitet'],
      ['Yoga', 'yoga'],
      ['Gehen', 'gange'],
      ['Ruhetag', 'Hviledag'],
      ['Form-Check', 'form-sjekk'],
      ['Peak-Zirkel', 'Topp-sirkel'],
      ['Taper-Zirkel', 'Taper-sirkel'],
      ['Taper-Tag', 'Taper-dag'],
      ['Core-Power', 'Core-power'],
      ['Core-Zirkel', 'Core-sirkel'],
      ['Baseline-Test', 'Baseline-test'],
      ['Konditionstest', 'Kondisjonstest'],
      ['Funktionstest', 'Funksjonstest'],
      ['Endtest', 'Sluttest'],
      ['Baseline', 'Baseline'],
      ['Zirkel', 'Sirkel'],
      ['HIIT-Finale', 'HIIT-finale'],
      ['HIIT-Ladder', 'HIIT-stige'],
      ['Sätze', 'sett'],
      ['Satz', 'sett'],
      ['Runden', 'runder'],
      ['Runde', 'runde'],
      ['Pause', 'pause'],
      ['Wiederholungen', 'repetisjoner'],
      ['Wiederholung', 'repetisjon'],
      ['weniger', 'færre'],
      ['Bestzeit notieren', 'noter beste tid'],
      ['auf Zeit', 'på tid'],
      ['in einem Satz', 'i ett sett'],
      ['je Bein', 'per bein'],
      ['je Seite', 'per side'],
      ['pro Minute', 'per minutt'],
      ['jede Runde', 'hver runde'],
      ['saubere', 'rene'],
      ['kontrolliertes Tempo', 'kontrollert tempo'],
      ['schwer', 'tungt'],
      ['oder Negative', 'eller negativer'],
      ['Ziel', 'mål'],
      ['Exzentrik', 'eksentrisk'],
      ['nach Bedarf', 'etter behov'],
      ['abwechselnd', 'vekselvis'],
      ['maximale', 'maks'],
      ['Plank', 'planke'],
      ['LS', 'push-ups'],
    ],
  },

  el: {
    titles: {
      'plan.push-pull-6w.title':
        'Push &amp; Pull Balance — 6-εβδομαδιαίο πρόγραμμα',
      'plan.full-body-6w.title':
        'Full Body Strong — 6-εβδομαδιαίο πρόγραμμα ολόκληρου σώματος',
      'plan.core-4w.title': 'Core Foundations — 4-εβδομαδιαίο πρόγραμμα κορμού',
      'plan.hiit-4w.title':
        'HIIT Burner — 4-εβδομαδιαίο πρόγραμμα φυσικής κατάστασης',
      'plan.mobility-2w.title':
        'Mobility &amp; Recovery — 2-εβδομαδιαία αποφόρτιση',
    },
    summaries: {
      'plan.push-pull-6w.summary':
        'Συμμετρικό 6-εβδομαδιαίο πρόγραμμα για κάμψεις και έλξεις (κωπηλατικές, αρνητικές έλξεις, face pulls). Αποφεύγει την κλασική ανισορροπία &quot;μόνο push&quot; και ενισχύει την οπίσθια αλυσίδα ισότιμα. Μία αφιερωμένη ημέρα έλξεων ανά εβδομάδα επιπλέον της προόδου push.',
      'plan.full-body-6w.summary':
        'Έξι εβδομάδες κύκλων ολόκληρου σώματος: κάμψεις, καθίσματα, προβολές, glute bridges και plank σε κύκλους 3, 4 και 5 γύρων. Τρεις ημέρες προπόνησης την εβδομάδα, σαφώς αυξανόμενος όγκος, λειτουργικό τελικό τεστ την εβδομάδα 6.',
      'plan.core-4w.summary':
        'Τέσσερις εβδομάδες σταθερότητας κορμού: plank, hollow hold, dead bug, ανυψώσεις ποδιών και περιστροφική εργασία. Κάθε ημέρα προπόνησης περιλαμβάνει επίσης μια μέτρια ενεργοποίηση με κάμψεις. Τέσσερις ημέρες προπόνησης συν μία ελαφριά ημέρα την εβδομάδα, τελικό τεστ με κράτημα plank και hollow hold.',
      'plan.hiit-4w.summary':
        'Τέσσερις εβδομάδες διαλειμματικής προπόνησης υψηλής έντασης με κάμψεις, burpees, mountain climbers, jumping jacks και καθίσματα. Δομές Tabata, πυραμίδας και EMOM. Λειτουργεί καλά ως ενισχυτής φυσικής κατάστασης μεταξύ κλασικών προγραμμάτων κάμψεων.',
      'plan.mobility-2w.summary':
        'Δύο εβδομάδες ενεργητικής αποκατάστασης: καθημερινές συνεδρίες κινητικότητας, γιόγκα και διατάσεων με ελαφρύ όγκο κάμψεων. Ιδανικό ως αποφόρτιση μεταξύ δύο απαιτητικών προγραμμάτων ή για επιστροφή μετά από διάλειμμα.',
    },
    phrases: [
      ['saubere Liegestütze', 'καθαρές κάμψεις'],
      ['Knie-Liegestütze als Aktivierung', 'κάμψεις γονάτων ως ενεργοποίηση'],
      ['Knie-Liegestütze', 'κάμψεις γονάτων'],
      ['Hängendes Knieheben', 'κρεμαστές ανυψώσεις γονάτων'],
      ['invertierte Ruderzüge', 'ανεστραμμένες κωπηλατικές'],
      ['Klimmzug-Negative', 'αρνητικές έλξεις'],
      ['Sumo-Kniebeugen', 'sumo καθίσματα'],
      ['Jump Squats', 'καθίσματα με άλμα'],
      ['Aktive Erholung', 'Ενεργή αποκατάσταση'],
      ['Leichter Tag', 'Ελαφριά ημέρα'],
      ['Pull-Tag', 'Ημέρα έλξεων'],
      ['Pull-Schwerpunkt', 'Έμφαση στις έλξεις'],
      ['Brust- und Rücken-Mobility', 'κινητικότητα στήθους και πλάτης'],
      ['Brust-Stretching', 'διατάσεις στήθους'],
      ['Schulter-Mobility', 'κινητικότητα ώμων'],
      ['Hip Opener', 'άνοιγμα ισχίου'],
      ['Dead Bugs', 'dead bugs'],
      ['Dead Bug', 'dead bug'],
      ['Russian Twists', 'ρωσικές περιστροφές'],
      ['Russian Twist', 'ρωσική περιστροφή'],
      ['Side Plank', 'πλευρικό plank'],
      ['Wall-Sit', 'κάθισμα τοίχου'],
      ['Glute Bridges', 'glute bridges'],
      ['Hip Thrusts', 'hip thrusts'],
      ['Step-Ups', 'step-ups'],
      ['Hollow Hold', 'hollow hold'],
      ['Hollow-Hold-Zeit', 'χρόνος hollow hold'],
      ['Plank-Halt', 'κράτημα plank'],
      ['Plank-Zeit', 'χρόνος plank'],
      ['Mountain Climbers', 'mountain climbers'],
      ['Jumping Jacks', 'jumping jacks'],
      ['Hampelmänner', 'jumping jacks'],
      ['Burpees', 'burpees'],
      ['Squats', 'καθίσματα'],
      ['Kniebeugen', 'καθίσματα'],
      ['Ausfallschritte', 'προβολές'],
      ['Liegestützen', 'κάμψεις'],
      ['Liegestütze', 'κάμψεις'],
      ['Klimmzügen', 'έλξεις'],
      ['Klimmzüge', 'έλξεις'],
      ['Klimmzug', 'έλξη'],
      ['Australian Rows', 'αυστραλιανές κωπηλατικές'],
      ['Face Pulls', 'face pulls'],
      ['Rudern', 'κωπηλατικές'],
      ['Cat-Cow', 'γάτα-αγελάδα'],
      ['Foam Rolling', 'foam rolling'],
      ['Yoga-Flow', 'γιόγκα flow'],
      ['Dynamisches Aufwärmen', 'Δυναμικό ζέσταμα'],
      ['lockeres Cardio', 'ήπιο cardio'],
      ['Spaziergang', 'περπάτημα'],
      ['Mobility-Session', 'συνεδρία κινητικότητας'],
      ['vollständige', 'πλήρης'],
      ['Stretching', 'διατάσεις'],
      ['Mobility', 'κινητικότητα'],
      ['Yoga', 'γιόγκα'],
      ['Gehen', 'περπάτημα'],
      ['Ruhetag', 'Ημέρα ανάπαυσης'],
      ['Form-Check', 'έλεγχος τεχνικής'],
      ['Peak-Zirkel', 'Κύκλος κορύφωσης'],
      ['Taper-Zirkel', 'Κύκλος αποφόρτισης'],
      ['Taper-Tag', 'Ημέρα αποφόρτισης'],
      ['Core-Power', 'Core ισχύς'],
      ['Core-Zirkel', 'Κύκλος κορμού'],
      ['Baseline-Test', 'Τεστ αναφοράς'],
      ['Konditionstest', 'Τεστ φυσικής κατάστασης'],
      ['Funktionstest', 'Λειτουργικό τεστ'],
      ['Endtest', 'Τελικό τεστ'],
      ['Baseline', 'Αναφορά'],
      ['Zirkel', 'Κύκλος'],
      ['HIIT-Finale', 'Τελικό HIIT'],
      ['HIIT-Ladder', 'Σκάλα HIIT'],
      ['Sätze', 'σετ'],
      ['Satz', 'σετ'],
      ['Runden', 'γύροι'],
      ['Runde', 'γύρος'],
      ['Pause', 'παύση'],
      ['Wiederholungen', 'επαναλήψεις'],
      ['Wiederholung', 'επανάληψη'],
      ['weniger', 'λιγότερες'],
      ['Bestzeit notieren', 'σημείωσε τον καλύτερο χρόνο'],
      ['auf Zeit', 'με χρόνο'],
      ['in einem Satz', 'σε ένα σετ'],
      ['je Bein', 'ανά πόδι'],
      ['je Seite', 'ανά πλευρά'],
      ['pro Minute', 'ανά λεπτό'],
      ['jede Runde', 'κάθε γύρος'],
      ['saubere', 'καθαρές'],
      ['kontrolliertes Tempo', 'ελεγχόμενο tempo'],
      ['schwer', 'βαρύ'],
      ['oder Negative', 'ή αρνητικές'],
      ['Ziel', 'στόχος'],
      ['Exzentrik', 'έκκεντρη'],
      ['nach Bedarf', 'κατά βούληση'],
      ['abwechselnd', 'εναλλάξ'],
      ['maximale', 'μέγιστες'],
      ['Plank', 'plank'],
      ['LS', 'κάμψεις'],
    ],
  },

  zh: {
    titles: {
      'plan.push-pull-6w.title': 'Push &amp; Pull Balance — 6周计划',
      'plan.full-body-6w.title': 'Full Body Strong — 6周全身计划',
      'plan.core-4w.title': 'Core Foundations — 4周核心计划',
      'plan.hiit-4w.title': 'HIIT Burner — 4周体能计划',
      'plan.mobility-2w.title': 'Mobility &amp; Recovery — 2周减载',
    },
    summaries: {
      'plan.push-pull-6w.summary':
        '6周对称推拉训练计划：俯卧撑配合拉力训练（划船、引体向上离心、面拉）。避免经典的"只推不拉"失衡，均衡强化后链。每周一天专门的拉日，作为推力进阶之外的补充。',
      'plan.full-body-6w.summary':
        '6周全身循环训练：俯卧撑、深蹲、弓步、臀桥和平板支撑，分别以3、4、5轮循环进行。每周3天训练，训练量逐步递增，第6周进行功能性终极测试。',
      'plan.core-4w.summary':
        '4周核心稳定性训练：平板支撑、空心支撑、死虫、抬腿和旋转训练。每个训练日还包括适度的俯卧撑激活。每周4天训练加1天轻量日，终极测试包括平板支撑和空心支撑保持时间。',
      'plan.hiit-4w.summary':
        '4周高强度间歇训练，包括俯卧撑、波比跳、登山者、开合跳和深蹲。采用Tabata、金字塔和EMOM结构。非常适合作为经典俯卧撑计划之间的体能增强模块。',
      'plan.mobility-2w.summary':
        '2周主动恢复：每日活动度、瑜伽和拉伸训练，配合轻量俯卧撑。理想用于两个高强度计划之间的减载，或训练间歇后的回归。',
    },
    phrases: [
      ['saubere Liegestütze', '标准俯卧撑'],
      ['Knie-Liegestütze als Aktivierung', '跪姿俯卧撑作为激活'],
      ['Knie-Liegestütze', '跪姿俯卧撑'],
      ['Hängendes Knieheben', '悬挂屈膝抬腿'],
      ['invertierte Ruderzüge', '反向划船'],
      ['Klimmzug-Negative', '引体向上离心'],
      ['Sumo-Kniebeugen', '相扑深蹲'],
      ['Jump Squats', '跳跃深蹲'],
      ['Aktive Erholung', '主动恢复'],
      ['Leichter Tag', '轻量日'],
      ['Pull-Tag', '拉日'],
      ['Pull-Schwerpunkt', '拉力侧重'],
      ['Brust- und Rücken-Mobility', '胸背活动度'],
      ['Brust-Stretching', '胸部拉伸'],
      ['Schulter-Mobility', '肩部活动度'],
      ['Hip Opener', '开髋'],
      ['Dead Bugs', '死虫'],
      ['Dead Bug', '死虫'],
      ['Russian Twists', '俄罗斯转体'],
      ['Russian Twist', '俄罗斯转体'],
      ['Side Plank', '侧平板支撑'],
      ['Wall-Sit', '靠墙静蹲'],
      ['Glute Bridges', '臀桥'],
      ['Hip Thrusts', '臀冲'],
      ['Step-Ups', '台阶上跨'],
      ['Hollow Hold', '空心支撑'],
      ['Hollow-Hold-Zeit', '空心支撑时间'],
      ['Plank-Halt', '平板支撑保持'],
      ['Plank-Zeit', '平板支撑时间'],
      ['Mountain Climbers', '登山者'],
      ['Jumping Jacks', '开合跳'],
      ['Hampelmänner', '开合跳'],
      ['Burpees', '波比跳'],
      ['Squats', '深蹲'],
      ['Kniebeugen', '深蹲'],
      ['Ausfallschritte', '弓步'],
      ['Liegestützen', '俯卧撑'],
      ['Liegestütze', '俯卧撑'],
      ['Klimmzügen', '引体向上'],
      ['Klimmzüge', '引体向上'],
      ['Klimmzug', '引体向上'],
      ['Australian Rows', '澳式划船'],
      ['Face Pulls', '面拉'],
      ['Rudern', '划船'],
      ['Cat-Cow', '猫牛式'],
      ['Foam Rolling', '泡沫轴放松'],
      ['Yoga-Flow', '瑜伽流动'],
      ['Dynamisches Aufwärmen', '动态热身'],
      ['lockeres Cardio', '轻量有氧'],
      ['Spaziergang', '散步'],
      ['Mobility-Session', '活动度训练'],
      ['vollständige', '完整的'],
      ['Stretching', '拉伸'],
      ['Mobility', '活动度'],
      ['Yoga', '瑜伽'],
      ['Gehen', '行走'],
      ['Ruhetag', '休息日'],
      ['Form-Check', '动作检查'],
      ['Peak-Zirkel', '峰值循环'],
      ['Taper-Zirkel', '减载循环'],
      ['Taper-Tag', '减载日'],
      ['Core-Power', '核心力量'],
      ['Core-Zirkel', '核心循环'],
      ['Baseline-Test', '基线测试'],
      ['Konditionstest', '体能测试'],
      ['Funktionstest', '功能性测试'],
      ['Endtest', '终极测试'],
      ['Baseline', '基线'],
      ['Zirkel', '循环'],
      ['HIIT-Finale', 'HIIT终极'],
      ['HIIT-Ladder', 'HIIT阶梯'],
      ['Sätze', '组'],
      ['Satz', '组'],
      ['Runden', '轮'],
      ['Runde', '轮'],
      ['Pause', '休息'],
      ['Wiederholungen', '次'],
      ['Wiederholung', '次'],
      ['weniger', '更少'],
      ['Bestzeit notieren', '记录最佳时间'],
      ['auf Zeit', '计时'],
      ['in einem Satz', '一组完成'],
      ['je Bein', '每条腿'],
      ['je Seite', '每侧'],
      ['pro Minute', '每分钟'],
      ['jede Runde', '每轮'],
      ['saubere', '标准的'],
      ['kontrolliertes Tempo', '控制节奏'],
      ['schwer', '重量'],
      ['oder Negative', '或离心'],
      ['Ziel', '目标'],
      ['Exzentrik', '离心'],
      ['nach Bedarf', '按需'],
      ['abwechselnd', '交替'],
      ['maximale', '最大'],
      ['Plank', '平板支撑'],
      ['LS', '俯卧撑'],
    ],
  },
};

// ── Translation logic ───────────────────────────────────────────────

function extractUnits(xml) {
  // Capture each unit AND its leading indent so we can rewrite at the
  // same column the surrounding XML uses (and so we can detect 8-space
  // mis-indents that earlier sync runs left behind).
  const map = new Map();
  const re = /(^|\n)(\s*)<unit id="([^"]+)">([\s\S]*?)<\/unit>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    map.set(m[3], { full: m[0], leading: m[1], indent: m[2] });
  }
  return map;
}

function translateDescription(source, phrases) {
  // Apply longest-first so multi-word phrases consume before their
  // sub-strings. Sorting on each call is cheap relative to the number
  // of units processed.
  const sorted = [...phrases].sort((a, b) => b[0].length - a[0].length);
  let out = source;
  for (const [de, target] of sorted) {
    out = out.split(de).join(target);
  }
  return out;
}

function translateForLocale(id, source, data) {
  if (data.titles[id]) return data.titles[id];
  if (data.summaries[id]) return data.summaries[id];
  return translateDescription(source, data.phrases);
}

function buildUnit(indent, id, source, target) {
  const inner = '  '; // child indent (relative to <unit>)
  return [
    `${indent}<unit id="${id}">`,
    `${indent}${inner}<segment state="translated">`,
    `${indent}${inner}${inner}<source>${source}</source>`,
    `${indent}${inner}${inner}<target>${target}</target>`,
    `${indent}${inner}</segment>`,
    `${indent}</unit>`,
  ].join('\n');
}

async function main() {
  const sourceXml = await fs.readFile(join(LOCALE_DIR, SOURCE_FILE), 'utf-8');
  const sourceUnits = extractUnits(sourceXml);
  const planSources = new Map();
  for (const [id, info] of sourceUnits) {
    if (!id.startsWith('plan.')) continue;
    if (
      !/^plan\.(push-pull-6w|full-body-6w|core-4w|hiit-4w|mobility-2w)\./.test(
        id
      )
    ) {
      continue;
    }
    const srcMatch = /<source>([\s\S]*?)<\/source>/.exec(info.full);
    if (srcMatch) planSources.set(id, srcMatch[1]);
  }

  for (const [locale, data] of Object.entries(LOCALES)) {
    const path = join(LOCALE_DIR, `messages.${locale}.xlf`);
    let xml = await fs.readFile(path, 'utf-8');
    const targetUnits = extractUnits(xml);
    let replaced = 0;
    let missing = 0;
    for (const [id, source] of planSources) {
      const existing = targetUnits.get(id);
      if (!existing) {
        missing++;
        continue;
      }
      // Canonical unit indent is 4 spaces (matches every other unit
      // in the XLIFF). Rewrite at 4 spaces regardless of what the
      // existing unit had, so any 8-space drift from earlier sync
      // runs is also normalised.
      const target = translateForLocale(id, source, data);
      const replacement = buildUnit('    ', id, source, target);
      // existing.full started with `\n` + the file's indent before
      // `<unit>`; re-prepend `existing.leading` so we preserve the
      // surrounding newline, then write our own 4-space indent.
      xml = xml.replace(existing.full, () => existing.leading + replacement);
      replaced++;
    }
    await fs.writeFile(path, xml);
    console.log(
      `${locale}: translated ${replaced} unit(s)` +
        (missing ? `, ${missing} missing` : '')
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
