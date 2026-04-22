export interface BlogPost {
  slug: string;
  lang: 'de' | 'en';
  title: string;
  description: string;
  publishedAt: string;
  content: string;
  keywords: string[];
  /** Slug of the same article in the other locale — enables hreflang pairing in the sitemap. */
  translationSlug?: string;
}

export function getBlogPostsByLocale(locale: string): BlogPost[] {
  const lang = locale.startsWith('en') ? 'en' : 'de';
  return BLOG_POSTS.filter((p) => p.lang === lang);
}

export function findBlogPost(
  slug: string,
  locale: string
): BlogPost | undefined {
  const lang = locale.startsWith('en') ? 'en' : 'de';
  return BLOG_POSTS.find((p) => p.slug === slug && p.lang === lang);
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'liegestuetze-steigern',
    lang: 'de',
    translationSlug: 'pushup-progression',
    title: 'Von 0 auf 100: Liegestütze systematisch steigern',
    description:
      'Praktische Anleitung zum systematischen Steigern deiner Liegestütze – mit Trainingsplan, Technik-Tipps und der richtigen Regeneration.',
    publishedAt: '2025-01-15',
    keywords: [
      'Liegestütze steigern',
      'mehr Liegestütze',
      'Trainingsplan Liegestütze',
      'Liegestütze Fortschritt',
      'Liegestütze lernen',
    ],
    content: `
<h2>Warum systematisches Training den Unterschied macht</h2>
<p>
  Viele starten mit dem besten Willen: täglich so viele Liegestütze wie möglich, bis die Arme versagen.
  Das Ergebnis? Nach wenigen Tagen Muskelkater, Stagnation und oft sogar Verletzungen. Der Schlüssel
  zum Erfolg liegt nicht in blindem Durchhalten, sondern in progressiver Belastungssteigerung –
  einem Prinzip, das Spitzensportler seit Jahrzehnten einsetzen.
</p>

<h2>Die Grundlage: Korrekte Technik zuerst</h2>
<p>
  Bevor du über Wiederholungszahlen nachdenkst, musst du die Bewegung beherrschen. Eine saubere
  Liegestütze bedeutet:
</p>
<ul>
  <li>Hände schulterbreit oder etwas breiter platzieren</li>
  <li>Körper bildet eine gerade Linie von Kopf bis Ferse</li>
  <li>Ellenbogen beim Absenken leicht zum Körper anwinkeln, nicht nach außen spreizen</li>
  <li>Brust berührt den Boden oder kommt ihm sehr nahe</li>
  <li>Bauch- und Gesäßmuskulatur während der gesamten Bewegung aktiv halten</li>
</ul>
<p>
  Wenn du noch keine saubere Liegestütze schaffst, beginne mit Knie-Liegestützen oder Liegestützen
  an einer erhöhten Fläche wie einer Fensterbank. Reduziere den Widerstand, bis die Form stimmt.
</p>

<h2>Der 6-Wochen-Aufbauplan</h2>
<p>
  Dieser Plan richtet sich an Einsteiger, die strukturiert von 0 auf 100 Liegestütze kommen möchten.
  Die Basis: drei Trainingstage pro Woche mit mindestens einem Ruhetag dazwischen.
</p>
<ol>
  <li><strong>Woche 1–2:</strong> 3 Sätze × so viele saubere Wiederholungen wie möglich (AMRAP), 90 Sekunden Pause zwischen Sätzen. Ziel: Grundlage aufbauen, Technik festigen.</li>
  <li><strong>Woche 3–4:</strong> 4 Sätze × AMRAP mit 60 Sekunden Pause. Zusätzlich einmal pro Woche einen längeren Satz ohne Pause bis zur maximalen Wiederholungszahl.</li>
  <li><strong>Woche 5–6:</strong> 5 Sätze mit Zielwiederholungen (z. B. 15-15-12-12-10), Pause nach Bedarf. Fokus auf gleichmäßiges Tempo und volle Bewegungsamplitude.</li>
</ol>

<h2>Regeneration ist kein Luxus</h2>
<p>
  Muskeln wachsen in der Ruhephase, nicht während des Trainings. Wer täglich ohne Pause trainiert,
  riskiert Überlastungssyndrome und blockiert den Fortschritt. Plane mindestens einen Tag Ruhe
  zwischen intensiven Einheiten ein. Schlaf, ausreichende Proteinzufuhr (1,5–2 g pro Kilogramm
  Körpergewicht) und Dehnung der Brust- und Schultermuskulatur nach dem Training beschleunigen
  die Erholung deutlich.
</p>

<h2>Plateaus überwinden</h2>
<p>
  Kommst du nicht mehr weiter, helfen Varianten wie Diamant-Liegestützen (Trizepsfokus), weite
  Liegestützen (Brustfokus) oder langsame exzentrische Phasen (3–5 Sekunden beim Absenken).
  Diese Variationen fordern die Muskulatur auf neue Weise und brechen Stagnation auf.
</p>

<h2>Fortschritt sichtbar machen</h2>
<p>
  Was gemessen wird, wird verbessert. Halte jede Einheit fest: Datum, Sätze, Wiederholungen.
  So erkennst du Trends, weißt wann du die Last steigern kannst und bleibst langfristig motiviert.
  Mit einem digitalen Tracker wie Pushup Tracker hast du alle Daten auf einen Blick – inklusive
  Streak, Wochenvolumen und Bestleistungen.
</p>
    `.trim(),
  },
  {
    slug: 'taeglich-liegestuetze',
    lang: 'de',
    translationSlug: 'daily-pushups',
    title: 'Warum tägliche Liegestütze dein Leben verändern',
    description:
      'Tägliche Liegestütze verbessern Kraft, Haltung und Wohlbefinden. Erfahre die wissenschaftlich belegten Vorteile und wie du die Gewohnheit dauerhaft aufbaust.',
    publishedAt: '2025-02-03',
    keywords: [
      'täglich Liegestütze',
      'Liegestütze jeden Tag',
      'Liegestütze Vorteile',
      'Liegestütze Gewohnheit',
      'Liegestütze Gesundheit',
    ],
    content: `
<h2>Mehr als nur ein Fitness-Trend</h2>
<p>
  Liegestützen gelten oft als langweilige Grundübung – dabei sind sie eines der vielseitigsten
  Ganzkörperübungen, die existieren. Wer sie täglich praktiziert, verändert nicht nur seine
  Körperzusammensetzung, sondern auch seine Haltung, sein Energielevel und sogar sein mentales
  Wohlbefinden. Das Beste: Kein Gerät, keine Mitgliedschaft, kein Aufwand nötig.
</p>

<h2>Was täglich passiert: Die Physiologie</h2>
<p>
  Schon nach wenigen Wochen regelmäßiger Liegestützen zeigen sich messbare Veränderungen:
</p>
<ul>
  <li><strong>Muskelaufbau:</strong> Brust, Schultern, Trizeps und Rumpfmuskulatur werden stärker und definierter.</li>
  <li><strong>Knochendichte:</strong> Belastungsübungen stimulieren den Knochen-Remodelling-Prozess und können Osteoporose vorbeugen.</li>
  <li><strong>Stoffwechsel:</strong> Mehr Muskelmasse bedeutet einen höheren Grundumsatz – auch im Ruhezustand.</li>
  <li><strong>Herzgesundheit:</strong> Studien zeigen, dass Männer, die mehr als 40 Liegestützen am Stück schaffen, ein signifikant geringeres kardiovaskuläres Risiko haben.</li>
</ul>

<h2>Haltung und Rückenschmerzen</h2>
<p>
  Büroarbeit und stundenlanges Sitzen schwächen die Rumpfmuskulatur und fördern eine vorgebeugte
  Haltung. Liegestützen trainieren gezielt die stabilisierende Muskulatur entlang der Wirbelsäule,
  stärken die Schulterblatt-Stabilisatoren und helfen, das muskuläre Ungleichgewicht zu korrigieren.
  Viele berichten nach 4–6 Wochen täglichem Training von deutlich weniger Nacken- und Rückenschmerzen.
</p>

<h2>Die Kraft der Gewohnheit</h2>
<p>
  Der größte Feind des Fortschritts ist Unregelmäßigkeit. Gewohnheitsforscher empfehlen, neue
  Routinen an bestehende zu koppeln: Liegestütze direkt nach dem Aufstehen, nach dem ersten Kaffee
  oder nach der Mittagspause. Starte mit einer realistischen Zahl – auch 10 Liegestützen täglich
  sind besser als 100 einmal pro Woche.
</p>
<p>
  Besonders effektiv ist das Führen einer Streak: Wenn du siehst, dass du 14 Tage in Folge trainiert
  hast, wächst die intrinsische Motivation, die Serie nicht zu unterbrechen. Genau dieses Prinzip
  nutzt Pushup Tracker, um dich täglich auf Kurs zu halten.
</p>

<h2>Mentale Vorteile werden unterschätzt</h2>
<p>
  Körperliche Aktivität setzt Endorphine frei und reduziert Cortisol – das Stresshormon. Schon
  eine kurze Trainingseinheit am Morgen kann die Stimmung für den gesamten Tag verbessern. Hinzu
  kommt das Gefühl der Selbstwirksamkeit: Wer jeden Tag seine Einheit absolviert, entwickelt
  Disziplin und Selbstvertrauen, die weit über das Training hinaus wirken.
</p>

<h2>Wie viele Liegestütze sind täglich sinnvoll?</h2>
<p>
  Für Einsteiger reichen 3 Sätze à 10–15 Wiederholungen täglich aus, um deutliche Fortschritte
  zu erzielen. Fortgeschrittene können auf 50–100+ Wiederholungen aufteilen, z. B. 5 Sätze × 20.
  Wichtiger als die Zahl ist die Kontinuität: Lieber moderat und täglich als intensiv und unregelmäßig.
</p>

<h2>Fazit</h2>
<p>
  Tägliche Liegestützen sind eine der effektivsten Investitionen, die du in deine Gesundheit machen
  kannst. Kein Equipment, keine Ausreden. Starte heute mit einer realistischen Zahl, verfolge
  deinen Fortschritt und erlebe, wie sich kleine tägliche Schritte zu einem echten Wandel summieren.
</p>
    `.trim(),
  },
  {
    slug: 'liegestuetze-tracker',
    lang: 'de',
    translationSlug: 'pushup-tracker-guide',
    title: 'Mit einem Tracker zur Liegestütz-Bestleistung',
    description:
      'Warum ein digitaler Liegestütze-Tracker den Unterschied macht – und wie Pushup Tracker dir hilft, Bestleistungen zu erzielen und dranzubleiben.',
    publishedAt: '2025-03-10',
    keywords: [
      'Liegestütze tracker app',
      'Liegestütze App',
      'Liegestütze tracken',
      'Pushup Tracker',
      'Liegestütze Fortschritt verfolgen',
    ],
    content: `
<h2>Das Problem mit dem Bauchgefühl</h2>
<p>
  Die meisten Menschen trainieren nach Gefühl. Sie wissen ungefähr, dass sie "letzte Woche mehr
  gemacht haben" oder "es sich heute schwerer anfühlt". Doch ohne konkrete Zahlen ist Fortschritt
  kaum zu erkennen – und oft wird er unterschätzt. Ein Trainingsjournal oder Tracker schafft Klarheit
  dort, wo Erinnerungen trügen.
</p>

<h2>Warum Daten deinen Fortschritt beschleunigen</h2>
<p>
  Wenn du jede Einheit aufzeichnest, passieren mehrere Dinge gleichzeitig:
</p>
<ul>
  <li><strong>Objektive Messung:</strong> Du siehst schwarz auf weiß, ob du wirklich Fortschritte machst oder seit Wochen stagnierst.</li>
  <li><strong>Höhere Accountability:</strong> Das Wissen, eine Einheit eintragen zu müssen, erhöht die Trainingshäufigkeit nachweislich.</li>
  <li><strong>Optimierung:</strong> Du erkennst, nach wie vielen Tagen Pause du besser performst, oder an welchen Wochentagen dein Energielevel am höchsten ist.</li>
  <li><strong>Langzeitmotivation:</strong> Zahlen erzählen eine Geschichte. Wer sieht, wie er von 20 auf 80 Liegestützen gewachsen ist, bleibt motiviert.</li>
</ul>

<h2>Was Pushup Tracker bietet</h2>
<p>
  Pushup Tracker ist ein kostenloser, browserbasierter Tracker, der speziell für die Liegestütz-Community
  entwickelt wurde. Statt aufgeblähter Feature-Listen konzentriert er sich auf das Wesentliche:
</p>
<ul>
  <li><strong>Schnelle Erfassung:</strong> Einen Eintrag in unter 2 Sekunden anlegen – mit Schnellaktionen für häufige Wiederholungszahlen.</li>
  <li><strong>Streak-Tracking:</strong> Sieh auf einen Blick, wie viele Tage du in Folge trainiert hast. Die Streak wird zum stärksten Motivator.</li>
  <li><strong>Charts & KPIs:</strong> Tagesvolumen, Wochentrends und Bestleistungen als übersichtliche Grafiken – ohne Datenwust.</li>
  <li><strong>Leaderboard:</strong> Misst du dich (optional und anonym) mit anderen Nutzern – täglich, wöchentlich oder monatlich.</li>
  <li><strong>KI-Erinnerungen:</strong> Lass dich stündlich mit einem personalisierten KI-Motivationsspruch als Browser-Benachrichtigung erinnern.</li>
  <li><strong>Gerätesync:</strong> Alle Daten in Echtzeit auf allen Geräten verfügbar – kein manuelles Synchronisieren nötig.</li>
</ul>

<h2>Für wen ist ein Liegestütze-Tracker sinnvoll?</h2>
<p>
  Kurz gesagt: für jeden, der ernsthaft Fortschritte machen will. Einsteiger profitieren von der
  Struktur und der visuellen Bestätigung ihrer ersten Erfolge. Fortgeschrittene nutzen die Daten
  zur Periodisierung und Plateauüberwindung. Selbst wer "nur" täglich 30 Liegestützen macht,
  gewinnt durch die Aufzeichnung ein neues Bewusstsein für seinen Körper und seine Leistungsfähigkeit.
</p>

<h2>Kostenlos starten – ohne Risiko</h2>
<p>
  Pushup Tracker ist und bleibt kostenlos. Kein Abo, keine Kreditkarte, kein Haken. Du kannst
  dich in Sekunden registrieren und sofort mit dem Tracken beginnen. Deine Daten gehören dir –
  gespeichert in der Cloud, aber jederzeit exportierbar.
</p>
<p>
  Starte noch heute und erlebe, wie viel einfacher es ist, dranzubleiben, wenn Fortschritt
  sichtbar wird.
</p>
    `.trim(),
  },

  {
    slug: 'liegestuetze-varianten',
    lang: 'de',
    translationSlug: 'pushup-variations',
    title: '10 Liegestütz-Varianten für jeden Trainingsstand',
    description:
      'Von der Knie-Liegestütze bis zur Archer Push-Up: Diese 10 Variationen trainieren gezielt Brust, Trizeps und Schultern – und brechen jedes Plateau.',
    publishedAt: '2025-09-22',
    keywords: [
      'Liegestütze Varianten',
      'Liegestütze Übungen',
      'Liegestütze schwieriger machen',
      'Liegestütze Muskeln',
      'Liegestütze fortgeschritten',
    ],
    content: `
<h2>Warum Variationen entscheidend sind</h2>
<p>
  Wer immer dieselbe Standard-Liegestütze macht, gewöhnt sich schnell an den Reiz – der Muskel
  hört auf zu wachsen. Variationen verändern den Belastungswinkel, betonen unterschiedliche
  Muskelgruppen und frischen den Trainingsreiz regelmäßig auf. Hier sind 10 Varianten, die für
  jeden Trainingsstand geeignet sind.
</p>

<h2>Für Einsteiger</h2>
<ul>
  <li>
    <strong>Knie-Liegestütze:</strong> Knie auf dem Boden, Körper von Knie bis Schulter gerade.
    Perfekt zum Einstieg – reduziert das zu bewegende Körpergewicht um etwa 50 %.
  </li>
  <li>
    <strong>Wandliegestütze:</strong> Hände gegen eine Wand stützen, Körper in 45°-Winkel.
    Ideal zur Technikschulung ohne Bodenkontakt.
  </li>
  <li>
    <strong>Erhöhte Liegestütze:</strong> Hände auf einer Bank oder Treppenstufe. Je höher die
    Fläche, desto einfacher die Übung – stufenweise zum Boden absenken.
  </li>
</ul>

<h2>Für Fortgeschrittene</h2>
<ul>
  <li>
    <strong>Diamant-Liegestütze:</strong> Daumen und Zeigefinger berühren sich unter der Brust zu
    einem Dreieck. Maximaler Trizepsfokus.
  </li>
  <li>
    <strong>Weite Liegestütze:</strong> Hände deutlich breiter als schulterbreit. Betont den
    äußeren Brustmuskel und die Schultern.
  </li>
  <li>
    <strong>Decline-Liegestütze:</strong> Füße auf einer erhöhten Fläche, Kopf zeigt nach unten.
    Verlagert den Fokus auf den oberen Brustmuskel und Schultern.
  </li>
  <li>
    <strong>Archer Push-Up:</strong> Einen Arm strecken, das gesamte Körpergewicht auf den anderen
    Arm verlagern. Vorstufe zur einarmigen Liegestütze.
  </li>
</ul>

<h2>Für Experten</h2>
<ul>
  <li>
    <strong>Einarmige Liegestütze:</strong> Die Königsdisziplin. Erfordert außergewöhnliche Rumpfstabilität
    und Kraft. Füße dabei weit auseinander stellen, um die Balance zu vereinfachen.
  </li>
  <li>
    <strong>Clap Push-Up:</strong> Explosive Aufwärtsbewegung, sodass die Hände kurz den Boden verlassen.
    Trainiert explosive Kraft und Schnellkraft.
  </li>
  <li>
    <strong>Pike Push-Up:</strong> Gesäß hoch, Körper bildet ein umgekehrtes V. Primärer Fokus auf
    Schultern – Vorstufe zum Handstand-Liegestütz.
  </li>
</ul>

<h2>Wie du Varianten in dein Training integrierst</h2>
<p>
  Tausche nicht alle Übungen auf einmal aus. Ersetze stattdessen eine Variante pro Woche oder
  füge eine neue als Abschlussübung hinzu. Verfolge jede Variation separat im Tracker – so
  siehst du genau, wie sich deine Stärke in den einzelnen Bewegungsmustern entwickelt.
</p>

<h2>Welche Muskeln profitieren am meisten?</h2>
<p>
  Standard-Liegestützen trainieren vorwiegend großen Brustmuskel (Pectoralis major), vorderen
  Anteil des Deltamuskels und Trizeps. Durch Variation verschiebst du die Lastverteilung:
  Diamant-Varianten maximieren den Trizeps, Decline-Varianten die Oberbrust, Pike Push-Ups
  die Schultermuskulatur. Ein ausgewogenes Programm aus verschiedenen Varianten führt zu
  ausgeglichener Muskelentwicklung – ohne ein einziges Gerät.
</p>
    `.trim(),
  },
  {
    slug: '30-tage-liegestuetze-challenge',
    lang: 'de',
    translationSlug: '30-day-pushup-challenge',
    title: '30-Tage-Liegestütz-Challenge: Dein Plan für maximalen Fortschritt',
    description:
      'Mit dieser strukturierten 30-Tage-Challenge steigerst du deine Liegestütz-Zahl Schritt für Schritt – von Woche 1 bis zum Endtest am Tag 30.',
    publishedAt: '2025-11-04',
    keywords: [
      '30 Tage Liegestütze Challenge',
      'Liegestütze Challenge Plan',
      'Liegestütze in 30 Tagen',
      'Push-Up Challenge',
      'Liegestütze täglich steigern',
    ],
    content: `
<h2>Was die 30-Tage-Challenge bewirkt</h2>
<p>
  Dreißig Tage konsequentes Training verändern messbar deine Kraft, Ausdauer und Körperwahrnehmung.
  Klinische Studien zeigen, dass bereits vier Wochen progressives Krafttraining die Muskelquerschnittsfläche
  signifikant vergrößern kann. Dieses Programm kombiniert tägliches Training mit strategischen Ruhetagen
  und wöchentlichem Fortschrittstest.
</p>

<h2>Voraussetzungen & Starttest</h2>
<p>
  Mach vor Tag 1 einen Maximaltest: So viele saubere Liegestützen wie möglich ohne Pause.
  Trage die Zahl in deinen Tracker ein – das ist dein Ausgangswert, gegen den du am Tag 30 antrittstest.
</p>
<ul>
  <li><strong>Einsteiger (&lt; 10 Wdh.):</strong> Starte mit Knie-Liegestützen oder erhöhter Variante.</li>
  <li><strong>Mittelstufe (10–30 Wdh.):</strong> Vollständige Liegestützen, ggf. mit Variationen.</li>
  <li><strong>Fortgeschrittene (&gt; 30 Wdh.):</strong> Schwere Varianten (Archer, Decline, langsames Tempo).</li>
</ul>

<h2>Der Wochenplan</h2>
<ol>
  <li>
    <strong>Woche 1 – Grundlage (Tag 1–7):</strong>
    Montag, Mittwoch, Freitag: 3 × AMRAP mit 90 s Pause. Dienstag, Donnerstag: Leichter Tag –
    2 × 50 % deines Maximums. Samstag: Maximaltest (nicht zählen, nur trainieren). Sonntag: Ruhe.
  </li>
  <li>
    <strong>Woche 2 – Volumen (Tag 8–14):</strong>
    Haupttage: 4 × AMRAP mit 60 s Pause. Leichttage: 3 × 60 % deines Maximums.
  </li>
  <li>
    <strong>Woche 3 – Intensität (Tag 15–21):</strong>
    Haupttage: 5 × Zielwiederholungen (z. B. 80 % deines Maximums pro Satz). Leichttage entfallen –
    stattdessen Mobility und Dehnung der Brustmuskulatur.
  </li>
  <li>
    <strong>Woche 4 – Tapering & Peak (Tag 22–29):</strong>
    Volumen reduzieren auf 3 × 70 % – Qualität vor Quantität. Letzten zwei Tage: aktive Erholung.
  </li>
  <li>
    <strong>Tag 30 – Endtest:</strong>
    Maximale Liegestützen ohne Pause. Vergleiche mit deinem Startwert und trage das Ergebnis im
    Tracker ein. Die Differenz ist dein 30-Tage-Erfolg.
  </li>
</ol>

<h2>Ernährung & Regeneration während der Challenge</h2>
<p>
  Achte auf ausreichend Protein (mindestens 1,5 g pro kg Körpergewicht täglich) und schlafe
  7–9 Stunden. Magnesium vor dem Schlafen kann Muskelkrämpfe reduzieren. Nach jeder Haupteinheit:
  2 Minuten Stretching für Brust, Schultern und Trizeps.
</p>

<h2>Fortschritt täglich tracken</h2>
<p>
  Der psychologische Effekt eines Streaks ist enorm: Wenn Tag 17 in grüner Farbe auf dem Display
  leuchtet, ist die Wahrscheinlichkeit gering, dass du Tag 18 abbrichst. Nutze Pushup Tracker,
  um jeden Trainingstag einzutragen – inklusive Variante, Sätze und Gesamtwiederholungen. Die
  Challenge-Grafik zeigt dir täglich, ob du auf Kurs bist.
</p>
    `.trim(),
  },
  {
    slug: 'liegestuetze-ab-40',
    lang: 'de',
    translationSlug: 'pushups-over-40',
    title: 'Liegestützen ab 40: Wie du sicher und effektiv trainierst',
    description:
      'Ab 40 verändert sich der Körper – aber Liegestützen bleiben eine der besten Übungen. Erfahre, wie du mit der richtigen Anpassung sicher Kraft aufbaust.',
    publishedAt: '2026-01-20',
    keywords: [
      'Liegestütze ab 40',
      'Kraft Training über 40',
      'Liegestütze Rücken schonen',
      'Fitness über 40',
      'Liegestütze Gelenke schonen',
    ],
    content: `
<h2>Was sich ab 40 verändert</h2>
<p>
  Ab dem vierten Lebensjahrzehnt sinkt die Muskelmasse ohne Training um durchschnittlich 1–2 % pro
  Jahr (Sarkopenie). Gleichzeitig nimmt die Regenerationsfähigkeit ab, Gelenke reagieren empfindlicher,
  und der Hormonspiegel verändert sich. Das klingt nach schlechten Nachrichten – ist es aber nicht.
  Krafttraining, insbesondere mit dem eigenen Körpergewicht, ist eine der wirksamsten Maßnahmen,
  um diesen Prozess zu verlangsamen und umzukehren.
</p>

<h2>Die gesundheitlichen Vorteile sind größer als mit 20</h2>
<p>
  Studien zeigen: Wer mit 40+ regelmäßig Krafttraining betreibt, profitiert überproportional stark
  im Vergleich zu jüngeren Sportlern. Die Gründe:
</p>
<ul>
  <li><strong>Knochendichte:</strong> Belastungsübungen bremsen Osteoporose aktiv.</li>
  <li><strong>Herzgesundheit:</strong> Widerstandstraining senkt Blutdruck und LDL-Cholesterin.</li>
  <li><strong>Metabolismus:</strong> Jedes Kilogramm erhaltener Muskelmasse erhöht den Grundumsatz.</li>
  <li><strong>Sturz- und Verletzungsprävention:</strong> Stärkere Rumpf- und Schultermuskulatur schützt Gelenke und verbessert die Balance.</li>
</ul>

<h2>Anpassungen für den Körper ab 40</h2>
<p>
  Du musst dein Training nicht revolutionieren – aber du solltest es klug anpassen:
</p>
<ul>
  <li>
    <strong>Aufwärmen ist Pflicht:</strong> 5–10 Minuten lockere Bewegung (Schulterkreisen, Arm-Swings,
    Cat-Cow) bereiten Gelenke und Bindegewebe vor. Kalt trainieren erhöht das Verletzungsrisiko deutlich.
  </li>
  <li>
    <strong>Weniger Volumen, mehr Qualität:</strong> Statt 6 Sätzen bis zum Versagen reichen 3–4 Sätze
    mit sauberer Technik und einer Wiederholung "in Reserve". Das schont das Nervensystem.
  </li>
  <li>
    <strong>Längere Pausen:</strong> 2 Minuten zwischen den Sätzen statt 60 Sekunden – die Regeneration
    zwischen Sätzen wird ab 40 wichtiger.
  </li>
  <li>
    <strong>Häufigkeit statt Intensität:</strong> 4 moderate Einheiten pro Woche sind besser als
    2 extreme. Der Körper adaptiert besser an regelmäßige moderate Reize.
  </li>
  <li>
    <strong>Handgelenke entlasten:</strong> Bei Schmerzen im Handgelenk helfen Fäuste-Liegestützen
    (neutrale Handgelenksstellung) oder Push-Up-Griffe.
  </li>
</ul>

<h2>Ein realistischer Einstiegsplan</h2>
<p>
  Wenn du länger pausiert hast, starte nicht da, wo du aufgehört hast. Woche 1–2: 3 × 8–12 saubere
  Liegestützen (Knie-Variante wenn nötig), mit vollem Fokus auf Technik. Steigere wöchentlich um
  maximal 10 % des Gesamtvolumens. Geduld ist keine Schwäche – sie ist die Strategie.
</p>

<h2>Schmerzen ernst nehmen</h2>
<p>
  Muskelkater ist normal. Gelenkschmerzen sind es nicht. Schmerzen in Schulter, Ellenbogen oder
  Handgelenk sind ein klares Stoppsignal. Konsultiere in diesem Fall einen Physiotherapeuten,
  bevor du weiter trainierst. Trainingspausen wegen Verletzungen kosten mehr Zeit als präventive
  Ruhephasen.
</p>

<h2>Fortschritt sichtbar halten</h2>
<p>
  Gerade ab 40 ist es wichtig, Fortschritte objektiv zu dokumentieren – weil das subjektive Gefühl
  oft trügt. Mit Pushup Tracker siehst du auf einen Blick, ob du diese Woche mehr geschafft hast
  als letzte Woche. Das ist der Anker, der dich auch an schwierigen Tagen motiviert.
</p>
    `.trim(),
  },

  // ── English blog posts ────────────────────────────────────────────────────
  {
    slug: 'pushup-progression',
    lang: 'en',
    translationSlug: 'liegestuetze-steigern',
    title: 'From 0 to 100: How to Systematically Increase Your Push-Ups',
    description:
      'A practical guide to progressively increasing your push-ups – with a training plan, technique tips, and proper recovery.',
    publishedAt: '2025-01-15',
    keywords: [
      'increase push-ups',
      'more push-ups',
      'push-up training plan',
      'push-up progress',
      'learn push-ups',
    ],
    content: `
<h2>Why Systematic Training Makes the Difference</h2>
<p>
  Many people start with the best intentions: as many push-ups as possible every day until their arms
  give out. The result? After a few days, soreness, stagnation, and often even injuries. The key to
  success isn't blind persistence – it's progressive overload, a principle that elite athletes have
  been using for decades.
</p>

<h2>The Foundation: Correct Technique First</h2>
<p>
  Before thinking about rep counts, you need to master the movement. A proper push-up means:
</p>
<ul>
  <li>Hands placed shoulder-width apart or slightly wider</li>
  <li>Body forms a straight line from head to heels</li>
  <li>Elbows angled slightly toward the body when lowering, not flaring out</li>
  <li>Chest touches or nearly touches the ground</li>
  <li>Core and glutes engaged throughout the entire movement</li>
</ul>
<p>
  If you can't do a proper push-up yet, start with knee push-ups or push-ups on an elevated surface
  like a windowsill. Reduce the resistance until your form is solid.
</p>

<h2>The 6-Week Build-Up Plan</h2>
<p>
  This plan is designed for beginners who want to systematically work their way to 100 push-ups.
  The basics: three training days per week with at least one rest day in between.
</p>
<ol>
  <li><strong>Weeks 1–2:</strong> 3 sets × as many clean reps as possible (AMRAP), 90-second rest between sets. Goal: build a foundation, solidify technique.</li>
  <li><strong>Weeks 3–4:</strong> 4 sets × AMRAP with 60-second rest. Plus one max-rep set per week without pause.</li>
  <li><strong>Weeks 5–6:</strong> 5 sets with target reps (e.g. 15-15-12-12-10), rest as needed. Focus on steady tempo and full range of motion.</li>
</ol>

<h2>Recovery Is Not a Luxury</h2>
<p>
  Muscles grow during rest, not during training. Training hard every day without breaks risks
  overuse injuries and stalls progress. Plan at least one rest day between intense sessions.
  Sleep, adequate protein intake (1.5–2 g per kilogram of body weight), and stretching your chest
  and shoulder muscles after training significantly speed up recovery.
</p>

<h2>Breaking Through Plateaus</h2>
<p>
  If you're stuck, variations like diamond push-ups (tricep focus), wide push-ups (chest focus),
  or slow eccentric phases (3–5 seconds lowering) can help. These variations challenge your muscles
  in new ways and break through stagnation.
</p>

<h2>Making Progress Visible</h2>
<p>
  What gets measured gets improved. Record every session: date, sets, reps. This way you can spot
  trends, know when to increase the load, and stay motivated long-term. With a digital tracker
  like Pushup Tracker, you have all your data at a glance – including streaks, weekly volume,
  and personal bests.
</p>
    `.trim(),
  },
  {
    slug: 'daily-pushups',
    lang: 'en',
    translationSlug: 'taeglich-liegestuetze',
    title: 'Why Daily Push-Ups Will Change Your Life',
    description:
      'Daily push-ups improve strength, posture, and well-being. Discover the scientifically proven benefits and how to build the habit for good.',
    publishedAt: '2025-02-03',
    keywords: [
      'daily push-ups',
      'push-ups every day',
      'push-up benefits',
      'push-up habit',
      'push-up health',
    ],
    content: `
<h2>More Than Just a Fitness Trend</h2>
<p>
  Push-ups are often dismissed as a boring basic exercise – yet they're one of the most versatile
  full-body exercises that exist. Practicing them daily changes not only your body composition
  but also your posture, energy levels, and even your mental well-being. The best part: no equipment,
  no membership, no hassle.
</p>

<h2>What Happens Daily: The Physiology</h2>
<p>
  After just a few weeks of regular push-ups, measurable changes appear:
</p>
<ul>
  <li><strong>Muscle growth:</strong> Chest, shoulders, triceps, and core muscles become stronger and more defined.</li>
  <li><strong>Bone density:</strong> Resistance exercises stimulate the bone remodeling process and can help prevent osteoporosis.</li>
  <li><strong>Metabolism:</strong> More muscle mass means a higher basal metabolic rate – even at rest.</li>
  <li><strong>Heart health:</strong> Studies show that men who can do more than 40 push-ups in a row have a significantly lower cardiovascular risk.</li>
</ul>

<h2>Posture and Back Pain</h2>
<p>
  Desk work and hours of sitting weaken the core muscles and promote a hunched posture. Push-ups
  specifically train the stabilizing muscles along the spine, strengthen the scapular stabilizers,
  and help correct muscular imbalances. Many people report significantly less neck and back pain
  after 4–6 weeks of daily training.
</p>

<h2>The Power of Habit</h2>
<p>
  The greatest enemy of progress is inconsistency. Habit researchers recommend attaching new routines
  to existing ones: push-ups right after getting up, after your first coffee, or after your lunch
  break. Start with a realistic number – even 10 push-ups daily is better than 100 once a week.
</p>
<p>
  Especially effective is tracking a streak: when you see that you've trained 14 days in a row,
  your intrinsic motivation to keep the streak alive grows. This is exactly the principle Pushup
  Tracker uses to keep you on track every day.
</p>

<h2>Mental Benefits Are Underestimated</h2>
<p>
  Physical activity releases endorphins and reduces cortisol – the stress hormone. Even a short
  morning workout can improve your mood for the entire day. On top of that comes the feeling of
  self-efficacy: those who complete their session every day develop discipline and confidence
  that extend far beyond training.
</p>

<h2>How Many Push-Ups per Day Make Sense?</h2>
<p>
  For beginners, 3 sets of 10–15 reps daily are enough to see clear progress. Advanced athletes
  can distribute 50–100+ reps, e.g. 5 sets × 20. More important than the number is consistency:
  better moderate and daily than intense and irregular.
</p>

<h2>Conclusion</h2>
<p>
  Daily push-ups are one of the most effective investments you can make in your health. No equipment,
  no excuses. Start today with a realistic number, track your progress, and experience how small
  daily steps add up to real change.
</p>
    `.trim(),
  },
  {
    slug: 'pushup-variations',
    lang: 'en',
    translationSlug: 'liegestuetze-varianten',
    title: '10 Push-Up Variations for Every Fitness Level',
    description:
      'From knee push-ups to archer push-ups: these 10 variations target chest, triceps, and shoulders – and break through any plateau.',
    publishedAt: '2025-09-22',
    keywords: [
      'push-up variations',
      'push-up exercises',
      'harder push-ups',
      'push-up muscles',
      'advanced push-ups',
    ],
    content: `
<h2>Why Variations Are Essential</h2>
<p>
  Doing the same standard push-up over and over means your body adapts quickly and stops growing.
  Variations change the loading angle, emphasize different muscle groups, and keep the training
  stimulus fresh. Here are 10 variations suited for every fitness level.
</p>

<h2>For Beginners</h2>
<ul>
  <li>
    <strong>Knee Push-Up:</strong> Knees on the floor, body straight from knees to shoulders.
    Perfect for getting started – reduces the weight you need to move by about 50%.
  </li>
  <li>
    <strong>Wall Push-Up:</strong> Hands against a wall, body at a 45° angle.
    Ideal for learning proper technique without floor contact.
  </li>
  <li>
    <strong>Elevated Push-Up:</strong> Hands on a bench or step. The higher the surface, the easier
    the movement – gradually work your way down to the floor.
  </li>
</ul>

<h2>For Intermediate Athletes</h2>
<ul>
  <li>
    <strong>Diamond Push-Up:</strong> Thumbs and index fingers touch under the chest to form a triangle.
    Maximum tricep focus.
  </li>
  <li>
    <strong>Wide Push-Up:</strong> Hands significantly wider than shoulder-width. Emphasizes the
    outer chest and shoulders.
  </li>
  <li>
    <strong>Decline Push-Up:</strong> Feet on an elevated surface, head pointing down. Shifts
    focus to the upper chest and shoulders.
  </li>
  <li>
    <strong>Archer Push-Up:</strong> Extend one arm to the side while shifting all the weight onto
    the other arm. The stepping stone to a one-arm push-up.
  </li>
</ul>

<h2>For Advanced Athletes</h2>
<ul>
  <li>
    <strong>One-Arm Push-Up:</strong> The king of push-up variations. Requires exceptional core
    stability and strength. Keep feet wide apart for easier balance.
  </li>
  <li>
    <strong>Clap Push-Up:</strong> Explosive upward drive so hands briefly leave the floor.
    Trains explosive and reactive strength.
  </li>
  <li>
    <strong>Pike Push-Up:</strong> Hips raised high, body forming an inverted V. Primary focus
    on shoulders – a stepping stone toward handstand push-ups.
  </li>
</ul>

<h2>How to Integrate Variations into Your Training</h2>
<p>
  Don't swap all exercises at once. Instead, replace one variation per week or add a new one as
  a finisher. Track each variation separately in your tracker – this shows exactly how your
  strength develops across different movement patterns.
</p>

<h2>Which Muscles Benefit the Most?</h2>
<p>
  Standard push-ups primarily train the pectoralis major, the anterior deltoid, and the triceps.
  Variations shift the load distribution: diamond variations maximize the triceps, decline
  variations target the upper chest, and pike push-ups focus on the shoulder muscles.
  A balanced program of different variations leads to well-rounded muscle development –
  without a single piece of equipment.
</p>
    `.trim(),
  },
  {
    slug: '30-day-pushup-challenge',
    lang: 'en',
    translationSlug: '30-tage-liegestuetze-challenge',
    title: '30-Day Push-Up Challenge: Your Plan for Maximum Progress',
    description:
      'This structured 30-day challenge helps you increase your push-up count step by step – from week 1 to the final test on day 30.',
    publishedAt: '2025-11-04',
    keywords: [
      '30 day push-up challenge',
      'push-up challenge plan',
      'push-ups in 30 days',
      'push-up challenge',
      'increase push-ups daily',
    ],
    content: `
<h2>What the 30-Day Challenge Achieves</h2>
<p>
  Thirty days of consistent training measurably changes your strength, endurance, and body
  awareness. Clinical studies show that even four weeks of progressive strength training can
  significantly increase muscle cross-sectional area. This program combines daily training
  with strategic rest days and a weekly progress test.
</p>

<h2>Prerequisites & Starting Test</h2>
<p>
  Before Day 1, take a max test: as many clean push-ups as possible without stopping.
  Log the number in your tracker – that's your baseline to compare against on Day 30.
</p>
<ul>
  <li><strong>Beginner (&lt; 10 reps):</strong> Start with knee push-ups or an elevated variation.</li>
  <li><strong>Intermediate (10–30 reps):</strong> Full push-ups, optionally with variations.</li>
  <li><strong>Advanced (&gt; 30 reps):</strong> Harder variations (archer, decline, slow tempo).</li>
</ul>

<h2>The Weekly Plan</h2>
<ol>
  <li>
    <strong>Week 1 – Foundation (Days 1–7):</strong>
    Mon, Wed, Fri: 3 × AMRAP with 90 s rest. Tue, Thu: Light day – 2 × 50% of your max.
    Sat: Max test set (don't count toward total, just train). Sun: Rest.
  </li>
  <li>
    <strong>Week 2 – Volume (Days 8–14):</strong>
    Main days: 4 × AMRAP with 60 s rest. Light days: 3 × 60% of your max.
  </li>
  <li>
    <strong>Week 3 – Intensity (Days 15–21):</strong>
    Main days: 5 × target reps (e.g. 80% of your max per set). Light days replaced with
    mobility work and chest stretching.
  </li>
  <li>
    <strong>Week 4 – Taper & Peak (Days 22–29):</strong>
    Reduce volume to 3 × 70% – quality over quantity. Last two days: active recovery only.
  </li>
  <li>
    <strong>Day 30 – Final Test:</strong>
    Maximum push-ups without stopping. Compare to your starting number and log the result
    in your tracker. The difference is your 30-day achievement.
  </li>
</ol>

<h2>Nutrition & Recovery During the Challenge</h2>
<p>
  Aim for adequate protein (at least 1.5 g per kg of body weight daily) and 7–9 hours of sleep.
  Magnesium before bed can reduce muscle cramps. After each main session: 2 minutes of stretching
  for chest, shoulders, and triceps.
</p>

<h2>Track Progress Every Day</h2>
<p>
  The psychological effect of a streak is enormous: when Day 17 shows up in green on your screen,
  the chance you'll skip Day 18 drops dramatically. Use Pushup Tracker to log every training day
  – including variation, sets, and total reps. The challenge graph shows you daily whether you're
  on track.
</p>
    `.trim(),
  },
  {
    slug: 'pushups-over-40',
    lang: 'en',
    translationSlug: 'liegestuetze-ab-40',
    title: 'Push-Ups After 40: How to Train Safely and Effectively',
    description:
      'Your body changes after 40 – but push-ups remain one of the best exercises. Learn how to build strength safely with the right adjustments.',
    publishedAt: '2026-01-20',
    keywords: [
      'push-ups over 40',
      'strength training over 40',
      'push-ups joint friendly',
      'fitness over 40',
      'push-ups for older adults',
    ],
    content: `
<h2>What Changes After 40</h2>
<p>
  From the fourth decade of life onward, muscle mass decreases by an average of 1–2% per year
  without exercise (sarcopenia). Recovery capacity also declines, joints become more sensitive,
  and hormone levels shift. That sounds like bad news – but it isn't. Strength training,
  especially with bodyweight, is one of the most effective tools to slow and reverse this process.
</p>

<h2>The Health Benefits Are Greater Than at 20</h2>
<p>
  Studies show that people who train regularly after 40 benefit disproportionately compared to
  younger athletes. The reasons:
</p>
<ul>
  <li><strong>Bone density:</strong> Resistance exercises actively slow osteoporosis.</li>
  <li><strong>Heart health:</strong> Resistance training lowers blood pressure and LDL cholesterol.</li>
  <li><strong>Metabolism:</strong> Every kilogram of maintained muscle mass increases your basal metabolic rate.</li>
  <li><strong>Injury and fall prevention:</strong> A stronger core and shoulder muscles protect joints and improve balance.</li>
</ul>

<h2>Smart Adjustments for the Body After 40</h2>
<p>
  You don't need to revolutionize your training – but you should adapt it intelligently:
</p>
<ul>
  <li>
    <strong>Warming up is mandatory:</strong> 5–10 minutes of light movement (shoulder circles, arm swings,
    cat-cow) prepare joints and connective tissue. Training cold significantly increases injury risk.
  </li>
  <li>
    <strong>Less volume, more quality:</strong> Instead of 6 sets to failure, 3–4 sets with clean technique
    and one rep "in reserve" is enough. This spares the nervous system.
  </li>
  <li>
    <strong>Longer rest periods:</strong> 2 minutes between sets instead of 60 seconds – inter-set
    recovery becomes increasingly important after 40.
  </li>
  <li>
    <strong>Frequency over intensity:</strong> 4 moderate sessions per week beats 2 extreme ones.
    The body adapts better to regular moderate stimuli.
  </li>
  <li>
    <strong>Relieve wrist stress:</strong> If you have wrist pain, try fist push-ups (neutral wrist
    position) or push-up handles.
  </li>
</ul>

<h2>A Realistic Starting Plan</h2>
<p>
  If you've had a long break, don't start where you left off. Weeks 1–2: 3 × 8–12 clean push-ups
  (knee variation if needed), with full focus on technique. Increase total volume by a maximum of
  10% per week. Patience isn't a weakness – it's the strategy.
</p>

<h2>Take Pain Seriously</h2>
<p>
  Muscle soreness is normal. Joint pain is not. Pain in the shoulder, elbow, or wrist is a clear
  stop signal. Consult a physiotherapist before continuing in that case. Training breaks from
  injuries cost more time than preventive rest periods.
</p>

<h2>Keep Progress Visible</h2>
<p>
  Especially after 40, it's important to document progress objectively – because the subjective
  feeling often misleads. With Pushup Tracker you can see at a glance whether you've done more
  this week than last week. That's the anchor that keeps you motivated even on tough days.
</p>
    `.trim(),
  },
  {
    slug: 'pushup-tracker-guide',
    lang: 'en',
    translationSlug: 'liegestuetze-tracker',
    title: 'How a Tracker Helps You Hit Push-Up Personal Bests',
    description:
      'Why a digital push-up tracker makes the difference – and how Pushup Tracker helps you achieve personal bests and stay consistent.',
    publishedAt: '2025-03-10',
    keywords: [
      'push-up tracker app',
      'push-up app',
      'track push-ups',
      'Pushup Tracker',
      'push-up progress tracking',
    ],
    content: `
<h2>The Problem with Gut Feeling</h2>
<p>
  Most people train by feel. They vaguely know they "did more last week" or "it feels harder today."
  But without concrete numbers, progress is hard to spot – and often underestimated. A training
  journal or tracker brings clarity where memory fails.
</p>

<h2>Why Data Accelerates Your Progress</h2>
<p>
  When you record every session, several things happen at once:
</p>
<ul>
  <li><strong>Objective measurement:</strong> You can see in black and white whether you're truly making progress or have been stagnating for weeks.</li>
  <li><strong>Higher accountability:</strong> Knowing you need to log a session demonstrably increases training frequency.</li>
  <li><strong>Optimization:</strong> You learn after how many rest days you perform better, or which days of the week your energy level is highest.</li>
  <li><strong>Long-term motivation:</strong> Numbers tell a story. Seeing that you've grown from 20 to 80 push-ups keeps you motivated.</li>
</ul>

<h2>What Pushup Tracker Offers</h2>
<p>
  Pushup Tracker is a free, browser-based tracker built specifically for the push-up community.
  Instead of bloated feature lists, it focuses on the essentials:
</p>
<ul>
  <li><strong>Quick logging:</strong> Create an entry in under 2 seconds – with quick actions for common rep counts.</li>
  <li><strong>Streak tracking:</strong> See at a glance how many consecutive days you've trained. The streak becomes the strongest motivator.</li>
  <li><strong>Charts & KPIs:</strong> Daily volume, weekly trends, and personal bests as clean charts – no data clutter.</li>
  <li><strong>Leaderboard:</strong> Optionally and anonymously compete with other users – daily, weekly, or monthly.</li>
  <li><strong>AI reminders:</strong> Get hourly browser notifications with a personalized AI-generated motivational quote.</li>
  <li><strong>Device sync:</strong> All data available in real time on all devices – no manual syncing needed.</li>
</ul>

<h2>Who Benefits from a Push-Up Tracker?</h2>
<p>
  In short: anyone who's serious about making progress. Beginners benefit from the structure and
  visual confirmation of their first achievements. Advanced athletes use the data for periodization
  and plateau-busting. Even those who "only" do 30 push-ups daily gain a new awareness of their
  body and performance through tracking.
</p>

<h2>Start Free – No Risk</h2>
<p>
  Pushup Tracker is and will remain free. No subscription, no credit card, no catch. You can
  sign up in seconds and start tracking right away. Your data belongs to you – stored in the cloud
  but exportable at any time.
</p>
<p>
  Start today and experience how much easier it is to stay consistent when progress becomes visible.
</p>
    `.trim(),
  },
];
