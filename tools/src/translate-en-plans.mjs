#!/usr/bin/env node
/**
 * One-shot translator for the new training-plan XLIFF units added in
 * the diverse-plans feature. Writes English translations into
 * `messages.en.xlf` for every plan day description so English users
 * don't see German text. Idempotent — running it again replaces the
 * same units with the same translations.
 *
 * For the other locales we keep the `<source>` fallback that
 * `sync-xliff-locales.mjs` seeded — those are out of scope here.
 */
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EN_PATH = join(
  __dirname,
  '..',
  '..',
  'web',
  'src',
  'locale',
  'messages.en.xlf'
);

// id → [germanSource, englishTarget]. Sources match `messages.xlf`
// exactly (XML-escaped where applicable).
/** @type {Record<string, [string, string]>} */
const TRANSLATIONS = {
  // ── Push & Pull Balance ─────────────────────────────────────────
  'plan.push-pull-6w.title': [
    'Push &amp; Pull Balance — 6-Wochen-Plan',
    'Push &amp; Pull Balance — 6-week plan',
  ],
  'plan.push-pull-6w.summary': [
    'Symmetrischer 6-Wochen-Plan für Liegestütze und Rückenübungen (Rudern, Klimmzug-Negative, Face Pulls). Vermeidet das klassische &quot;nur Push&quot;-Ungleichgewicht und stärkt die hintere Kette gleichwertig. Pull-Tag pro Woche zusätzlich zur Push-Progression.',
    'Symmetric 6-week plan for push-ups and pulling work (rows, pull-up negatives, face pulls). Avoids the classic &quot;push only&quot; imbalance and strengthens the posterior chain equally. One dedicated pull day per week on top of the push progression.',
  ],
  'plan.push-pull-6w.day.1.desc': [
    'Push 3×10 saubere Liegestütze · Pull 3×8 invertierte Rudern, 90 s Pause',
    'Push 3×10 clean push-ups · Pull 3×8 inverted rows, 90 s rest',
  ],
  'plan.push-pull-6w.day.2.desc': [
    'Pull-Tag: 4×8 Australian Rows · Push 2×12 Knie-Liegestütze als Aktivierung',
    'Pull day: 4×8 Australian rows · Push 2×12 knee push-ups as activation',
  ],
  'plan.push-pull-6w.day.4.desc': [
    'Push 3×11 · Pull 3×6 Klimmzug-Negative (5 s Exzentrik)',
    'Push 3×11 · Pull 3×6 pull-up negatives (5 s eccentric)',
  ],
  'plan.push-pull-6w.day.5.desc': [
    'Leichter Tag 2×10 · 3×12 Face Pulls',
    'Light day 2×10 · 3×12 face pulls',
  ],
  'plan.push-pull-6w.day.6.desc': [
    'Push 3×12 · Pull 3×8 invertierte Rudern · Plank 3×30 s',
    'Push 3×12 · Pull 3×8 inverted rows · Plank 3×30 s',
  ],
  'plan.push-pull-6w.day.8.desc': [
    'Push 3×AMRAP (Ziel 13-12-11) · Pull 3×9 Rudern',
    'Push 3×AMRAP (target 13-12-11) · Pull 3×9 rows',
  ],
  'plan.push-pull-6w.day.9.desc': [
    'Pull-Tag: 4×9 Australian Rows · Push 3×9 saubere LS',
    'Pull day: 4×9 Australian rows · Push 3×9 clean push-ups',
  ],
  'plan.push-pull-6w.day.11.desc': [
    'Push 3×AMRAP (Ziel 14-13-12) · Pull 3×7 Klimmzug-Negative',
    'Push 3×AMRAP (target 14-13-12) · Pull 3×7 pull-up negatives',
  ],
  'plan.push-pull-6w.day.12.desc': [
    'Leichter Tag 2×11 · 3×12 Face Pulls · Schulter-Mobility',
    'Light day 2×11 · 3×12 face pulls · shoulder mobility',
  ],
  'plan.push-pull-6w.day.13.desc': [
    'Push 3×AMRAP · Pull 3×10 invertierte Rudern · Plank 3×40 s',
    'Push 3×AMRAP · Pull 3×10 inverted rows · Plank 3×40 s',
  ],
  'plan.push-pull-6w.day.15.desc': [
    'Push 4 Sätze · Pull 4×6 Klimmzüge (oder Negative)',
    'Push 4 sets · Pull 4×6 pull-ups (or negatives)',
  ],
  'plan.push-pull-6w.day.16.desc': [
    'Pull-Tag: 5×8 Australian Rows · Push 3×10 saubere LS',
    'Pull day: 5×8 Australian rows · Push 3×10 clean push-ups',
  ],
  'plan.push-pull-6w.day.18.desc': [
    'Push 4×AMRAP · Pull 4×7 Klimmzüge · Plank 3×45 s',
    'Push 4×AMRAP · Pull 4×7 pull-ups · Plank 3×45 s',
  ],
  'plan.push-pull-6w.day.19.desc': [
    'Leichter Tag 2×12 · 3×15 Face Pulls',
    'Light day 2×12 · 3×15 face pulls',
  ],
  'plan.push-pull-6w.day.20.desc': [
    'Push 4×AMRAP · Pull 4×8 Klimmzüge · Hollow Hold 3×20 s',
    'Push 4×AMRAP · Pull 4×8 pull-ups · Hollow hold 3×20 s',
  ],
  'plan.push-pull-6w.day.22.desc': [
    'Push 4 Sätze, 60 s Pause · Pull 4×8 Klimmzüge',
    'Push 4 sets, 60 s rest · Pull 4×8 pull-ups',
  ],
  'plan.push-pull-6w.day.23.desc': [
    'Pull-Tag: 5×9 Australian Rows · Push 3×11 LS',
    'Pull day: 5×9 Australian rows · Push 3×11 push-ups',
  ],
  'plan.push-pull-6w.day.25.desc': [
    'Push 4×AMRAP · Pull 4×9 Klimmzüge · Plank 3×50 s',
    'Push 4×AMRAP · Pull 4×9 pull-ups · Plank 3×50 s',
  ],
  'plan.push-pull-6w.day.26.desc': [
    'Leichter Tag 2×13 · Brust- und Rücken-Mobility',
    'Light day 2×13 · chest and back mobility',
  ],
  'plan.push-pull-6w.day.27.desc': [
    'Push 4×AMRAP · Pull 4×10 Klimmzüge · Hollow Hold 3×30 s',
    'Push 4×AMRAP · Pull 4×10 pull-ups · Hollow hold 3×30 s',
  ],
  'plan.push-pull-6w.day.29.desc': [
    'Push 5 Sätze · Pull 5×7 Klimmzüge, 90 s Pause',
    'Push 5 sets · Pull 5×7 pull-ups, 90 s rest',
  ],
  'plan.push-pull-6w.day.30.desc': [
    'Pull-Tag: 5×10 Australian Rows · Push 3×12 LS',
    'Pull day: 5×10 Australian rows · Push 3×12 push-ups',
  ],
  'plan.push-pull-6w.day.32.desc': [
    'Push 5 Sätze · Pull 5×8 Klimmzüge · Plank 3×60 s',
    'Push 5 sets · Pull 5×8 pull-ups · Plank 3×60 s',
  ],
  'plan.push-pull-6w.day.33.desc': [
    'Leichter Tag 2×14 · 4×12 Face Pulls',
    'Light day 2×14 · 4×12 face pulls',
  ],
  'plan.push-pull-6w.day.34.desc': [
    'Push 5 Sätze · Pull 5×9 Klimmzüge · Hollow Hold 3×40 s',
    'Push 5 sets · Pull 5×9 pull-ups · Hollow hold 3×40 s',
  ],
  'plan.push-pull-6w.day.36.desc': [
    'Push 5 Sätze schwer · Pull 5×10 Klimmzüge',
    'Push 5 heavy sets · Pull 5×10 pull-ups',
  ],
  'plan.push-pull-6w.day.37.desc': [
    'Pull-Schwerpunkt: 5×AMRAP Klimmzüge · Push 4×10 LS',
    'Pull focus: 5×AMRAP pull-ups · Push 4×10 push-ups',
  ],
  'plan.push-pull-6w.day.39.desc': [
    'Taper-Tag: 4×15 saubere LS · 3×6 Klimmzüge',
    'Taper day: 4×15 clean push-ups · 3×6 pull-ups',
  ],
  'plan.push-pull-6w.day.40.desc': [
    'Leichter Tag 2×10 · Mobility',
    'Light day 2×10 · mobility',
  ],
  'plan.push-pull-6w.day.42.desc': [
    'Endtest: maximale Liegestütze + maximale Klimmzüge in einem Satz',
    'Final test: max push-ups + max pull-ups in a single set',
  ],
  // ── Full Body Strong ────────────────────────────────────────────
  'plan.full-body-6w.title': [
    'Full Body Strong — 6-Wochen-Ganzkörperplan',
    'Full Body Strong — 6-week full-body plan',
  ],
  'plan.full-body-6w.summary': [
    'Sechs Wochen Ganzkörper-Zirkel: Liegestütze, Kniebeugen, Ausfallschritte, Glute Bridges und Plank in 3-, 4- und 5-Runden-Zirkeln. Drei Trainingstage pro Woche, klar steigende Volumen, funktioneller Endtest in Woche 6.',
    'Six weeks of full-body circuits: push-ups, squats, lunges, glute bridges, and planks in 3-, 4-, and 5-round circuits. Three training days per week, clearly increasing volume, functional final test in week 6.',
  ],
  'plan.full-body-6w.day.1.desc': [
    'Baseline-Test: maximale Liegestütze · 1 min Wall-Sit · 1 min Plank',
    'Baseline test: max push-ups · 1 min wall-sit · 1 min plank',
  ],
  'plan.full-body-6w.day.2.desc': [
    'Zirkel 3 Runden — 10 LS · 15 Kniebeugen · 10 Ausfallschritte je Bein · 30 s Plank',
    'Circuit, 3 rounds — 10 push-ups · 15 squats · 10 lunges per leg · 30 s plank',
  ],
  'plan.full-body-6w.day.4.desc': [
    'Zirkel 3 Runden — 10 LS · 15 Sumo-Kniebeugen · 12 Glute Bridges · 40 s Plank',
    'Circuit, 3 rounds — 10 push-ups · 15 sumo squats · 12 glute bridges · 40 s plank',
  ],
  'plan.full-body-6w.day.5.desc': [
    'Leichter Tag — 2×10 LS · Mobility 10 min',
    'Light day — 2×10 push-ups · mobility 10 min',
  ],
  'plan.full-body-6w.day.6.desc': [
    'Zirkel 3 Runden — 10 LS · 15 Kniebeugen · 10 Glute Bridges · 30 s Hollow Hold',
    'Circuit, 3 rounds — 10 push-ups · 15 squats · 10 glute bridges · 30 s hollow hold',
  ],
  'plan.full-body-6w.day.8.desc': [
    'Zirkel 3 Runden — 12 LS · 18 Kniebeugen · 12 Ausfallschritte je Bein · 40 s Plank',
    'Circuit, 3 rounds — 12 push-ups · 18 squats · 12 lunges per leg · 40 s plank',
  ],
  'plan.full-body-6w.day.10.desc': [
    'Zirkel 3 Runden — 12 LS · 18 Sumo-Kniebeugen · 15 Glute Bridges · 45 s Plank',
    'Circuit, 3 rounds — 12 push-ups · 18 sumo squats · 15 glute bridges · 45 s plank',
  ],
  'plan.full-body-6w.day.11.desc': [
    'Leichter Tag — 2×11 LS · Hip Opener 10 min',
    'Light day — 2×11 push-ups · hip opener 10 min',
  ],
  'plan.full-body-6w.day.12.desc': [
    'Zirkel 3 Runden — 12 LS · 12 Step-Ups je Bein · 15 Russian Twists · 40 s Plank',
    'Circuit, 3 rounds — 12 push-ups · 12 step-ups per leg · 15 Russian twists · 40 s plank',
  ],
  'plan.full-body-6w.day.15.desc': [
    'Zirkel 4 Runden — 10 LS · 15 Kniebeugen · 12 Glute Bridges · 40 s Plank',
    'Circuit, 4 rounds — 10 push-ups · 15 squats · 12 glute bridges · 40 s plank',
  ],
  'plan.full-body-6w.day.17.desc': [
    'Zirkel 4 Runden — 11 LS · 16 Ausfallschritte je Bein · 15 Glute Bridges · 45 s Plank',
    'Circuit, 4 rounds — 11 push-ups · 16 lunges per leg · 15 glute bridges · 45 s plank',
  ],
  'plan.full-body-6w.day.18.desc': [
    'Leichter Tag — 2×12 LS · Yoga 20 min',
    'Light day — 2×12 push-ups · yoga 20 min',
  ],
  'plan.full-body-6w.day.19.desc': [
    'Zirkel 4 Runden — 12 LS · 15 Jump Squats · 12 Glute Bridges · 45 s Plank',
    'Circuit, 4 rounds — 12 push-ups · 15 jump squats · 12 glute bridges · 45 s plank',
  ],
  'plan.full-body-6w.day.22.desc': [
    'Zirkel 4 Runden — 13 LS · 18 Kniebeugen · 15 Glute Bridges · 50 s Plank',
    'Circuit, 4 rounds — 13 push-ups · 18 squats · 15 glute bridges · 50 s plank',
  ],
  'plan.full-body-6w.day.24.desc': [
    'Zirkel 4 Runden — 14 LS · 18 Ausfallschritte je Bein · 15 Hip Thrusts · 50 s Plank',
    'Circuit, 4 rounds — 14 push-ups · 18 lunges per leg · 15 hip thrusts · 50 s plank',
  ],
  'plan.full-body-6w.day.25.desc': [
    'Leichter Tag — 2×13 LS · Foam Rolling 15 min',
    'Light day — 2×13 push-ups · foam rolling 15 min',
  ],
  'plan.full-body-6w.day.26.desc': [
    'Zirkel 4 Runden — 15 LS · 18 Jump Squats · 15 Glute Bridges · 60 s Plank',
    'Circuit, 4 rounds — 15 push-ups · 18 jump squats · 15 glute bridges · 60 s plank',
  ],
  'plan.full-body-6w.day.29.desc': [
    'Zirkel 5 Runden — 12 LS · 15 Kniebeugen · 12 Glute Bridges · 45 s Plank',
    'Circuit, 5 rounds — 12 push-ups · 15 squats · 12 glute bridges · 45 s plank',
  ],
  'plan.full-body-6w.day.31.desc': [
    'Zirkel 5 Runden — 13 LS · 16 Ausfallschritte je Bein · 13 Glute Bridges · 50 s Plank',
    'Circuit, 5 rounds — 13 push-ups · 16 lunges per leg · 13 glute bridges · 50 s plank',
  ],
  'plan.full-body-6w.day.32.desc': [
    'Leichter Tag — 2×14 LS · Mobility 15 min',
    'Light day — 2×14 push-ups · mobility 15 min',
  ],
  'plan.full-body-6w.day.33.desc': [
    'Zirkel 5 Runden — 14 LS · 18 Jump Squats · 15 Hip Thrusts · 60 s Plank',
    'Circuit, 5 rounds — 14 push-ups · 18 jump squats · 15 hip thrusts · 60 s plank',
  ],
  'plan.full-body-6w.day.36.desc': [
    'Peak-Zirkel 5 Runden — 15 LS · 20 Kniebeugen · 15 Glute Bridges · 60 s Plank',
    'Peak circuit, 5 rounds — 15 push-ups · 20 squats · 15 glute bridges · 60 s plank',
  ],
  'plan.full-body-6w.day.38.desc': [
    'Taper-Zirkel 4 Runden, kontrolliertes Tempo — 15 LS · 15 KB · 12 GB · 45 s Plank',
    'Taper circuit, 4 rounds, controlled tempo — 15 push-ups · 15 squats · 12 glute bridges · 45 s plank',
  ],
  'plan.full-body-6w.day.39.desc': [
    'Leichter Tag — 2×12 LS · Mobility',
    'Light day — 2×12 push-ups · mobility',
  ],
  'plan.full-body-6w.day.42.desc': [
    'Funktionstest: maximale LS · 50 Kniebeugen auf Zeit · 1 min Plank-Halt',
    'Functional test: max push-ups · 50 squats for time · 1 min plank hold',
  ],
  // ── Core Foundations ────────────────────────────────────────────
  'plan.core-4w.title': [
    'Core Foundations — 4-Wochen-Rumpfplan',
    'Core Foundations — 4-week core plan',
  ],
  'plan.core-4w.summary': [
    'Vier Wochen Rumpfstabilität: Plank, Hollow Hold, Dead Bug, Beinheben und Rotation. Pro Trainingstag eine moderate Liegestütze-Aktivierung. Vier Trainingstage und ein leichter Tag pro Woche, Endtest mit Plank-Halt und Hollow Hold.',
    'Four weeks of core stability: plank, hollow hold, dead bug, leg raises, and rotational work. Each training day also includes a moderate push-up activation. Four training days plus one light day per week, final test with plank hold and hollow hold.',
  ],
  'plan.core-4w.day.1.desc': [
    'Baseline: maximale Plank-Zeit · 10 saubere LS · maximale Hollow-Hold-Zeit',
    'Baseline: max plank time · 10 clean push-ups · max hollow-hold time',
  ],
  'plan.core-4w.day.2.desc': [
    'Plank 3×30 s · Hollow Hold 3×20 s · Dead Bug 3×10 je Seite · LS 2×10',
    'Plank 3×30 s · Hollow hold 3×20 s · Dead bug 3×10 per side · Push-ups 2×10',
  ],
  'plan.core-4w.day.3.desc': [
    'Beinheben 3×10 · Russian Twist 3×15 · Plank 3×30 s · LS 2×12',
    'Leg raises 3×10 · Russian twist 3×15 · Plank 3×30 s · Push-ups 2×12',
  ],
  'plan.core-4w.day.5.desc': [
    'Mountain Climbers 3×30 s · Dead Bug 3×12 · Plank 3×35 s · LS 2×10',
    'Mountain climbers 3×30 s · Dead bug 3×12 · Plank 3×35 s · Push-ups 2×10',
  ],
  'plan.core-4w.day.6.desc': [
    'Leichter Tag — Cat-Cow 3×10 · Hip Opener 2 min · 2×7 saubere LS',
    'Light day — cat-cow 3×10 · hip opener 2 min · 2×7 clean push-ups',
  ],
  'plan.core-4w.day.8.desc': [
    'Plank 3×40 s · Hollow Hold 3×25 s · Dead Bug 3×12 · LS 2×11',
    'Plank 3×40 s · Hollow hold 3×25 s · Dead bug 3×12 · Push-ups 2×11',
  ],
  'plan.core-4w.day.9.desc': [
    'Beinheben 3×12 · Russian Twist 3×18 · Plank 3×40 s · LS 2×12',
    'Leg raises 3×12 · Russian twist 3×18 · Plank 3×40 s · Push-ups 2×12',
  ],
  'plan.core-4w.day.11.desc': [
    'Mountain Climbers 4×30 s · Side Plank 2×25 s je Seite · LS 2×12',
    'Mountain climbers 4×30 s · Side plank 2×25 s per side · Push-ups 2×12',
  ],
  'plan.core-4w.day.12.desc': [
    'Leichter Tag — Mobility 10 min · 2×8 LS',
    'Light day — mobility 10 min · 2×8 push-ups',
  ],
  'plan.core-4w.day.13.desc': [
    'Core-Zirkel 3 Runden — 40 s Plank · 20 s Hollow Hold · 12 Dead Bugs · 10 LS',
    'Core circuit, 3 rounds — 40 s plank · 20 s hollow hold · 12 dead bugs · 10 push-ups',
  ],
  'plan.core-4w.day.15.desc': [
    'Plank 3×50 s · Side Plank 3×30 s je Seite · Hollow Hold 3×30 s · LS 2×15',
    'Plank 3×50 s · Side plank 3×30 s per side · Hollow hold 3×30 s · Push-ups 2×15',
  ],
  'plan.core-4w.day.16.desc': [
    'Hängendes Knieheben 3×8 · Russian Twist 3×20 · Plank 3×50 s · LS 2×15',
    'Hanging knee raises 3×8 · Russian twist 3×20 · Plank 3×50 s · Push-ups 2×15',
  ],
  'plan.core-4w.day.18.desc': [
    'Core-Power: Plank 3×60 s · Dead Bug 3×15 · Mountain Climbers 3×45 s · LS 2×15',
    'Core power: Plank 3×60 s · Dead bug 3×15 · Mountain climbers 3×45 s · Push-ups 2×15',
  ],
  'plan.core-4w.day.19.desc': [
    'Leichter Tag — 2×9 LS · Stretching 10 min',
    'Light day — 2×9 push-ups · stretching 10 min',
  ],
  'plan.core-4w.day.20.desc': [
    'Core-Zirkel 3 Runden — 50 s Plank · 12 Beinheben · 20 Russian Twists · 10 LS',
    'Core circuit, 3 rounds — 50 s plank · 12 leg raises · 20 Russian twists · 10 push-ups',
  ],
  'plan.core-4w.day.22.desc': [
    'Plank 3×60 s · Hollow Hold 3×40 s · Hängendes Knieheben 3×10 · LS 2×16',
    'Plank 3×60 s · Hollow hold 3×40 s · Hanging knee raises 3×10 · Push-ups 2×16',
  ],
  'plan.core-4w.day.23.desc': [
    'Core-Zirkel 3 Runden — 1 min Plank · 30 Russian Twists · 12 Beinheben · 12 LS',
    'Core circuit, 3 rounds — 1 min plank · 30 Russian twists · 12 leg raises · 12 push-ups',
  ],
  'plan.core-4w.day.25.desc': [
    'Side Plank 3×40 s je Seite · Dead Bug 3×16 · Hollow Hold 3×40 s · LS 2×16',
    'Side plank 3×40 s per side · Dead bug 3×16 · Hollow hold 3×40 s · Push-ups 2×16',
  ],
  'plan.core-4w.day.26.desc': [
    'Leichter Tag — 2×9 LS · Mobility',
    'Light day — 2×9 push-ups · mobility',
  ],
  'plan.core-4w.day.28.desc': [
    'Endtest: 1 min Plank-Halt · maximale LS · 1 min Hollow Hold',
    'Final test: 1 min plank hold · max push-ups · 1 min hollow hold',
  ],
  // ── HIIT Burner ─────────────────────────────────────────────────
  'plan.hiit-4w.title': [
    'HIIT Burner — 4-Wochen-Konditionsplan',
    'HIIT Burner — 4-week conditioning plan',
  ],
  'plan.hiit-4w.summary': [
    'Vier Wochen hochintensives Intervalltraining mit Liegestützen, Burpees, Mountain Climbers, Hampelmännern und Kniebeugen. Tabata, Pyramide und EMOM-Strukturen. Eignet sich als Konditions-Booster zwischen klassischen Liegestütze-Plänen.',
    'Four weeks of high-intensity intervals with push-ups, burpees, mountain climbers, jumping jacks, and squats. Tabata, pyramid, and EMOM structures. Works well as a conditioning booster between classic push-up plans.',
  ],
  'plan.hiit-4w.day.1.desc': [
    'HIIT 4 Runden 30/15 s — LS · Burpees · Mountain Climbers · Jumping Jacks',
    'HIIT 4 rounds 30/15 s — push-ups · burpees · mountain climbers · jumping jacks',
  ],
  'plan.hiit-4w.day.3.desc': [
    'HIIT 5 Runden 30/30 s — LS · Burpees · Hampelmänner · Plank',
    'HIIT 5 rounds 30/30 s — push-ups · burpees · jumping jacks · plank',
  ],
  'plan.hiit-4w.day.4.desc': [
    'Aktive Erholung — 15 min Gehen · 2×10 LS · Mobility',
    'Active recovery — 15 min walk · 2×10 push-ups · mobility',
  ],
  'plan.hiit-4w.day.5.desc': [
    'Tabata 8 Runden 20/10 s — LS · Burpees · Mountain Climbers · Jump Squats',
    'Tabata 8 rounds 20/10 s — push-ups · burpees · mountain climbers · jump squats',
  ],
  'plan.hiit-4w.day.8.desc': [
    'HIIT 5 Runden 40/20 s — LS · Burpees · Mountain Climbers · Squats · Plank',
    'HIIT 5 rounds 40/20 s — push-ups · burpees · mountain climbers · squats · plank',
  ],
  'plan.hiit-4w.day.10.desc': [
    'HIIT-Ladder 8-7-6-5-4-3-2-1 — LS · Burpees (jede Runde 1 Wiederholung weniger)',
    'HIIT ladder 8-7-6-5-4-3-2-1 — push-ups · burpees (one rep fewer each round)',
  ],
  'plan.hiit-4w.day.11.desc': [
    'Aktive Erholung — 20 min lockeres Cardio · 2×11 LS',
    'Active recovery — 20 min easy cardio · 2×11 push-ups',
  ],
  'plan.hiit-4w.day.12.desc': [
    'HIIT 6 Runden 30/15 s — LS · Burpees · Mountain Climbers · Jumping Jacks',
    'HIIT 6 rounds 30/15 s — push-ups · burpees · mountain climbers · jumping jacks',
  ],
  'plan.hiit-4w.day.15.desc': [
    'HIIT 4 Runden 45/15 s — 11 LS · 8 Burpees · 12 Kniebeugen · 30 s Mountain Climbers',
    'HIIT 4 rounds 45/15 s — 11 push-ups · 8 burpees · 12 squats · 30 s mountain climbers',
  ],
  'plan.hiit-4w.day.17.desc': [
    'HIIT 6 Runden 40/20 s — LS · Burpees · MC · Hampelmänner · Squats · Plank',
    'HIIT 6 rounds 40/20 s — push-ups · burpees · MC · jumping jacks · squats · plank',
  ],
  'plan.hiit-4w.day.18.desc': [
    'Aktive Erholung — Yoga 20 min · 2×12 LS',
    'Active recovery — yoga 20 min · 2×12 push-ups',
  ],
  'plan.hiit-4w.day.19.desc': [
    'Tabata 8 Runden 20/10 s — abwechselnd LS · Burpees · Squats · MC',
    'Tabata 8 rounds 20/10 s — alternating push-ups · burpees · squats · MC',
  ],
  'plan.hiit-4w.day.22.desc': [
    'HIIT-Finale 10 Runden 30/15 s — LS · Burpees · MC · Hampelmänner',
    'HIIT finale 10 rounds 30/15 s — push-ups · burpees · MC · jumping jacks',
  ],
  'plan.hiit-4w.day.24.desc': [
    'EMOM 12 min — pro Minute 5 LS · 5 Burpees · 10 Hampelmänner',
    'EMOM 12 min — per minute 5 push-ups · 5 burpees · 10 jumping jacks',
  ],
  'plan.hiit-4w.day.25.desc': [
    'Aktive Erholung — Mobility · 2×13 LS',
    'Active recovery — mobility · 2×13 push-ups',
  ],
  'plan.hiit-4w.day.28.desc': [
    'Konditionstest: 100 LS + 50 Burpees auf Zeit (Bestzeit notieren)',
    'Conditioning test: 100 push-ups + 50 burpees for time (record your best time)',
  ],
  // ── Mobility & Recovery ─────────────────────────────────────────
  'plan.mobility-2w.title': [
    'Mobility &amp; Recovery — 2-Wochen-Deload',
    'Mobility &amp; Recovery — 2-week deload',
  ],
  'plan.mobility-2w.summary': [
    'Zwei Wochen aktive Erholung: tägliche Mobility-, Yoga- und Stretching-Einheiten mit leichtem Liegestütze-Volumen. Ideal als Deload zwischen zwei harten Plänen oder zum Wiedereinstieg nach einer Trainingspause.',
    'Two weeks of active recovery: daily mobility, yoga, and stretching sessions with light push-up volume. Ideal as a deload between two hard plans or to ease back in after a training break.',
  ],
  'plan.mobility-2w.day.1.desc': [
    'Dynamisches Aufwärmen 10 min · 1×10 saubere LS · 10 min Stretching',
    'Dynamic warm-up 10 min · 1×10 clean push-ups · 10 min stretching',
  ],
  'plan.mobility-2w.day.2.desc': [
    'Yoga-Flow 20 min · 1×10 LS · Brust-Stretching',
    'Yoga flow 20 min · 1×10 push-ups · chest stretching',
  ],
  'plan.mobility-2w.day.3.desc': [
    'Cat-Cow 3×10 · Hip Opener 2 min · 2×6 LS · 5 min Foam Rolling',
    'Cat-cow 3×10 · hip opener 2 min · 2×6 push-ups · 5 min foam rolling',
  ],
  'plan.mobility-2w.day.4.desc': [
    'Ruhetag — Foam Rolling 15 min',
    'Rest day — foam rolling 15 min',
  ],
  'plan.mobility-2w.day.5.desc': [
    'Brust-Stretching 5 min · 2×6 LS · 10 min Spaziergang',
    'Chest stretching 5 min · 2×6 push-ups · 10 min walk',
  ],
  'plan.mobility-2w.day.6.desc': [
    'Dynamisches Aufwärmen 10 min · 2×7 LS · Schulter-Mobility 5 min',
    'Dynamic warm-up 10 min · 2×7 push-ups · shoulder mobility 5 min',
  ],
  'plan.mobility-2w.day.8.desc': [
    'Schulter-Mobility 10 min · 2×7 LS · 10 min Stretching',
    'Shoulder mobility 10 min · 2×7 push-ups · 10 min stretching',
  ],
  'plan.mobility-2w.day.9.desc': [
    'Yoga 20 min · 2×8 LS',
    'Yoga 20 min · 2×8 push-ups',
  ],
  'plan.mobility-2w.day.10.desc': [
    'Foam Rolling 10 min · 2×8 LS · Hip Opener 5 min',
    'Foam rolling 10 min · 2×8 push-ups · hip opener 5 min',
  ],
  'plan.mobility-2w.day.11.desc': [
    'Ruhetag — Stretching nach Bedarf',
    'Rest day — stretching as needed',
  ],
  'plan.mobility-2w.day.12.desc': [
    'Dynamisches Aufwärmen · 2×9 LS · 10 min Mobility',
    'Dynamic warm-up · 2×9 push-ups · 10 min mobility',
  ],
  'plan.mobility-2w.day.13.desc': [
    '2×10 LS · 15 min Yoga',
    '2×10 push-ups · 15 min yoga',
  ],
  'plan.mobility-2w.day.14.desc': [
    'Form-Check: 2×10 saubere LS · vollständige Mobility-Session 20 min',
    'Form check: 2×10 clean push-ups · full mobility session 20 min',
  ],
};

function regexEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function xmlEscape(s) {
  // Escape `<` and `>`, plus any `&` that isn't already part of a
  // recognized XML entity (so `&amp;` in the source map stays valid).
  return s
    .replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildUnit(id, source, target) {
  return `    <unit id="${xmlEscape(id)}">\n      <segment state="translated">\n        <source>${source}</source>\n        <target>${target}</target>\n      </segment>\n    </unit>`;
}

async function main() {
  let xml = await fs.readFile(EN_PATH, 'utf-8');
  let replaced = 0;
  let skipped = 0;
  for (const [id, [source, target]] of Object.entries(TRANSLATIONS)) {
    const pattern = new RegExp(
      `    <unit id="${regexEscape(id)}">[\\s\\S]*?    </unit>`
    );
    if (!pattern.test(xml)) {
      console.warn(`skipping ${id}: no matching unit in en.xlf`);
      skipped++;
      continue;
    }
    const replacement = buildUnit(id, source, target);
    // Pass a function to `.replace` so `$&`, `$1` etc. in the
    // replacement string are not interpreted as backreferences.
    xml = xml.replace(pattern, () => replacement);
    replaced++;
  }
  await fs.writeFile(EN_PATH, xml);
  console.log(`en.xlf: replaced ${replaced} unit(s), skipped ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
