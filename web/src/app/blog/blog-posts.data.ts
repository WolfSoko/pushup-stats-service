export interface BlogPost {
  slug: string;
  lang: 'de' | 'en';
  title: string;
  description: string;
  publishedAt: string;
  /** Optional ISO date; when present the article shows "Updated on …" and sets article:modified_time. */
  updatedAt?: string;
  content: string;
  keywords: string[];
  /** Slug of the same article in the other locale — enables hreflang pairing in the sitemap. */
  translationSlug?: string;
  /** Absolute URL of the hero image rendered above the article body and used for og:image. */
  heroImage?: string;
  /** Accessible alt text for the hero image. */
  heroImageAlt?: string;
  /** Small credit line rendered under the hero — typically "Photo: Photographer on Unsplash". HTML allowed. */
  heroImageCredit?: string;
}

export function getBlogPostsByLocale(locale: string): BlogPost[] {
  const lang = locale.startsWith('en') ? 'en' : 'de';
  return BLOG_POSTS.filter((p) => p.lang === lang).sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt)
  );
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
    slug: 'liegestuetze-fehler',
    lang: 'de',
    translationSlug: 'pushup-mistakes',
    title: 'Die 7 häufigsten Fehler bei Liegestützen — und wie du sie behebst',
    description:
      'Schlechte Form kostet dich Wiederholungen, Fortschritt und manchmal die Schulter. Die häufigsten Fehler bei Liegestützen, mit konkreten Korrekturen.',
    publishedAt: '2026-04-30',
    keywords: [
      'Liegestütze Fehler',
      'Liegestütze richtig machen',
      'Liegestütze Technik',
      'Liegestütze Form',
      'Schulter schmerzen Liegestütze',
    ],
    heroImage:
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt:
      'Athletin in Plank-Position auf einer Trainingsmatte, neutrale Kopfhaltung.',
    heroImageCredit:
      'Foto: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
    content: `
<h2>Warum saubere Form mehr zählt als 100 schlechte Wiederholungen</h2>
<p>
  Liegestütze sind eine der unterschätzten Übungen: scheinbar simpel, in Wahrheit eine
  Ganzkörperbewegung mit Dutzenden Stellschrauben. Wer 50 schlampige Liegestütze macht, trainiert
  Sehnenverkürzungen und kompensatorische Muster — wer 20 saubere macht, baut Kraft auf, die
  übertragbar bleibt. Die folgenden sieben Fehler tauchen in fast jedem Anfängervideo auf, und drei
  davon kosten dich langfristig die Schulter.
</p>

<h2>Fehler 1: Hängender Po — die instabile Mitte</h2>
<p>
  Der häufigste Fehler überhaupt. Wenn die Hüfte unter der Linie zwischen Schultern und Fersen
  hängt, wird die Lendenwirbelsäule zur federnden Brücke. Das schmerzt nicht sofort, aber summiert
  sich. Ursache ist meist eine schwache Bauchmuskulatur, die unter Belastung loslässt.
</p>
<p>
  <strong>Fix:</strong> Bevor du in die Liegestütze gehst, spanne aktiv den Bauch an, als würdest
  du einen Schlag erwarten. Diese Spannung muss bis zum Ende des Satzes halten. Wenn du sie
  verlierst, ist der Satz vorbei — egal wie viele Wiederholungen geplant waren.
</p>

<h2>Fehler 2: Ellenbogen nach außen — Schulter-Killer Nummer eins</h2>
<p>
  Die klassische „T-Position": Ellenbogen 90° vom Körper abgespreizt. Sieht imposant aus, knallt
  aber den Oberarmkopf direkt gegen das Schulterdach. Wiederhole das oft genug, und das Subakromial-
  Impingement ist programmiert.
</p>
<p>
  <strong>Fix:</strong> Ellenbogen sollten beim Absenken einen Winkel von etwa 45° zum Rumpf
  bilden. Stell dir vor, du würdest mit den Ellenbogen die Hüfte „berühren" wollen. Die Hände
  bleiben unter den Schultern oder leicht weiter — nicht weit außen.
</p>

<h2>Fehler 3: Halbe Bewegung — die selbstgewählte Lüge</h2>
<p>
  Ego-Wiederholungen, bei denen die Brust 20 cm über dem Boden umkehrt. Aus Sicht der Statistik
  klingt eine 50er-Serie super; aus Sicht der Muskulatur fehlt die untere Hälfte des Kraftspektrums.
  Genau dort entsteht aber der Reiz, der Wachstum auslöst.
</p>
<p>
  <strong>Fix:</strong> Brust berührt den Boden (oder kommt 1–2 cm darüber). Wenn das nicht
  geht, regression auf erhöhte Hände — Fensterbank, Stuhl, Treppenstufe — bis du voll absenken
  kannst. Lieber 8 saubere Wiederholungen als 20 halbe.
</p>

<h2>Fehler 4: Kopf nach oben — Nacken statt Bauch</h2>
<p>
  Beim Anstrengen geht der Kopf reflexartig in den Nacken. Die Halswirbelsäule überstreckt, der
  obere Trapezius springt ein, und nach 50 Wiederholungen tut der Nacken mehr weh als die Brust.
</p>
<p>
  <strong>Fix:</strong> Blick etwa einen halben Meter vor die Hände auf den Boden. Kopf bleibt in
  Verlängerung der Wirbelsäule — als ob du eine Tasse auf dem Hinterkopf balancierst.
</p>

<h2>Fehler 5: Tempo-Roulette — explosiv runter, träge hoch</h2>
<p>
  Den Boden „abfangen" und mit Schwung wieder hochpressen. Die exzentrische Phase (das Absenken)
  ist aber der Hauptreiz für Hypertrophie. Wer sie verschenkt, lässt 40 % der Wirkung liegen.
</p>
<p>
  <strong>Fix:</strong> 2 Sekunden runter, kurze Pause unten, kontrolliert hoch. Erst wenn du
  Tempo:1-1-1-0 sauber beherrschst, darfst du auf explosive Liegestütze umsteigen.
</p>

<h2>Fehler 6: Atem anhalten — der unsichtbare Bremser</h2>
<p>
  Pressatmung beim Hochdrücken erhöht den intrathorakalen Druck und kann zu Schwindel führen. Über
  längere Sätze hinweg leidet außerdem die Kraftentfaltung.
</p>
<p>
  <strong>Fix:</strong> Beim Absenken einatmen, beim Hochdrücken kontrolliert ausatmen. Bei
  Maximalsätzen ist eine kurze Bracing-Phase okay, aber nicht über mehrere Wiederholungen halten.
  Mehr dazu in unserem <a href="/de/blog/liegestuetze-atmung">Atemtechnik-Artikel</a>.
</p>

<h2>Fehler 7: Zu viel zu früh — Volumen statt Qualität</h2>
<p>
  „100 Liegestütze täglich" klingt nach Disziplin, ist aber für 95 % der Einsteiger der schnellste
  Weg in die Schulterinflammation. Bindegewebe und Sehnen brauchen länger zur Adaption als Muskeln.
</p>
<p>
  <strong>Fix:</strong> Steigere das Wochenvolumen um maximal 10 %. Wenn du letzte Woche 100
  Wiederholungen geschafft hast, sind 110 das Ziel — nicht 200. Geduld schlägt Heroismus.
</p>

<h2>Die 5-Minuten-Selbstdiagnose</h2>
<p>
  Stell dein Smartphone zur Seite und filme einen Satz von 10 Wiederholungen. Schau dir das Video
  zweimal an: einmal von der Seite (Hüftlinie, Tiefe), einmal von hinten (Ellenbogen-Winkel,
  Schulterposition). Du siehst innerhalb von 30 Sekunden, welcher der sieben Fehler bei dir
  dominiert. Repariere einen pro Trainingswoche — nicht alle gleichzeitig.
</p>

<aside class="plan-cta">
  <h3>Form sauber? Dann wird's Zeit für Volumen</h3>
  <p>
    Wenn deine Technik stimmt, bist du bereit für strukturiertes Volumen. Der
    <a href="/de/training-plans/recruit-6w">6-Wochen-Aufbauplan</a> bringt dich von 0 auf 100
    saubere Wiederholungen — mit progressiver Belastung statt Crash-Programm.
  </p>
</aside>
    `.trim(),
  },
  {
    slug: 'pushup-mistakes',
    lang: 'en',
    translationSlug: 'liegestuetze-fehler',
    title: 'The 7 most common push-up mistakes — and how to fix each one',
    description:
      'Bad form costs you reps, progress, and sometimes your shoulder. The most common push-up mistakes, with concrete fixes for each.',
    publishedAt: '2026-04-30',
    keywords: [
      'push-up mistakes',
      'push-up form',
      'push-up technique',
      'shoulder pain push-ups',
      'how to do push-ups properly',
    ],
    heroImage:
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt:
      'Athlete in plank position on a training mat, neutral head position.',
    heroImageCredit:
      'Photo: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
    content: `
<h2>Why clean form beats 100 sloppy reps</h2>
<p>
  Push-ups are an underrated full-body exercise — deceptively simple, with dozens of moving parts.
  Fifty sloppy reps train compensatory patterns and tendon overload. Twenty clean reps build
  strength that transfers. The seven mistakes below show up in nearly every beginner video, and
  three of them eventually cost you a shoulder.
</p>

<h2>Mistake 1: Sagging hips — the unstable middle</h2>
<p>
  By far the most common error. When the hips drop below the line from shoulders to heels, the
  lumbar spine becomes a flexing bridge. It doesn't hurt right away, but it adds up. The cause
  is usually a weak core that lets go under load.
</p>
<p>
  <strong>Fix:</strong> Before lowering, brace the abs as if expecting a punch. The brace must
  hold until the end of the set. If you lose it, the set is over — regardless of the planned reps.
</p>

<h2>Mistake 2: Flared elbows — shoulder-killer number one</h2>
<p>
  The classic "T-position": elbows splayed 90° from the torso. Looks dramatic, but it drives the
  humeral head straight into the acromion. Repeat that often enough and subacromial impingement
  is on the way.
</p>
<p>
  <strong>Fix:</strong> Elbows should track at roughly 45° to the torso during the descent.
  Imagine you're trying to graze your hips with the elbows. Hands stay under the shoulders or
  slightly wider — never far out.
</p>

<h2>Mistake 3: Half reps — the quiet self-deception</h2>
<p>
  Ego reps where the chest reverses 8 inches above the floor. Sounds great as a 50-rep stat;
  leaves out the lower half of the strength curve, which is exactly where the growth stimulus
  lives.
</p>
<p>
  <strong>Fix:</strong> Chest touches the floor (or comes within an inch). If that's not
  possible, regress to elevated hands — windowsill, chair, stair — until you can lower fully.
  Eight clean reps beat twenty half ones every time.
</p>

<h2>Mistake 4: Head up — neck instead of core</h2>
<p>
  Under exertion the head reflexively tilts back. The cervical spine extends, the upper traps
  jump in, and after 50 reps your neck hurts more than your chest.
</p>
<p>
  <strong>Fix:</strong> Eyes about half a meter (1.5 ft) in front of your hands on the floor.
  Head stays in line with the spine — as if balancing a cup on the back of your skull.
</p>

<h2>Mistake 5: Tempo roulette — fast down, slow up</h2>
<p>
  Catching the floor and bouncing up. But the eccentric phase (the descent) is the primary
  hypertrophy driver. Skip it and you leave 40% of the effect on the table.
</p>
<p>
  <strong>Fix:</strong> 2 seconds down, brief pause at the bottom, controlled press up. Only
  after you've mastered tempo 1-1-1-0 should you graduate to explosive push-ups.
</p>

<h2>Mistake 6: Holding your breath — the invisible brake</h2>
<p>
  Valsalva pressing during the push raises intrathoracic pressure and can trigger lightheadedness.
  Across longer sets, force production also suffers.
</p>
<p>
  <strong>Fix:</strong> Inhale on the descent, exhale on the press. A short brace is okay during
  max attempts, but don't sustain it across multiple reps. More on this in our
  <a href="/en/blog/pushup-breathing">breathing technique article</a>.
</p>

<h2>Mistake 7: Too much too soon — volume over quality</h2>
<p>
  "100 push-ups a day" sounds disciplined but is, for 95% of beginners, the fastest path to
  shoulder inflammation. Connective tissue and tendons adapt slower than muscle.
</p>
<p>
  <strong>Fix:</strong> Increase weekly volume by no more than 10%. If you hit 100 reps last
  week, target 110 — not 200. Patience beats heroism.
</p>

<h2>The 5-minute self-diagnosis</h2>
<p>
  Set your phone aside and film a set of 10 reps. Watch the clip twice: once from the side (hip
  line, depth), once from behind (elbow angle, shoulder position). Within 30 seconds you'll see
  which of the seven mistakes dominates. Repair one per training week — not all at once.
</p>

<aside class="plan-cta">
  <h3>Form clean? Now's the time for volume</h3>
  <p>
    With your technique solid, you're ready for structured volume. The
    <a href="/en/training-plans/recruit-6w">6-week buildup plan</a> takes you from 0 to 100 clean
    reps using progressive overload, not crash programming.
  </p>
</aside>
    `.trim(),
  },
  {
    slug: 'liegestuetze-frauen',
    lang: 'de',
    translationSlug: 'pushups-for-women',
    title: 'Liegestütze für Frauen: Mythen, Anatomie und ein 4-Wochen-Einstieg',
    description:
      'Frauen können dieselben Liegestütze wie Männer — die Progression sieht oft nur anders aus. Anatomie, Mythen und ein realistischer Einstiegsplan.',
    publishedAt: '2026-04-29',
    keywords: [
      'Liegestütze Frauen',
      'Liegestütze lernen Frau',
      'Pushups für Frauen',
      'Frau Liegestütze Trainingsplan',
      'Liegestütze Anfänger Frau',
    ],
    heroImage:
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt:
      'Sportlerin in einer kontrollierten Liegestütze auf einer Outdoor-Trainingsmatte.',
    heroImageCredit:
      'Foto: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
    content: `
<h2>„Frauen können keine Liegestütze" — der hartnäckigste Mythos im Fitnessstudio</h2>
<p>
  Diese Behauptung hält sich seit Jahrzehnten und ist falsch. Frauen können Liegestütze. Was
  unterschiedlich ist: die Ausgangsposition, nicht die Endposition. Der Weg dorthin braucht oft
  eine andere Progression — und genau die wird im Standardprotokoll selten erklärt.
</p>

<h2>Was die Anatomie wirklich sagt</h2>
<p>
  Im Schnitt haben Frauen ein anderes Verhältnis von Oberkörper- zu Unterkörperkraft als Männer:
  ungefähr 55 % zu 45 %, bei Männern eher 60 % zu 40 %. Das macht den Bench-Press-Vergleich
  unfair, sagt aber nichts über das Lernpotenzial aus. Studien (z. B. Hsu et al., 2018) zeigen,
  dass Frauen mit gezieltem Training in 8–12 Wochen genauso saubere Standard-Liegestütze schaffen
  wie männliche Vergleichsgruppen — wenn die Progression stimmt.
</p>
<p>
  Was du wissen musst: der relative Körperhebel ist bei voll ausgestreckter Liegestütze für
  niemanden bequem. Der Trick ist, den Hebel schrittweise zu vergrößern, statt von „Knie-
  Liegestütze" direkt auf „voll" zu springen.
</p>

<h2>Die fünf Stufen der Progression</h2>
<ol>
  <li>
    <strong>Wand-Liegestütze:</strong> Hände schulterbreit an einer Wand, Füße einen Meter
    zurück. Lehne dich kontrolliert vor, drücke zurück. Ziel: 3×15 saubere Wiederholungen.
  </li>
  <li>
    <strong>Erhöhte Liegestütze:</strong> Hände auf Küchenplatte, Stuhllehne oder Sofa. Je tiefer
    die Auflage, desto schwerer. Ziel: 3×12 mit korrekter Form.
  </li>
  <li>
    <strong>Knie-Liegestütze:</strong> Knie als Drehpunkt, Körper bildet eine gerade Linie von
    Knien bis Kopf. Ziel: 3×10 mit voller Bewegungsamplitude.
  </li>
  <li>
    <strong>Negative Liegestütze:</strong> Voller Hebel, aber nur die Absenkphase. 3 Sekunden
    runter, dann auf die Knie zurück. Ziel: 3×5 saubere Negatives.
  </li>
  <li>
    <strong>Volle Liegestütze:</strong> Erst eine, dann zwei, dann eine kleine Serie. Wenn drei
    sauber gehen, hast du die Bewegung beherrscht.
  </li>
</ol>

<h2>Ein realistischer 4-Wochen-Einstiegsplan</h2>
<p>
  Drei Trainingstage pro Woche (Mo/Mi/Fr), je 15 Minuten. Pro Einheit drei Sätze der aktuellen
  Stufe + ein Kraftblock (Plank 3×30 s + Glute Bridge 3×12).
</p>
<ul>
  <li><strong>Woche 1:</strong> Stufe 1 (Wand). Wenn 3×15 sauber gehen, in Woche 2 wechseln.</li>
  <li><strong>Woche 2:</strong> Stufe 2 (erhöht). Auflage so wählen, dass 3×10 möglich sind.</li>
  <li><strong>Woche 3:</strong> Stufe 3 (Knie) + ein Versuch Negatives am Ende der Einheit.</li>
  <li><strong>Woche 4:</strong> Stufe 4 (Negatives) als Hauptübung, am Schluss eine volle
    Liegestütze versuchen.</li>
</ul>
<p>
  Etwa 70 % der Einsteigerinnen schaffen nach diesem Schema in Woche 4–6 die erste vollständige
  Liegestütze. Die anderen 30 % brauchen 8–10 Wochen — was völlig im Rahmen liegt.
</p>

<h2>Hormoneller Zyklus und Trainingsfenster</h2>
<p>
  Die Forschung ist hier weniger eindeutig als oft behauptet. Was sich konsistent zeigt: in der
  Lutealphase (zweite Zyklushälfte) brauchen viele Frauen längere Erholungszeiten zwischen Sätzen.
  Statt 60 Sekunden Pause lieber 90 Sekunden, statt 4 Sätzen lieber 3. Das ist keine Schwäche —
  das ist optimiertes Training. Die <a href="/de/blog/liegestuetze-tracker">Tracking-Daten</a>
  zeigen dir nach 1–2 Zyklen, wo deine Hochphase liegt.
</p>

<h2>Häufige Stolperer</h2>
<ul>
  <li><strong>Zu lange auf einer Stufe:</strong> Wenn 3×15 sauber sind, weiter — nicht
    „perfekt" werden wollen.</li>
  <li><strong>Knie-Liegestütze überspringen:</strong> Sieht nach „Mädchen-Variante" aus, ist
    aber die wichtigste Brücke zwischen erhöht und voll. Nicht überspringen.</li>
  <li><strong>Tägliches Training:</strong> Drei Tage reichen. Bindegewebe braucht 48 h.</li>
</ul>

<aside class="plan-cta">
  <h3>Begleite den Plan im Tracker</h3>
  <p>
    Lade den 4-Wochen-Plan oder steige direkt in den
    <a href="/de/training-plans/recruit-6w">6-Wochen-Aufbau</a> ein, sobald die ersten 3 vollen
    Wiederholungen sitzen. Pushup Tracker zeigt dir wöchentlich, wie sich das Volumen entwickelt
    — und wann du auf die nächste Stufe wechseln kannst.
  </p>
</aside>
    `.trim(),
  },
  {
    slug: 'pushups-for-women',
    lang: 'en',
    translationSlug: 'liegestuetze-frauen',
    title: 'Push-ups for women: myths, anatomy, and a 4-week starting plan',
    description:
      'Women can do the same push-ups as men — the progression often just looks different. Anatomy, myths, and a realistic 4-week starter plan.',
    publishedAt: '2026-04-29',
    keywords: [
      'push-ups for women',
      'how women learn push-ups',
      'female push-up plan',
      'women push-up beginner',
      'push-up progression women',
    ],
    heroImage:
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt:
      'Female athlete performing a controlled push-up on an outdoor training mat.',
    heroImageCredit:
      'Photo: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
    content: `
<h2>"Women can't do push-ups" — the most stubborn gym myth</h2>
<p>
  This claim has held on for decades and it's wrong. Women can do push-ups. What differs: the
  starting position, not the end position. The path to a full rep just often needs a different
  progression — and that progression is rarely explained in the standard protocol.
</p>

<h2>What anatomy actually says</h2>
<p>
  On average, women have a different upper- to lower-body strength ratio than men: roughly 55:45
  vs. 60:40 for men. That makes a bench-press comparison unfair, but it says nothing about the
  potential to learn the movement. Studies (e.g. Hsu et al., 2018) show that women hit clean
  standard push-ups in 8–12 weeks of targeted training — the same timeline as male peers — when
  the progression is right.
</p>
<p>
  What matters: the body-leverage at full plank isn't comfortable for anyone. The trick is to
  expand the leverage gradually rather than jumping straight from "knee push-ups" to "full".
</p>

<h2>The five-stage progression</h2>
<ol>
  <li>
    <strong>Wall push-ups:</strong> Hands shoulder-width on a wall, feet a meter back. Lean in
    under control, press back. Target: 3×15 clean reps.
  </li>
  <li>
    <strong>Elevated push-ups:</strong> Hands on a kitchen counter, chair back, or sofa. The lower
    the surface, the harder. Target: 3×12 with correct form.
  </li>
  <li>
    <strong>Knee push-ups:</strong> Knees as the pivot, body forms a straight line from knees to
    head. Target: 3×10 with full range.
  </li>
  <li>
    <strong>Negative push-ups:</strong> Full leverage, but only the eccentric. 3 seconds down,
    then drop to your knees. Target: 3×5 clean negatives.
  </li>
  <li>
    <strong>Full push-ups:</strong> First one, then two, then a small set. Three clean reps means
    the movement is yours.
  </li>
</ol>

<h2>A realistic 4-week starter plan</h2>
<p>
  Three training days per week (Mon/Wed/Fri), 15 minutes each. Per session, three sets of the
  current stage plus a strength block (plank 3×30s + glute bridge 3×12).
</p>
<ul>
  <li><strong>Week 1:</strong> Stage 1 (wall). Once 3×15 are clean, advance.</li>
  <li><strong>Week 2:</strong> Stage 2 (elevated). Choose a height that allows 3×10.</li>
  <li><strong>Week 3:</strong> Stage 3 (knee) + one negative attempt at session end.</li>
  <li><strong>Week 4:</strong> Stage 4 (negatives) as main work, attempt a full rep last.</li>
</ul>
<p>
  Roughly 70% of beginners hit their first full rep in weeks 4–6 with this scheme. The other 30%
  need 8–10 weeks — well within normal range.</p>

<h2>Hormonal cycle and training windows</h2>
<p>
  The research is less clear-cut than often claimed. What does show consistently: in the luteal
  phase (the second half of the cycle), many women need longer rest between sets. 90 seconds
  instead of 60. 3 sets instead of 4. That's not weakness — it's optimised training. Your
  <a href="/en/blog/pushup-tracker-guide">tracking data</a> will reveal your high-output windows
  after 1–2 cycles.
</p>

<h2>Common stumbling blocks</h2>
<ul>
  <li><strong>Stuck on one stage too long:</strong> Once 3×15 are clean, move on — don't chase
    "perfect".</li>
  <li><strong>Skipping knee push-ups:</strong> Looks like the "girl version", but it's the most
    important bridge between elevated and full. Don't skip.</li>
  <li><strong>Daily training:</strong> Three days is enough. Connective tissue needs 48 hours.</li>
</ul>

<aside class="plan-cta">
  <h3>Track the plan in the app</h3>
  <p>
    Run the 4-week plan or jump straight into the
    <a href="/en/training-plans/recruit-6w">6-week buildup</a> once your first 3 full reps are in.
    Pushup Tracker shows your weekly volume and signals when you're ready for the next stage.
  </p>
</aside>
    `.trim(),
  },
  {
    slug: 'liegestuetze-atmung',
    lang: 'de',
    translationSlug: 'pushup-breathing',
    title:
      'Richtig atmen bei Liegestützen: Bracing, Rhythmus und der Unterschied bei Maximalsätzen',
    description:
      'Atmung wird bei Liegestützen unterschätzt. Wann einatmen, wann ausatmen, was Bracing bedeutet — und warum die Antwort beim Maximalsatz anders ist.',
    publishedAt: '2026-04-28',
    keywords: [
      'Liegestütze Atmung',
      'richtig atmen Liegestütze',
      'Bracing Liegestütze',
      'Pushup Atemtechnik',
      'Atemtechnik Krafttraining',
    ],
    heroImage:
      'https://images.unsplash.com/photo-1599058917765-a780eda07a3e?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt:
      'Athlet in Plank-Position mit konzentriertem Gesichtsausdruck.',
    heroImageCredit:
      'Foto: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
    content: `
<h2>Warum Atmung bei einer „simplen" Übung mitspielt</h2>
<p>
  Liegestütze gelten als selbsterklärend — und genau deshalb wird Atmung selten thematisiert.
  Dabei macht die Differenz zwischen „Atem anhalten" und „bewusst atmen" auf 20 Wiederholungen
  oft 3–5 Wiederholungen Unterschied aus. Bei Maximalsätzen kommt eine zweite Frage dazu:
  Pressatmung ja oder nein? Beides hat seine Berechtigung — aber nicht im selben Satz.
</p>

<h2>Bracing-Atmung: das Fundament</h2>
<p>
  „Bracing" bedeutet, den Rumpf wie einen Druckbehälter zu stabilisieren. Statt locker durchzuatmen
  spannst du den gesamten Rumpf an — Bauch, schräge Bauchmuskulatur, Beckenboden, unteren Rücken
  — als würdest du einen Schlag erwarten. Die Atmung läuft dann durch ein „verkleinertes" Volumen,
  nicht durch einen kollabierenden Brustkorb.
</p>
<p>
  Ohne Bracing verlierst du auf jeder Wiederholung Energie an einen weichen Mittelteil. Mit Bracing
  steht der Rumpf wie ein Brett — die Schulter- und Brustmuskulatur kann effizient ziehen, ohne
  dass die Hüfte durchhängt.
</p>

<h2>Der Standard-Rhythmus für 3×AMRAP-Sätze</h2>
<ol>
  <li><strong>Beim Absenken:</strong> Kontrolliert einatmen, durch die Nase oder leicht durch den
    Mund. Bauch bleibt fest.</li>
  <li><strong>Unten:</strong> Kurze Pause, Bracing halten.</li>
  <li><strong>Beim Hochdrücken:</strong> Mit der Anstrengung ausatmen. Der Atemstrom synchronisiert
    sich mit der Muskelkontraktion.</li>
</ol>
<p>
  Dieser Rhythmus funktioniert für 80 % aller Trainingssituationen: Aufbauphase, lange Sätze,
  technikorientierte Einheiten.
</p>

<h2>Maximalsatz: die Ausnahme</h2>
<p>
  Bei einem echten Maximalsatz (1–3 Wiederholungen am absoluten Limit) ist kurz Pressatmung erlaubt
  — also Luft anhalten und Bracing maximal spannen. Der intrathorakale Druck stabilisiert die
  Wirbelsäule und steigert kurzfristig die Kraftentfaltung um messbare 5–10 %. <strong>Wichtig:</strong>
  Pressatmung gehört nur zur einzelnen Wiederholung, nicht zum gesamten Satz. Spätestens nach 2–3
  Sekunden ausatmen, sonst droht Schwindel.
</p>

<h2>Drei häufige Fehler</h2>
<ul>
  <li><strong>Atem ganz anhalten:</strong> Klassiker bei Anfängern. Nach 8–10 Wiederholungen
    schwarz vor Augen, Satz vorbei. Lösung: bewusster Rhythmus, auch wenn die Wiederholungen
    schwer werden.</li>
  <li><strong>Hechelnde Atmung:</strong> Kurze, schnelle Atemzüge ohne Bracing. Der Rumpf wird
    weich, die Hüfte sackt durch. Lösung: tiefe Bauchatmung, aktives Spannen.</li>
  <li><strong>Pressatmung im Aufbausatz:</strong> Bringt nichts und kostet nach 6–7 Wiederholungen
    den Restsatz. Pressatmung ist ein Werkzeug für 1–3 Wiederholungen, nicht für 20.</li>
</ul>

<h2>Drill: Bracing in 3 Minuten lernen</h2>
<ol>
  <li>Lege dich in eine Plank-Position. Spanne den Bauch an, als würde gleich jemand drauftreten.</li>
  <li>Atme tief in den Bauch ein — nicht in die Brust. Die Spannung muss bleiben.</li>
  <li>Atme langsam aus, ohne die Spannung zu verlieren. Wiederhole 5×.</li>
</ol>
<p>
  Wenn du das in der Plank kannst, übertragst du es auf die Liegestütze. Innerhalb von 1–2
  Trainingseinheiten wird der Rhythmus automatisch.
</p>

<h2>Wie viel Unterschied macht es wirklich?</h2>
<p>
  In einem typischen 3×AMRAP-Workout schaffen Personen mit sauberer Atemtechnik im Schnitt 12–18 %
  mehr Gesamtwiederholungen als bei chaotischer Atmung. Das ist mehr Effekt, als die meisten
  Supplements liefern — und kostet nichts.
</p>

<aside class="plan-cta">
  <h3>Form prüfen, Atmung üben — und dann tracken</h3>
  <p>
    Wenn Atmung und Form sitzen, hilft konsequentes Tracking dabei, das Wochenvolumen langsam
    zu steigern. Eine Übersicht typischer Formfehler findest du im
    <a href="/de/blog/liegestuetze-fehler">Fehler-Artikel</a>.
  </p>
</aside>
    `.trim(),
  },
  {
    slug: 'pushup-breathing',
    lang: 'en',
    translationSlug: 'liegestuetze-atmung',
    title:
      'Breathing for push-ups: bracing, rhythm, and what changes at max effort',
    description:
      'Breathing is undersold for push-ups. When to inhale, when to exhale, what bracing means — and why max-effort sets need a different rule.',
    publishedAt: '2026-04-28',
    keywords: [
      'push-up breathing',
      'how to breathe push-ups',
      'bracing push-ups',
      'breath technique strength',
      'push-up valsalva',
    ],
    heroImage:
      'https://images.unsplash.com/photo-1599058917765-a780eda07a3e?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt: 'Athlete in plank position with focused expression.',
    heroImageCredit:
      'Photo: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
    content: `
<h2>Why breathing matters for a "simple" exercise</h2>
<p>
  Push-ups feel self-explanatory — which is exactly why breathing is rarely discussed. But the
  difference between "holding your breath" and "breathing on purpose" easily costs 3–5 reps on a
  set of 20. For max-effort sets, a second question shows up: Valsalva or not? Both have their
  place — just not in the same set.
</p>

<h2>Bracing breath: the foundation</h2>
<p>
  Bracing means stabilising the trunk like a pressure vessel. Instead of breathing loosely, you
  tense the entire core — abs, obliques, pelvic floor, low back — as if expecting a hit. Breathing
  then happens inside a "smaller" volume, not through a collapsing rib cage.
</p>
<p>
  Without bracing, every rep loses energy to a soft middle. With bracing, the trunk stays rigid,
  and the chest and shoulders can pull efficiently without the hips sagging.
</p>

<h2>Standard rhythm for 3×AMRAP sets</h2>
<ol>
  <li><strong>On the descent:</strong> Inhale under control, through nose or lightly through the
    mouth. The brace stays.</li>
  <li><strong>At the bottom:</strong> Brief pause, brace held.</li>
  <li><strong>On the press:</strong> Exhale with the effort. The breath synchronises with the
    contraction.</li>
</ol>
<p>
  This rhythm covers 80% of training scenarios: buildup phases, long sets, technique-focused work.
</p>

<h2>Max-effort sets: the exception</h2>
<p>
  At a true max-effort set (1–3 reps at the absolute limit), short Valsalva is fine — hold your
  breath and brace maximally. Intrathoracic pressure stabilises the spine and adds a measurable
  5–10% in force output. <strong>Important:</strong> Valsalva belongs to a single rep, not the
  whole set. Exhale within 2–3 seconds, otherwise lightheadedness sets in.
</p>

<h2>Three common mistakes</h2>
<ul>
  <li><strong>Holding breath the whole set:</strong> Beginner classic. Black spots after 8–10
    reps, set over. Fix: deliberate rhythm even when reps get hard.</li>
  <li><strong>Panting:</strong> Short, quick breaths without bracing. Trunk softens, hips drop.
    Fix: deep belly breaths, active tension.</li>
  <li><strong>Valsalva on buildup sets:</strong> Buys you nothing and burns the rest of the set
    after rep 6–7. Valsalva is a tool for 1–3 reps, not 20.</li>
</ul>

<h2>Drill: learn bracing in 3 minutes</h2>
<ol>
  <li>Get into a plank. Brace the abs as if someone's about to step on your stomach.</li>
  <li>Inhale deep into the belly — not the chest. The tension must stay.</li>
  <li>Exhale slowly without losing the tension. Repeat 5×.</li>
</ol>
<p>
  Once you can hold this in the plank, transfer it to the push-up. The rhythm becomes automatic
  within 1–2 sessions.
</p>

<h2>How big is the actual difference?</h2>
<p>
  In a typical 3×AMRAP workout, athletes with clean breathing technique average 12–18% more total
  reps than those with chaotic breathing. That's a bigger effect than most supplements deliver —
  for free.
</p>

<aside class="plan-cta">
  <h3>Form check, breathing dialed — then track it</h3>
  <p>
    Once breathing and form are in place, consistent tracking helps you ramp weekly volume. A
    survey of typical form errors lives in our
    <a href="/en/blog/pushup-mistakes">mistakes article</a>.
  </p>
</aside>
    `.trim(),
  },
  {
    slug: 'liegestuetze-herz-studie',
    lang: 'de',
    translationSlug: 'pushups-heart-study',
    title:
      'Die Harvard-Studie, die Liegestützen berühmt machte: 40+ Reps & Herzgesundheit',
    description:
      'Eine Harvard-Studie in JAMA 2019 rückte die Liegestütz-Kapazität auf die Herzrisiko-Landkarte. Was die Daten wirklich zeigen, was nicht – und wie du das für dein Training nutzt.',
    publishedAt: '2026-04-23',
    keywords: [
      'Liegestütze Herzgesundheit',
      'Liegestütze Herzrisiko Studie',
      'Harvard Liegestütze Studie',
      'JAMA Liegestütze',
      'Fitness Herzerkrankung',
    ],
    heroImage:
      'https://images.unsplash.com/photo-1514512364185-4c2b0985be01?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt:
      'Sportlerin in Plank-Position auf Asphalt – Sinnbild für den Push-Up-Kapazitätstest.',
    heroImageCredit:
      'Foto: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
    content: `
<h2>Warum eine einzige Liegestütz-Studie viral ging</h2>
<p>
  Im Februar 2019 veröffentlichte ein Team der Harvard T.H. Chan School of Public Health zehn Jahre Daten
  über 1.104 aktive Männer – Feuerwehrleute aus Indiana – und stellte eine sehr einfache Frage: Lässt sich
  aus der Liegestütz-Kapazität das spätere Herzinfarkt-Risiko vorhersagen?
</p>
<p>
  Das Ergebnis, publiziert in
  <a href="https://pubmed.ncbi.nlm.nih.gov/30821806/" target="_blank" rel="noopener noreferrer nofollow ugc">JAMA Network Open (Yang et al., 2019)</a>,
  schaffte es aus gutem Grund auf die Titelseiten. Männer, die mehr als <strong>40 Liegestütze</strong>
  am Stück schafften, hatten ein <strong>um 96 % geringeres</strong> kardiovaskuläres Ereignisrisiko in
  den folgenden zehn Jahren – im Vergleich zu Männern, die weniger als 10 Reps schafften. Die offizielle
  <a href="https://www.hsph.harvard.edu/news/press-releases/push-ups-correlated-with-reduced-cardiovascular-disease-risk-study/" target="_blank" rel="noopener noreferrer nofollow ugc">Harvard-Pressemitteilung</a>
  fasst es in einem Satz zusammen: "Liegestützen korrelieren mit reduziertem Risiko für Herz-Kreislauf-Erkrankungen."
</p>

<h2>Was die Studie tatsächlich gemessen hat</h2>
<p>
  Es lohnt sich, hinter die Schlagzeile zu schauen:
</p>
<ul>
  <li><strong>Stichprobe:</strong> 1.104 erwachsene Männer, Medianalter 39,6 Jahre, alle beruflich aktiv
    (Feuerwehrleute). Reiner Männer- und Berufsfeuer-Datensatz.</li>
  <li><strong>Test:</strong> Metronom-getaktete Liegestütz-Kapazität am Baseline (2000), mit Follow-up
    kardiovaskulärer Ereignisse bis 2010.</li>
  <li><strong>Ergebnisse:</strong> 37 CVD-Ereignisse über zehn Jahre – Herzinfarkte, koronare
    Todesfälle, Koronareingriffe.</li>
  <li><strong>Vergleich:</strong> Auch die treadmill-gemessene aerobe Kapazität war mit weniger CVD
    assoziiert – aber das Liegestütz-Signal war in dieser Kohorte stärker als das Ausdauer-Signal.</li>
</ul>
<p>
  Die Autoren waren in der Diskussion vorsichtig: Die Liegestütz-Kapazität ist ein Proxy für allgemeine
  funktionelle Fitness, keine eigenständige Ursache besserer Herzgesundheit. Sie ist aber ein
  <em>einfacher, kostenloser, geräteloser Feldtest</em>, der eng mit dem korreliert, was zählt: Muskelmasse,
  aerobe Reserve und Bewegungsqualität.
</p>

<h2>Grenzen, die die Medien übersprungen haben</h2>
<p>
  Was die Studie <strong>nicht</strong> beweist:
</p>
<ul>
  <li>Sie zeigt nicht, dass <em>das Machen</em> von mehr Liegestützen das Herzrisiko <em>kausal</em> senkt.
    Für Kausalität bräuchte es eine randomisierte Interventionsstudie, das war diese nicht.</li>
  <li>Sie gilt nicht direkt für Frauen, nicht für sitzende Populationen, nicht für ältere Erwachsene –
    diese Gruppen waren schlicht nicht Teil der Stichprobe.</li>
  <li>Sie bedeutet nicht, dass Liegestütze Ausdauertraining ersetzen. Die
    <a href="https://www.who.int/news-room/fact-sheets/detail/physical-activity" target="_blank" rel="noopener noreferrer nofollow ugc">
      WHO-Empfehlungen zu körperlicher Aktivität</a>
    fordern weiterhin 150–300 Minuten moderates Ausdauertraining pro Woche <strong>plus</strong>
    Kräftigung an zwei Tagen.</li>
</ul>

<h2>Wie AHA und ACSM den Befund einordnen</h2>
<p>
  Die
  <a href="https://www.heart.org/en/healthy-living/fitness/fitness-basics/aha-recs-for-physical-activity-in-adults" target="_blank" rel="noopener noreferrer nofollow ugc">American Heart Association</a>
  stellt Kräftigungstraining schon länger ins Zentrum der kardiovaskulären Prävention – neben Ausdauer.
  Eigengewichtsübungen wie Liegestützen zählen dazu und sind der reibungsärmste Weg, die geforderten
  zwei Krafteinheiten pro Woche abzuhaken.
</p>

<h2>Wie du das nutzt, ohne es zu überinterpretieren</h2>
<p>
  Die nützliche Botschaft lautet nicht "40 Liegestützen = gesundes Herz". Sie lautet: Ein einfacher
  Feldtest korreliert mit dem Merkmalscocktail, den du ohnehin willst. Zwei praktische Anwendungen:
</p>
<ol>
  <li>
    <strong>Nutze ihn als Benchmark, nicht als Ziel.</strong> Einmal pro Monat einen Maximalsatz bis zur
    Erschöpfung. Die Zahl loggen. Du trackst einen Proxy für den Gesamttrend deiner Fitness, keinen
    Performance-Endwert.
  </li>
  <li>
    <strong>Rückwärts in strukturiertes Training übersetzen.</strong> Bei einem Startwert unter 10 bringt
    dich der <a href="/de/blog/liegestuetze-steigern">Progressionsguide</a> in sechs Wochen auf ein solides
    Niveau. Von 20 auf 40+ ist die
    <a href="/de/blog/30-tage-liegestuetze-challenge">30-Tage-Challenge</a> dafür gemacht, dieses Plateau
    zu durchbrechen.
  </li>
</ol>

<h2>Ein Wort zur Technik</h2>
<p>
  Eine "Liegestütze" in der Yang-et-al.-Studie bedeutete einen metronom-getakteten Rep mit vollem
  Bewegungsumfang. Ego-Reps zählen in der Forschung nicht, und sie sollten auch für dich nicht zählen.
  Brust auf Bodenhöhe oder wenige Zentimeter darüber. Körper gerade. Ellenbogen hinter die Schulter, nicht
  breit nach außen. Wenn 40 saubere Wiederholungen noch weit weg sind, ist das der ehrliche Startpunkt –
  und die Daten legen nahe, dass der Weg selbst die Intervention ist.
</p>

<h2>Das größere Bild</h2>
<p>
  Liegestützen sind keine Wundermittel. Sie sind ein ungewöhnlich effizienter Test: eine Minute Aufwand,
  kein Equipment, skalierbar von Knie-Variante bis einarmig. Die Harvard-Daten von 2019 haben lediglich
  Zahlen auf das gelegt, was Kraftcoaches seit Jahrzehnten sagen – wer den eigenen Körper wiederholt vom
  Boden drücken kann, ist in vielen anderen Dimensionen meist ebenfalls gesund.
</p>
    `.trim(),
  },
  {
    slug: 'wim-hof-liegestuetze',
    lang: 'de',
    translationSlug: 'wim-hof-pushups',
    title: 'Wim Hof Methode für Liegestützen: Atmung, Kälte & mehr Leistung',
    description:
      'Wie sinnvoll ist die Wim Hof Methode für deine Liegestütze? Ein forschungsbasierter Blick auf Atemprotokoll, Kälteanwendung und was die Studienlage wirklich hergibt.',
    publishedAt: '2026-04-23',
    keywords: [
      'Wim Hof Methode',
      'Liegestütze Leistung',
      'Atmung Leistungssteigerung',
      'Kälteanwendung Regeneration',
      'Wim Hof Atmung Liegestütze',
    ],
    heroImage:
      'https://images.unsplash.com/photo-1548690312-e3b507d8c110?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt:
      'Sportler in verschneiter Landschaft – Sinnbild für die Wim Hof Methode.',
    heroImageCredit:
      'Foto: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
    content: `
<h2>Warum Wim Hof plötzlich in Fitness-Studios auftaucht</h2>
<p>
  Der niederländische Extremsportler Wim Hof wurde mit scheinbar unmöglichen Leistungen bekannt: Everest
  in Shorts, Halbmarathon barfuß am Polarkreis, Atemanhalten über sechs Minuten. Was wie ein Zirkus-Trick
  klang, ist tatsächlich ein strukturiertes Protokoll aus hyperventilationsähnlicher Atmung, Kälteexposition
  und Konzentration – und in den letzten zehn Jahren gibt es genug peer-reviewte Studien, dass die Frage
  für Trainierende legitim ist: Werden meine Liegestütze dadurch besser?
</p>
<p>
  Die kurze Antwort: Die Wim Hof Methode (WHM) erhöht deine maximalen Wiederholungen nicht direkt. Aber sie
  verändert zwei Dinge, die für das Liegestütz-Training zählen – den Zustand des Nervensystems, in dem du
  trainierst, und das Tempo deiner Regeneration zwischen den Einheiten.
</p>

<h2>Was die Studienlage hergibt</h2>
<p>
  Die Leitstudie stammt von
  <a href="https://pubmed.ncbi.nlm.nih.gov/24799686/" target="_blank" rel="noopener noreferrer nofollow ugc">Kox et al., 2014 (PNAS)</a>.
  Ein Team der Radboud-Universität trainierte Probanden zehn Tage nach WHM und injizierte ihnen danach
  bakterielles Endotoxin. Die trainierten Teilnehmer zeigten deutlich niedrigere entzündliche Marker und
  weniger grippeähnliche Symptome als die Kontrollgruppe – der erste Nachweis am Menschen, dass freiwillige
  Atmung und Kälte die angeborene Immunantwort modulieren können.
</p>
<p>
  Ein
  <a href="https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0161749" target="_blank" rel="noopener noreferrer nofollow ugc">randomisierter PLOS ONE Trial (Buijze et al., 2016)</a>
  zeigte, dass 30 Tage heiß-kalte Duschen die selbstberichteten Krankheitstage um 29 % reduzierten. Eine
  <a href="https://pubmed.ncbi.nlm.nih.gov/27500826/" target="_blank" rel="noopener noreferrer nofollow ugc">Übersichtsarbeit zur Kälteexposition 2016</a>
  dokumentiert die hormonellen und kardiovaskulären Reaktionen im Detail.
</p>
<p>
  Was die Evidenz <em>nicht</em> zeigt: einen direkten, groß angelegten Effekt auf Maximalkraft oder
  Hypertrophie. Betrachte WHM also als <strong>Regenerations- und Nervensystem-Tool</strong>, nicht als
  Kraft-Booster.
</p>

<h2>Das Atemprotokoll kurz und sauber</h2>
<p>
  Die offizielle Anleitung steht auf
  <a href="https://www.wimhofmethod.com/practice-the-method" target="_blank" rel="noopener noreferrer nofollow ugc">wimhofmethod.com</a>.
  Eine Runde sieht so aus:
</p>
<ol>
  <li><strong>30–40 tiefe Atemzüge</strong> durch Nase oder Mund ein, entspannt ausatmen. Die Ausatmung
    wird nicht erzwungen. Effektiv eine kontrollierte Hyperventilation.</li>
  <li><strong>Retention nach Ausatmung</strong> – nach der letzten Ausatmung halten, bis der Atemdrang
    zurückkommt. Mit Übung oft 60–120 Sekunden.</li>
  <li><strong>Recovery-Atem</strong> – ein voller Einatemzug, 15 Sekunden halten, loslassen.</li>
  <li>3–4 Runden.</li>
</ol>
<p>
  Andrew Huberman erklärt den Mechanismus ausführlich im
  <a href="https://www.hubermanlab.com/episode/how-to-breathe-correctly-for-optimal-health-mood-learning-and-performance" target="_blank" rel="noopener noreferrer nofollow ugc">Huberman Lab Podcast zur Atmung</a>:
  Das Protokoll senkt den Blut-CO₂-Spiegel, hebt kurzfristig Adrenalin und löst anschließend einen
  parasympathischen Rebound aus. Genau dieser Rebound ist die für Regeneration relevante Phase.
</p>

<h2>Ein ernstes Sicherheits-Wort vorab</h2>
<p>
  Hyperventilation in Kombination mit Atemanhalten kann zu einer Ohnmacht führen (Flachwasser-Blackout).
  Die <strong>absolute Regel der Wim Hof Organisation selbst</strong>: niemals während des Autofahrens,
  im Pool, in der Badewanne oder an Orten praktizieren, an denen eine Ohnmacht gefährlich wäre. Schwangere,
  Personen mit Herz-Kreislauf-Erkrankungen, Epilepsie oder Panikstörungen sollten das Protokoll auslassen
  oder erst mit einem Arzt sprechen.
</p>

<h2>Wie du es mit Liegestütz-Training kombinierst</h2>
<p>
  Drei konkrete Varianten, von niedrigstem zu höchstem Risiko:
</p>
<ol>
  <li>
    <strong>Atmung als Primer vor dem Satz (sicherste Variante).</strong>
    Am Boden 2 Runden WHM-Atmung, dann aufhören – keine Liegestütze während des Atemhaltens. Den ersten
    Satz Liegestütze starten, sobald die Atmung normalisiert ist (~60 s). Viele berichten von einem
    fokussierteren, ruhigeren Startsatz. Kein zusätzliches Risiko über die Atmung hinaus.
  </li>
  <li>
    <strong>Kalte Dusche als Finisher.</strong>
    Nach dem Training 60–120 s kalte Dusche auf Brust, Schultern und Oberarme. Der PLOS-ONE-Trial von 2016
    legt nahe, dass das für die Immun- und Stimmungseffekte ausreicht. Keine Alternative zu Schlaf und
    Protein – sondern zusätzlich.
  </li>
  <li>
    <strong>"Breath-Hold Push-Ups" (fortgeschritten, optional).</strong>
    Auf der letzten Ausatmung einer WHM-Runde Liegestütze in der Retentionsphase ausführen. Die klassische
    "Wim Hof Liegestütze". Das sind <em>keine</em> zusätzlichen Reps – der Atemstopp maskiert lediglich den
    Luftmangel. Nur auf einer Matte, nie an harten Kanten oder in Wassernähe, nie allein.
  </li>
</ol>

<h2>Was du nach 30 Tagen erwarten kannst</h2>
<p>
  Trainierende berichten typischerweise: bessere Toleranz gegenüber dem "Brennen" in höheren
  Wiederholungsbereichen, schnellere mentale Erholung nach harten Einheiten und deutlich weniger
  Muskelkater 24 Stunden später. Die reinen Kraftzahlen steigen nicht plötzlich – die Kontinuität steigt.
  Wenn du ohnehin <a href="/de/blog/liegestuetze-tracker">einen Liegestütz-Tracker nutzt</a>, trage die
  Atem- und Kältesitzungen neben den Wiederholungen ein. Ein Monat Daten sagt dir mehr als jede Anekdote.
</p>

<h2>Fazit</h2>
<p>
  Die Wim Hof Methode hat messbare Effekte auf Entzündungswerte und vegetative Balance. Sie ersetzt keine
  progressive Belastungssteigerung, keinen Schlaf und kein Protein – aber als Regenerationsschicht um das
  Liegestütz-Training herum ist die Evidenz gut genug für einen Versuch, solange du die Atemhalt-Regeln
  respektierst.
</p>
    `.trim(),
  },
  {
    slug: 'pushups-heart-study',
    lang: 'en',
    translationSlug: 'liegestuetze-herz-studie',
    title:
      'The Harvard Study That Made Push-Ups Famous: 40+ Reps and Heart Health',
    description:
      'A 2019 JAMA study put push-up capacity on the cardiovascular-risk map. Here is what the data actually said, what it did not, and how to use it for your own training.',
    publishedAt: '2026-04-23',
    keywords: [
      'push-ups heart health',
      'push-up capacity cardiovascular',
      'Harvard push-up study',
      'JAMA push-ups',
      'fitness heart disease',
    ],
    heroImage:
      'https://images.unsplash.com/photo-1514512364185-4c2b0985be01?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt:
      'Athlete in a plank position on asphalt — the push-up capacity test.',
    heroImageCredit:
      'Photo: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
    content: `
<h2>Why one push-up study went viral</h2>
<p>
  In February 2019, a research team at the Harvard T.H. Chan School of Public Health published a decade of
  data on 1,104 active adult men — all firefighters in Indiana — and asked a very simple question: does
  push-up capacity predict future heart disease?
</p>
<p>
  The result, published in
  <a href="https://pubmed.ncbi.nlm.nih.gov/30821806/" target="_blank" rel="noopener noreferrer nofollow ugc">JAMA Network Open (Yang et al., 2019)</a>,
  landed on the front page of fitness blogs for a reason. Men who could complete <strong>more than 40
  push-ups</strong> in a single set had a <strong>96% lower risk</strong> of cardiovascular events over
  the following ten years compared with men who could not complete 10. The Harvard press release
  summarizes it in plain English:
  <a href="https://www.hsph.harvard.edu/news/press-releases/push-ups-correlated-with-reduced-cardiovascular-disease-risk-study/" target="_blank" rel="noopener noreferrer nofollow ugc">
    "Push-ups correlated with reduced cardiovascular disease risk"
  </a>.
</p>

<h2>What the study actually measured</h2>
<p>
  It's worth reading past the headline. Key design points:
</p>
<ul>
  <li><strong>Sample:</strong> 1,104 adult men, median age 39.6, all occupationally active (firefighters).
    All-male, single-profession sample.</li>
  <li><strong>Test:</strong> A metronome-paced push-up capacity test at baseline (2000), with cardiovascular
    events tracked through 2010.</li>
  <li><strong>Outcomes:</strong> 37 CVD events in ten years — heart attacks, CAD-related deaths,
    coronary procedures.</li>
  <li><strong>Comparison:</strong> Treadmill-measured aerobic capacity was <em>also</em> associated with
    lower CVD risk — but the push-up signal was stronger than the aerobic signal in this cohort.</li>
</ul>
<p>
  The authors were careful in the discussion: push-up capacity is a proxy for overall functional fitness,
  not an independent cause of better heart health. It is <em>a simple, free, no-equipment field test</em>
  that correlates tightly with the things that matter: muscle mass, aerobic reserve, and movement quality.
</p>

<h2>Limits the news cycle skipped</h2>
<p>
  A few things the study <strong>does not</strong> prove:
</p>
<ul>
  <li>It does not show that <em>doing</em> more push-ups <em>causes</em> a lower heart-disease risk.
    Causation would need a randomized intervention trial, which this was not.</li>
  <li>It does not apply directly to women, to sedentary populations, or to older adults — those groups
    were simply not in the sample.</li>
  <li>It does not mean push-ups replace aerobic exercise. The
    <a href="https://www.who.int/news-room/fact-sheets/detail/physical-activity" target="_blank" rel="noopener noreferrer nofollow ugc">
      WHO Physical Activity Guidelines</a>
    still recommend 150–300 min of moderate aerobic activity per week
    <strong>in addition to</strong> muscle-strengthening twice a week.</li>
</ul>

<h2>How the AHA and ACSM frame it</h2>
<p>
  The
  <a href="https://www.heart.org/en/healthy-living/fitness/fitness-basics/aha-recs-for-physical-activity-in-adults" target="_blank" rel="noopener noreferrer nofollow ugc">American Heart Association activity recommendations</a>
  already put muscle-strengthening at the center of cardiovascular prevention — alongside aerobic work.
  Bodyweight exercises like push-ups count, and they are the lowest-friction way to hit the "two strength
  sessions per week" target the AHA publishes.
</p>

<h2>How to use this without over-reading it</h2>
<p>
  The useful takeaway isn't "40 push-ups = good heart." It's that a simple field test correlates with the
  combination of traits you actually want. Two practical uses:
</p>
<ol>
  <li>
    <strong>Use it as a benchmark, not a goal.</strong> Once a month, do a single max-effort set to full
    fatigue. Log the number. You are tracking a proxy for your whole-body fitness trend, not a
    performance target.
  </li>
  <li>
    <strong>Work backwards into structured training.</strong> If your baseline is under 10, the
    <a href="/en/blog/pushup-progression">progression guide</a> gets you from there to a respectable capacity
    over 6 weeks. From 20 to 40+, the <a href="/en/blog/30-day-pushup-challenge">30-day challenge</a> is
    designed to push past that plateau.
  </li>
</ol>

<h2>A word on technique</h2>
<p>
  A "push-up" in the Yang et al. study meant a metronome-paced, full-range rep. Ego reps don't count in
  research and shouldn't count for you either. Chest to the floor or within an inch. Body straight.
  Elbows tracking behind the shoulders, not flared. If 40 perfect reps feel out of reach, that's the
  honest place to start — and the data suggest the journey itself is the intervention.
</p>

<h2>The bigger picture</h2>
<p>
  Push-ups are not magic. What they are is an unusually efficient test: one minute of effort,
  no equipment, scalable from a knee variant to a one-arm variant. The 2019 Harvard data simply
  put numbers on what strength coaches have said for decades — the people who can push their own body
  off the floor, repeatedly, tend to be healthy in a lot of other ways too.
</p>
    `.trim(),
  },
  {
    slug: 'wim-hof-pushups',
    lang: 'en',
    translationSlug: 'wim-hof-liegestuetze',
    title:
      'The Wim Hof Method for Push-Ups: Breathing, Cold Exposure & Performance',
    description:
      'Can the Wim Hof Method really boost push-up performance and recovery? A research-based look at the breathing protocol, cold exposure, and what the evidence actually shows.',
    publishedAt: '2026-04-23',
    keywords: [
      'Wim Hof Method',
      'push-ups performance',
      'breathing for performance',
      'cold exposure recovery',
      'Wim Hof breathing push-ups',
    ],
    heroImage:
      'https://images.unsplash.com/photo-1548690312-e3b507d8c110?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt:
      'Athlete standing in a frozen landscape — Wim Hof Method imagery of breath and cold.',
    heroImageCredit:
      'Photo: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
    content: `
<h2>Why Wim Hof turned up in gyms</h2>
<p>
  Dutch extreme athlete Wim Hof became famous for feats that looked impossible: climbing Everest in shorts,
  running a half-marathon barefoot above the Arctic Circle, holding his breath for more than six minutes.
  What looked like a circus act is actually a structured protocol of hyperventilation-style breathing, cold
  exposure, and concentration — and in the last decade it has drawn enough peer-reviewed attention that
  fitness readers can reasonably ask: does it make my push-ups better?
</p>
<p>
  The short answer: the Wim Hof Method (WHM) does not lift your max reps on its own. But used thoughtfully,
  it changes two things that matter for push-up training — the nervous-system state you train in, and the
  speed at which you recover between sessions.
</p>

<h2>What the research actually shows</h2>
<p>
  The headline study is
  <a href="https://pubmed.ncbi.nlm.nih.gov/24799686/" target="_blank" rel="noopener noreferrer nofollow ugc">Kox et al., 2014 (PNAS)</a>.
  Researchers at Radboud University trained healthy volunteers in the WHM for ten days, then injected them
  with bacterial endotoxin. Trained subjects showed significantly lower pro-inflammatory markers and fewer
  flu-like symptoms than untrained controls — the first demonstration in humans that voluntary breathing
  and cold training can modulate the innate immune response.
</p>
<p>
  A 2016 PLOS ONE
  <a href="https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0161749" target="_blank" rel="noopener noreferrer nofollow ugc">randomized trial (Buijze et al.)</a>
  found that 30-day hot-to-cold showers reduced self-reported sick-days by 29%. A
  <a href="https://pubmed.ncbi.nlm.nih.gov/27500826/" target="_blank" rel="noopener noreferrer nofollow ugc">2016 cold-exposure review</a>
  catalogs the hormonal and cardiovascular responses in more detail.
</p>
<p>
  What the evidence does <em>not</em> yet show: a direct, large-trial effect on maximal strength or
  hypertrophy. Treat WHM as a <strong>recovery and nervous-system tool</strong>, not a strength supplement.
</p>

<h2>The breathing protocol, stripped down</h2>
<p>
  The official description lives on
  <a href="https://www.wimhofmethod.com/practice-the-method" target="_blank" rel="noopener noreferrer nofollow ugc">wimhofmethod.com</a>.
  A single round looks like this:
</p>
<ol>
  <li><strong>30–40 deep breaths</strong> in through the nose or mouth, out with a relaxed exhale. Do not
    force the exhale. This is essentially controlled hyperventilation.</li>
  <li><strong>Retention on exhale</strong> — after the final exhale, hold until the urge to breathe returns.
    Typically 60–120 s once you're used to it.</li>
  <li><strong>Recovery breath</strong> — a full inhale, hold 15 s, release.</li>
  <li>Repeat 3–4 rounds.</li>
</ol>
<p>
  Andrew Huberman's
  <a href="https://www.hubermanlab.com/episode/how-to-breathe-correctly-for-optimal-health-mood-learning-and-performance" target="_blank" rel="noopener noreferrer nofollow ugc">Huberman Lab episode on breathing</a>
  covers the mechanism well: the protocol drops blood CO₂, temporarily raises adrenaline, and then drives a
  sharp parasympathetic rebound. That rebound is the part that matters for recovery.
</p>

<h2>A safety note before you try this</h2>
<p>
  Hyperventilation plus breath-hold can cause shallow-water blackout. The
  <strong>absolute rule from the Wim Hof organization itself</strong>: never practice the breathing while
  driving, in a pool, in a bathtub, or anywhere a fainting spell would be dangerous. Pregnant people,
  people with cardiovascular disease, and people with a history of seizures or panic disorder should skip
  the protocol or consult a physician first.
</p>

<h2>How to combine it with push-up training</h2>
<p>
  Three concrete protocols, from lowest to highest risk:
</p>
<ol>
  <li>
    <strong>Breath-work as a pre-set primer (safest).</strong>
    On the floor, do 2 rounds of WHM breathing, then stop — no breath-hold push-ups.
    Start your first set of push-ups once breathing has normalized (~60 s). Most people report a calmer,
    more focused start set. No extra danger beyond the breathing itself.
  </li>
  <li>
    <strong>Cold finisher for recovery.</strong>
    After training, a 60–120 s cold shower targeting chest, shoulders, and upper arms. The 2016 PLOS ONE
    trial suggests this is enough to trigger the immune and mood effects. Not instead of sleep and protein —
    in addition to them.
  </li>
  <li>
    <strong>"Breath-hold push-up" set (advanced, optional).</strong>
    On the final exhale of a WHM round, perform push-ups during the retention phase. This is the classic
    "Wim Hof push-up" challenge. It is <em>not</em> a way to train more reps — the breath-hold just masks
    air hunger. Only do it on a mat, never near hard edges or water, and never when alone.
  </li>
</ol>

<h2>What to expect after 30 days</h2>
<p>
  Practitioners typically report: better tolerance of the "burn" in higher-rep sets, faster mood recovery
  after a hard session, and noticeably less soreness 24 h later. Strength numbers don't jump; consistency
  does. If you already use
  <a href="/en/blog/pushup-tracker-guide">a push-up tracker</a>,
  log the breathing + cold rounds alongside your reps — a month of data will tell you more than any
  anecdote.
</p>

<h2>Bottom line</h2>
<p>
  The Wim Hof Method has real, measurable effects on inflammation and autonomic tone.
  It is not a replacement for progressive overload, sleep, or protein — but as a recovery layer around
  push-up training, the evidence is good enough to try, provided you respect the breath-hold rules.
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
    heroImage:
      'https://images.unsplash.com/photo-1638820858482-800bd51f63f1?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt:
      'Sportlerin bei einer sauberen Liegestütze im Grünen – Training ab 40.',
    heroImageCredit:
      'Foto: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
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

<aside class="plan-cta">
  <h3>4-Wochen-Plan ab 40 — schonend & strukturiert</h3>
  <p>
    Speziell für den Einstieg ab 40: vier Wochen mit Fokus auf saubere Technik,
    ausreichend Pause und langsames Tempo. Dein Tagesziel passt sich automatisch
    an den Plan an, sobald du startest.
  </p>
  <p>
    <a href="/training-plans/over-40-4w">Plan ab 40 ansehen &rarr;</a>
  </p>
</aside>
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
    heroImage:
      'https://images.unsplash.com/photo-1638820858482-800bd51f63f1?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt: 'Athlete doing a clean push-up outdoors — training after 40.',
    heroImageCredit:
      'Photo: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
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

<aside class="plan-cta">
  <h3>4-week plan after 40 — gentle &amp; structured</h3>
  <p>
    Designed for getting back into push-ups after 40: four weeks focused on
    clean technique, full recovery, and controlled tempo. Your daily target
    automatically adapts to the plan once you start it.
  </p>
  <p>
    <a href="/training-plans/over-40-4w">View the over-40 plan &rarr;</a>
  </p>
</aside>
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
    heroImage:
      'https://images.unsplash.com/photo-1596079306903-9164c205f400?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt:
      'Sportler bei einer Outdoor-Liegestütze – tägliche Challenge im Grünen.',
    heroImageCredit:
      'Foto: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
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

<aside class="plan-cta">
  <h3>Challenge im Tracker starten</h3>
  <p>
    Die 30-Tage-Challenge gibt es als geführten Trainingsplan: Tag 1 ist der
    Maximaltest, jeder Tag hat ein Tagesziel und passende Sätze. Pushup Tracker
    markiert deinen Fortschritt automatisch – du musst nur trainieren.
  </p>
  <p>
    <a href="/training-plans/challenge-30d">30-Tage-Plan starten &rarr;</a>
  </p>
</aside>
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
    heroImage:
      'https://images.unsplash.com/photo-1596079306903-9164c205f400?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt:
      'Athlete doing an outdoor push-up — the daily challenge in the grass.',
    heroImageCredit:
      'Photo: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
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

<aside class="plan-cta">
  <h3>Start the challenge in the tracker</h3>
  <p>
    The 30-day challenge is available as a guided training plan: Day 1 is the
    baseline test, every day has a daily target and matching sets. Pushup Tracker
    marks your progress automatically — you just have to train.
  </p>
  <p>
    <a href="/training-plans/challenge-30d">Start the 30-day plan &rarr;</a>
  </p>
</aside>
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
    heroImage:
      'https://images.unsplash.com/photo-1731341400836-baaa5535b8d5?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt: 'Sportler bei einer Liegestütz-Variante im Trainingsraum.',
    heroImageCredit:
      'Foto: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
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
    heroImage:
      'https://images.unsplash.com/photo-1731341400836-baaa5535b8d5?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt: 'Athlete performing a push-up variation in a training space.',
    heroImageCredit:
      'Photo: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
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
    heroImage:
      'https://images.unsplash.com/photo-1717821681365-36b0da044a75?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt:
      'Sportlerin bei einer sauberen Liegestütze auf Holzboden – Fortschritt im Blick.',
    heroImageCredit:
      'Foto: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
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
    heroImage:
      'https://images.unsplash.com/photo-1717821681365-36b0da044a75?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt:
      'Athlete doing a clean push-up on a wooden floor — progress in focus.',
    heroImageCredit:
      'Photo: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
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
    heroImage:
      'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt:
      'Sportlerin bei einer Liegestütze – tägliches Training im Freien.',
    heroImageCredit:
      'Foto: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
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
    heroImage:
      'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt:
      'Female athlete doing a push-up — a daily training routine outdoors.',
    heroImageCredit:
      'Photo: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
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
    heroImage:
      'https://images.unsplash.com/photo-1598971457999-ca4ef48a9a71?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt: 'Sportler in roter Tanktop bei einer sauberen Liegestütze.',
    heroImageCredit:
      'Foto: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
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

<aside class="plan-cta">
  <h3>Direkt loslegen: 6-Wochen-Plan im Tracker</h3>
  <p>
    Diesen 6-Wochen-Aufbau gibt es als geführten Trainingsplan in Pushup Tracker.
    Du bekommst dein Tagesziel, die genauen Sätze pro Tag und automatische
    Fortschrittsverfolgung. Vorbei mit Excel-Listen.
  </p>
  <p>
    <a href="/training-plans/recruit-6w">Plan ansehen &rarr;</a>
  </p>
</aside>
    `.trim(),
  },
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
    heroImage:
      'https://images.unsplash.com/photo-1598971457999-ca4ef48a9a71?auto=format&fit=crop&w=1600&q=80',
    heroImageAlt: 'Athlete in a red tank top performing a clean push-up.',
    heroImageCredit:
      'Photo: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>',
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

<aside class="plan-cta">
  <h3>Start the 6-week plan in the tracker</h3>
  <p>
    This 6-week build-up is available as a guided training plan in Pushup Tracker.
    You get a daily target, the exact sets per day, and automatic progress tracking.
    No more spreadsheets.
  </p>
  <p>
    <a href="/training-plans/recruit-6w">View the plan &rarr;</a>
  </p>
</aside>
    `.trim(),
  },
];
