export interface BlogPost {
  slug: string;
  lang: 'de' | 'en';
  title: string;
  description: string;
  publishedAt: string;
  content: string;
  keywords: string[];
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

  // ── English blog posts ────────────────────────────────────────────────────
  {
    slug: 'pushup-progression',
    lang: 'en',
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
    slug: 'pushup-tracker-guide',
    lang: 'en',
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
