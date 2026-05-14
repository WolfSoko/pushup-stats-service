import {
  TrainingPlan,
  TrainingPlanDay,
  TrainingPlanLevel,
} from './training-plan.models';

// Polyfill the global `$localize` tagged template so this module is
// safe to load from non-Angular runtimes (cloud-functions, plain Node
// scripts, Jest test contexts that haven't initialised
// `@angular/localize`). For the Angular i18n build, `$localize` calls
// in this file are statically replaced per locale at build time, so
// the polyfill is dead code in production web bundles. For everyone
// else, it returns the source string (the German metadata-stripped
// payload), matching what `@angular/localize/init` would emit when no
// translations are loaded.
//
// We avoid importing `@angular/localize/init` directly because it
// ships ESM-only (`.mjs`) and forces every Jest project that
// transitively imports `@pu-stats/models` to add `transformIgnore`
// patterns and other ESM gymnastics.
{
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g['$localize'] === 'undefined') {
    g['$localize'] = (...args: unknown[]): string => {
      const parts = args[0] as ArrayLike<string>;
      const expressions = args.slice(1);
      let first = parts[0] ?? '';
      // Strip the optional `:metadata:` prefix that `$localize` uses
      // to carry the i18n id (e.g. `:@@plan.day.rest:Ruhetag`).
      if (first.startsWith(':')) {
        const end = first.indexOf(':', 1);
        if (end > 0) first = first.slice(end + 1);
      }
      let out = first;
      for (let i = 0; i < expressions.length; i++) {
        out += String(expressions[i]) + (parts[i + 1] ?? '');
      }
      return out;
    };
  }
}

/**
 * Curated training plans, derived from existing blog articles in
 * `web/src/app/blog/blog-posts.data.ts`. The numeric targets are
 * absolute baselines suitable for the stated audience — users whose
 * current max differs significantly should treat them as anchors and
 * adjust by `±20%`.
 *
 * All human-readable strings are wrapped in `$localize` so they flow
 * through the standard Angular i18n / XLIFF extraction. There are no
 * parallel `*En` fields — every locale-specific build receives the
 * pre-localised values up front.
 *
 * Recurring day descriptions are extracted as module-level constants
 * (`REST_DAY`, `LIGHT_DAY`, `AMRAP_3X_90S`, …) so the same XLIFF unit
 * covers every occurrence across plans.
 */

// ─── Shared day-description constants ──────────────────────────────
const REST_DAY = $localize`:@@plan.day.rest:Ruhetag`;
const REST_DAY_MOBILITY = $localize`:@@plan.day.rest.mobility:Ruhetag — Mobility`;
const REST_DAY_PREP_FINAL = $localize`:@@plan.day.rest.prepFinal:Ruhetag — Vorbereitung Endtest`;
const LIGHT_DAY = $localize`:@@plan.day.light:Leichter Tag`;
const ACTIVE_RECOVERY = $localize`:@@plan.day.activeRecovery:Aktive Erholung`;
const MOBILITY_CHEST_STRETCH = $localize`:@@plan.day.mobility.chestStretch:Mobility & Brust-Stretching`;
const FINAL_TEST_MAX_NO_PAUSE = $localize`:@@plan.day.finalTest.maxNoPause:Endtest: Maximale Liegestütze ohne Pause`;
const AMRAP_3X = $localize`:@@plan.day.amrap.3x:3×AMRAP`;
const AMRAP_3X_90S = $localize`:@@plan.day.amrap.3x90s:3×AMRAP, 90 s Pause`;
const AMRAP_4X = $localize`:@@plan.day.amrap.4x:4×AMRAP`;
const AMRAP_4X_60S = $localize`:@@plan.day.amrap.4x60s:4×AMRAP, 60 s Pause`;
const TARGET_REPS_5 = $localize`:@@plan.day.targetReps.5:5 Sätze Zielwiederholungen`;
const SETS_4X_90S = $localize`:@@plan.day.sets.4x90s:4 Sätze, 90 s Pause`;
const SETS_3X_70PCT = $localize`:@@plan.day.sets.3x70pct:3 Sätze à 70 %`;
const LIGHT_DAY_2X50PCT = $localize`:@@plan.day.light.2x50pct:Leichter Tag — 2×50 %`;

const RECRUIT_DAYS: ReadonlyArray<TrainingPlanDay> = [
  // Week 1 (Mon–Sun) — 3× full reps with 90s rest. Targets are
  // suitable for someone whose max is roughly 10–15 reps.
  d(
    1,
    'main',
    30,
    [10, 10, 10],
    $localize`:@@plan.recruit-6w.day.1.desc:3×10 saubere Liegestütze, 90 s Pause`
  ),
  d(
    2,
    'rest',
    0,
    undefined,
    $localize`:@@plan.recruit-6w.day.2.desc:Ruhetag — Stretching, Mobility`
  ),
  d(
    3,
    'main',
    33,
    [12, 11, 10],
    $localize`:@@plan.recruit-6w.day.3.desc:3×AMRAP, 90 s Pause (Ziel ≈12-11-10)`
  ),
  d(4, 'rest', 0, undefined, REST_DAY),
  d(5, 'main', 36, [13, 12, 11], AMRAP_3X_90S),
  d(
    6,
    'light',
    20,
    [10, 10],
    $localize`:@@plan.recruit-6w.day.6.desc:Leichter Tag — 50 % vom Maximum`
  ),
  d(7, 'rest', 0, undefined, REST_DAY),
  // Week 2 — same scheme, +10% volume.
  d(8, 'main', 36, [13, 12, 11], AMRAP_3X),
  d(9, 'rest', 0, undefined, REST_DAY),
  d(10, 'main', 39, [14, 13, 12], AMRAP_3X),
  d(11, 'rest', 0, undefined, REST_DAY),
  d(12, 'main', 42, [15, 14, 13], AMRAP_3X),
  d(13, 'light', 22, [11, 11], LIGHT_DAY),
  d(14, 'rest', 0, undefined, REST_DAY),
  // Week 3 — 4 sets, shorter rest (60s).
  d(15, 'main', 48, [14, 12, 12, 10], AMRAP_4X_60S),
  d(16, 'rest', 0, undefined, REST_DAY),
  d(17, 'main', 52, [15, 13, 12, 12], AMRAP_4X_60S),
  d(18, 'rest', 0, undefined, REST_DAY),
  d(19, 'main', 56, [16, 14, 13, 13], AMRAP_4X_60S),
  d(20, 'light', 24, [12, 12], LIGHT_DAY),
  d(21, 'rest', 0, undefined, REST_DAY),
  // Week 4 — 4 sets, slightly higher reps.
  d(22, 'main', 60, [17, 15, 14, 14], AMRAP_4X),
  d(23, 'rest', 0, undefined, REST_DAY),
  d(24, 'main', 64, [18, 16, 15, 15], AMRAP_4X),
  d(25, 'rest', 0, undefined, REST_DAY),
  d(26, 'main', 68, [19, 17, 16, 16], AMRAP_4X),
  d(27, 'light', 26, [13, 13], LIGHT_DAY),
  d(28, 'rest', 0, undefined, REST_DAY),
  // Week 5 — 5 sets, target reps (descending).
  d(29, 'main', 64, [15, 14, 13, 12, 10], TARGET_REPS_5),
  d(30, 'rest', 0, undefined, REST_DAY),
  d(31, 'main', 68, [16, 15, 14, 13, 10], TARGET_REPS_5),
  d(32, 'rest', 0, undefined, REST_DAY),
  d(33, 'main', 72, [17, 16, 15, 14, 10], TARGET_REPS_5),
  d(34, 'light', 28, [14, 14], LIGHT_DAY),
  d(35, 'rest', 0, undefined, REST_DAY),
  // Week 6 — peak + final test.
  d(
    36,
    'main',
    76,
    [18, 17, 16, 14, 11],
    $localize`:@@plan.recruit-6w.day.36.desc:5 Sätze, volle Bewegungsamplitude`
  ),
  d(37, 'rest', 0, undefined, REST_DAY),
  d(
    38,
    'main',
    80,
    [19, 18, 16, 14, 13],
    $localize`:@@plan.recruit-6w.day.38.desc:5 Sätze, kontrolliertes Tempo`
  ),
  d(39, 'rest', 0, undefined, REST_DAY_PREP_FINAL),
  d(
    40,
    'main',
    84,
    [20, 18, 17, 15, 14],
    $localize`:@@plan.recruit-6w.day.40.desc:5 Sätze leicht`
  ),
  d(41, 'rest', 0, undefined, REST_DAY),
  d(42, 'test', 100, undefined, FINAL_TEST_MAX_NO_PAUSE),
];

const CHALLENGE_30_DAYS: ReadonlyArray<TrainingPlanDay> = [
  // Week 1 — Foundation. 3× AMRAP @ 90s on main days; light = 50% max.
  d(
    1,
    'test',
    0,
    undefined,
    $localize`:@@plan.challenge-30d.day.1.desc:Maximaltest — als Ausgangswert eintragen`
  ),
  d(2, 'main', 60, [20, 20, 20], AMRAP_3X_90S),
  d(
    3,
    'light',
    20,
    [10, 10],
    $localize`:@@plan.challenge-30d.day.3.desc:Leichter Tag — 2×50 % vom Maximum`
  ),
  d(4, 'main', 63, [22, 21, 20], AMRAP_3X_90S),
  d(5, 'light', 22, [11, 11], LIGHT_DAY),
  d(6, 'main', 66, [23, 22, 21], AMRAP_3X_90S),
  d(7, 'rest', 0, undefined, REST_DAY),
  // Week 2 — Volume. 4× AMRAP @ 60s; light = 60% max.
  d(8, 'main', 80, [22, 20, 19, 19], AMRAP_4X_60S),
  d(
    9,
    'light',
    30,
    [10, 10, 10],
    $localize`:@@plan.challenge-30d.day.9.desc:Leichter Tag — 3×60 % vom Maximum`
  ),
  d(10, 'main', 84, [23, 21, 20, 20], AMRAP_4X_60S),
  d(11, 'light', 33, [11, 11, 11], LIGHT_DAY),
  d(12, 'main', 88, [24, 22, 21, 21], AMRAP_4X_60S),
  d(13, 'light', 36, [12, 12, 12], LIGHT_DAY),
  d(14, 'rest', 0, undefined, REST_DAY),
  // Week 3 — Intensity. 5× target reps (~80% max). No light days.
  d(
    15,
    'main',
    100,
    [22, 20, 20, 20, 18],
    $localize`:@@plan.challenge-30d.day.15.desc:5 Sätze à ~80 % vom Maximum`
  ),
  d(16, 'rest', 0, undefined, MOBILITY_CHEST_STRETCH),
  d(17, 'main', 105, [23, 22, 20, 20, 20], TARGET_REPS_5),
  d(18, 'rest', 0, undefined, MOBILITY_CHEST_STRETCH),
  d(19, 'main', 110, [24, 22, 22, 22, 20], TARGET_REPS_5),
  d(20, 'rest', 0, undefined, MOBILITY_CHEST_STRETCH),
  d(21, 'main', 115, [25, 23, 23, 22, 22], TARGET_REPS_5),
  // Week 4 — Tapering & Peak. 3× 70% max, last 2 days active recovery.
  d(
    22,
    'main',
    70,
    [25, 23, 22],
    $localize`:@@plan.challenge-30d.day.22.desc:3 Sätze à 70 % — Qualität vor Quantität`
  ),
  d(23, 'light', 30, [15, 15], LIGHT_DAY_2X50PCT),
  d(24, 'main', 75, [26, 25, 24], SETS_3X_70PCT),
  d(25, 'light', 30, [15, 15], LIGHT_DAY_2X50PCT),
  d(26, 'main', 75, [26, 25, 24], SETS_3X_70PCT),
  d(
    27,
    'rest',
    0,
    undefined,
    $localize`:@@plan.challenge-30d.day.27.desc:Aktive Erholung — Spaziergang, Mobility`
  ),
  d(28, 'rest', 0, undefined, ACTIVE_RECOVERY),
  d(
    29,
    'rest',
    0,
    undefined,
    $localize`:@@plan.challenge-30d.day.29.desc:Ruhe vor dem Endtest`
  ),
  d(30, 'test', 100, undefined, FINAL_TEST_MAX_NO_PAUSE),
];

const OVER_40_DAYS: ReadonlyArray<TrainingPlanDay> = [
  // Week 1 — Technique focus, low volume.
  d(
    1,
    'test',
    0,
    undefined,
    $localize`:@@plan.over-40-4w.day.1.desc:Maximaltest mit sauberer Technik`
  ),
  d(
    2,
    'main',
    24,
    [8, 8, 8],
    $localize`:@@plan.over-40-4w.day.2.desc:3×8 Knie- oder erhöhte Liegestütze`
  ),
  d(3, 'rest', 0, undefined, REST_DAY),
  d(
    4,
    'main',
    27,
    [9, 9, 9],
    $localize`:@@plan.over-40-4w.day.4.desc:3×9 saubere Liegestütze`
  ),
  d(
    5,
    'rest',
    0,
    undefined,
    $localize`:@@plan.over-40-4w.day.5.desc:Ruhetag — Schulter-Mobility`
  ),
  d(
    6,
    'main',
    30,
    [10, 10, 10],
    $localize`:@@plan.over-40-4w.day.6.desc:3×10 saubere Liegestütze`
  ),
  d(7, 'rest', 0, undefined, REST_DAY),
  // Week 2 — slight volume increase.
  d(8, 'main', 33, [11, 11, 11], $localize`:@@plan.over-40-4w.day.8.desc:3×11`),
  d(9, 'rest', 0, undefined, REST_DAY),
  d(
    10,
    'main',
    36,
    [12, 12, 12],
    $localize`:@@plan.over-40-4w.day.10.desc:3×12`
  ),
  d(11, 'rest', 0, undefined, REST_DAY),
  d(
    12,
    'main',
    39,
    [13, 13, 13],
    $localize`:@@plan.over-40-4w.day.12.desc:3×13`
  ),
  d(13, 'light', 16, [8, 8], LIGHT_DAY),
  d(14, 'rest', 0, undefined, REST_DAY),
  // Week 3 — 4 sets, more volume but still 90s rest.
  d(15, 'main', 48, [13, 12, 12, 11], SETS_4X_90S),
  d(16, 'rest', 0, undefined, REST_DAY),
  d(17, 'main', 52, [14, 13, 13, 12], SETS_4X_90S),
  d(18, 'rest', 0, undefined, REST_DAY_MOBILITY),
  d(19, 'main', 56, [15, 14, 14, 13], SETS_4X_90S),
  d(20, 'light', 18, [9, 9], LIGHT_DAY),
  d(21, 'rest', 0, undefined, REST_DAY),
  // Week 4 — peak + final test (still gentle volume).
  d(
    22,
    'main',
    60,
    [16, 15, 15, 14],
    $localize`:@@plan.over-40-4w.day.22.desc:4 Sätze, kontrolliertes Tempo`
  ),
  d(23, 'rest', 0, undefined, REST_DAY),
  d(
    24,
    'main',
    64,
    [17, 16, 16, 15],
    $localize`:@@plan.over-40-4w.day.24.desc:4 Sätze, langsame Exzentrik`
  ),
  d(25, 'rest', 0, undefined, REST_DAY),
  d(26, 'light', 20, [10, 10], LIGHT_DAY),
  d(27, 'rest', 0, undefined, REST_DAY_PREP_FINAL),
  d(
    28,
    'test',
    50,
    undefined,
    $localize`:@@plan.over-40-4w.day.28.desc:Endtest: Maximale Liegestütze`
  ),
];

// Daily 100 — 30-day intermediate volume plan. Pattern: 5 main + 1 light
// + 1 rest each week. Goal is 100 clean reps per session by week 2 and
// stable maintenance through week 4. Day 1 baseline test, day 30 final.
const DAILY_100_DAYS: ReadonlyArray<TrainingPlanDay> = [
  // Week 1 — ramp up daily volume from 50 → 70.
  d(
    1,
    'test',
    50,
    undefined,
    $localize`:@@plan.daily-100-30d.day.1.desc:Baseline-Test: maximale Wiederholungen in einem Satz`
  ),
  d(
    2,
    'main',
    50,
    [10, 10, 10, 10, 10],
    $localize`:@@plan.daily-100-30d.day.2.desc:5×10 saubere Wiederholungen, 60 s Pause`
  ),
  d(
    3,
    'main',
    60,
    [12, 12, 12, 12, 12],
    $localize`:@@plan.daily-100-30d.day.3.desc:5×12, 60 s Pause`
  ),
  d(
    4,
    'main',
    60,
    [12, 12, 12, 12, 12],
    $localize`:@@plan.daily-100-30d.day.4.desc:5×12, 60 s Pause`
  ),
  d(
    5,
    'main',
    70,
    [14, 14, 14, 14, 14],
    $localize`:@@plan.daily-100-30d.day.5.desc:5×14, 60 s Pause`
  ),
  d(
    6,
    'light',
    30,
    [15, 15],
    $localize`:@@plan.daily-100-30d.day.6.desc:Leichter Tag — 2×15 in lockerem Tempo`
  ),
  d(7, 'rest', 0, undefined, REST_DAY),
  // Week 2 — push to 100 reps daily.
  d(
    8,
    'main',
    80,
    [16, 16, 16, 16, 16],
    $localize`:@@plan.daily-100-30d.day.8.desc:5×16`
  ),
  d(
    9,
    'main',
    80,
    [16, 16, 16, 16, 16],
    $localize`:@@plan.daily-100-30d.day.9.desc:5×16`
  ),
  d(
    10,
    'main',
    90,
    [18, 18, 18, 18, 18],
    $localize`:@@plan.daily-100-30d.day.10.desc:5×18`
  ),
  d(
    11,
    'main',
    90,
    [18, 18, 18, 18, 18],
    $localize`:@@plan.daily-100-30d.day.11.desc:5×18`
  ),
  d(
    12,
    'main',
    100,
    [20, 20, 20, 20, 20],
    $localize`:@@plan.daily-100-30d.day.12.desc:Erstes Hundert: 5×20`
  ),
  d(13, 'light', 40, [20, 20], LIGHT_DAY),
  d(14, 'rest', 0, undefined, REST_DAY),
  // Week 3 — consolidate at 100, vary set count.
  d(
    15,
    'main',
    100,
    [25, 25, 25, 25],
    $localize`:@@plan.daily-100-30d.day.15.desc:4×25 (weniger Sätze, mehr Wiederholungen)`
  ),
  d(
    16,
    'main',
    100,
    [20, 20, 20, 20, 20],
    $localize`:@@plan.daily-100-30d.day.16.desc:5×20`
  ),
  d(
    17,
    'main',
    100,
    [25, 25, 25, 25],
    $localize`:@@plan.daily-100-30d.day.17.desc:4×25`
  ),
  d(
    18,
    'main',
    100,
    [20, 20, 20, 20, 20],
    $localize`:@@plan.daily-100-30d.day.18.desc:5×20`
  ),
  d(
    19,
    'main',
    100,
    [25, 25, 25, 25],
    $localize`:@@plan.daily-100-30d.day.19.desc:4×25 — Tempo bewusst verlangsamen`
  ),
  d(20, 'light', 40, [20, 20], LIGHT_DAY),
  d(21, 'rest', 0, undefined, REST_DAY),
  // Week 4 — maintenance + taper to final test.
  d(
    22,
    'main',
    100,
    [20, 20, 20, 20, 20],
    $localize`:@@plan.daily-100-30d.day.22.desc:5×20`
  ),
  d(
    23,
    'main',
    100,
    [25, 25, 25, 25],
    $localize`:@@plan.daily-100-30d.day.23.desc:4×25`
  ),
  d(
    24,
    'main',
    100,
    [20, 20, 20, 20, 20],
    $localize`:@@plan.daily-100-30d.day.24.desc:5×20`
  ),
  d(
    25,
    'main',
    100,
    [25, 25, 25, 25],
    $localize`:@@plan.daily-100-30d.day.25.desc:4×25`
  ),
  d(
    26,
    'main',
    100,
    [20, 20, 20, 20, 20],
    $localize`:@@plan.daily-100-30d.day.26.desc:Letzter 100er-Tag vor dem Test`
  ),
  d(
    27,
    'light',
    40,
    [20, 20],
    $localize`:@@plan.daily-100-30d.day.27.desc:Leichter Tag — Form-Check`
  ),
  d(28, 'rest', 0, undefined, REST_DAY),
  d(
    29,
    'rest',
    0,
    undefined,
    $localize`:@@plan.daily-100-30d.day.29.desc:Ruhetag — Vorbereitung auf den Endtest`
  ),
  d(
    30,
    'test',
    100,
    undefined,
    $localize`:@@plan.daily-100-30d.day.30.desc:Endtest: Maximale saubere Wiederholungen in einem Satz`
  ),
];

// One-arm progression — 12-week advanced plan toward a clean one-arm
// push-up. Pattern per week (Mon/Wed/Fri/Sat active, Tue/Thu/Sun rest):
// - Mon: heavy phase work (archer / negative / partial / one-arm)
// - Wed: technique day (tempo, lever)
// - Fri: volume day (general capacity)
// - Sat: light day (movement quality, low intensity)
// Phase 1 (W1–3): archer + assisted one-arm negatives.
// Phase 2 (W4–6): negative one-arm push-ups from bench.
// Phase 3 (W7–9): partial-ROM one-arm at low bench.
// Phase 4 (W10–12): full-ROM one-arm push-ups, wide → narrowing stance.
const ONE_ARM_DAYS: ReadonlyArray<TrainingPlanDay> = [
  // ─── Phase 1 ────────────────────────────────────────────────
  // Week 1
  d(
    1,
    'main',
    18,
    [6, 6, 6],
    $localize`:@@plan.one-arm-12w.day.1.desc:Archer-Liegestütze 3×6`
  ),
  d(2, 'rest', 0, undefined, REST_DAY),
  d(
    3,
    'main',
    30,
    [10, 10, 10],
    $localize`:@@plan.one-arm-12w.day.3.desc:Wand-Einarmige 3×10 (langsame Exzentrik)`
  ),
  d(4, 'rest', 0, undefined, REST_DAY),
  d(
    5,
    'main',
    60,
    [20, 20, 20],
    $localize`:@@plan.one-arm-12w.day.5.desc:Standard-Liegestütze 3×20 (Volumen)`
  ),
  d(
    6,
    'light',
    20,
    [10, 10],
    $localize`:@@plan.one-arm-12w.day.6.desc:Leichter Tag 2×10`
  ),
  d(7, 'rest', 0, undefined, REST_DAY),
  // Week 2
  d(
    8,
    'main',
    24,
    [8, 8, 8],
    $localize`:@@plan.one-arm-12w.day.8.desc:Archer 3×8`
  ),
  d(9, 'rest', 0, undefined, REST_DAY),
  d(
    10,
    'main',
    36,
    [12, 12, 12],
    $localize`:@@plan.one-arm-12w.day.10.desc:Wand-Einarmige 3×12`
  ),
  d(11, 'rest', 0, undefined, REST_DAY),
  d(
    12,
    'main',
    66,
    [22, 22, 22],
    $localize`:@@plan.one-arm-12w.day.12.desc:Standard 3×22`
  ),
  d(
    13,
    'light',
    24,
    [12, 12],
    $localize`:@@plan.one-arm-12w.day.13.desc:Leichter Tag 2×12`
  ),
  d(14, 'rest', 0, undefined, REST_DAY),
  // Week 3
  d(
    15,
    'main',
    30,
    [10, 10, 10],
    $localize`:@@plan.one-arm-12w.day.15.desc:Archer 3×10 — Phase 1 abschließen`
  ),
  d(16, 'rest', 0, undefined, REST_DAY),
  d(
    17,
    'main',
    45,
    [15, 15, 15],
    $localize`:@@plan.one-arm-12w.day.17.desc:Wand-Einarmige 3×15`
  ),
  d(18, 'rest', 0, undefined, REST_DAY),
  d(
    19,
    'main',
    75,
    [25, 25, 25],
    $localize`:@@plan.one-arm-12w.day.19.desc:Standard 3×25`
  ),
  d(
    20,
    'light',
    28,
    [14, 14],
    $localize`:@@plan.one-arm-12w.day.20.desc:Leichter Tag 2×14`
  ),
  d(21, 'rest', 0, undefined, REST_DAY),
  // ─── Phase 2 ────────────────────────────────────────────────
  // Week 4
  d(
    22,
    'main',
    15,
    [5, 5, 5],
    $localize`:@@plan.one-arm-12w.day.22.desc:Negative Einarmige von Bank 3×5 (3 s runter)`
  ),
  d(23, 'rest', 0, undefined, REST_DAY),
  d(
    24,
    'main',
    18,
    [6, 6, 6],
    $localize`:@@plan.one-arm-12w.day.24.desc:Langsame Archer 3×6 (Tempo 3-1-1)`
  ),
  d(25, 'rest', 0, undefined, REST_DAY),
  d(
    26,
    'main',
    60,
    [20, 20, 20],
    $localize`:@@plan.one-arm-12w.day.26.desc:Weite Liegestütze 3×20 (Brust-Volumen)`
  ),
  d(27, 'light', 20, [10, 10], LIGHT_DAY),
  d(28, 'rest', 0, undefined, REST_DAY),
  // Week 5
  d(
    29,
    'main',
    15,
    [5, 5, 5],
    $localize`:@@plan.one-arm-12w.day.29.desc:Negative Einarmige 3×5`
  ),
  d(30, 'rest', 0, undefined, REST_DAY),
  d(
    31,
    'main',
    21,
    [7, 7, 7],
    $localize`:@@plan.one-arm-12w.day.31.desc:Langsame Archer 3×7`
  ),
  d(32, 'rest', 0, undefined, REST_DAY),
  d(
    33,
    'main',
    60,
    [20, 20, 20],
    $localize`:@@plan.one-arm-12w.day.33.desc:Weite Liegestütze 3×20`
  ),
  d(
    34,
    'light',
    22,
    [11, 11],
    $localize`:@@plan.one-arm-12w.day.34.desc:Leichter Tag 2×11`
  ),
  d(35, 'rest', 0, undefined, REST_DAY),
  // Week 6
  d(
    36,
    'main',
    18,
    [6, 6, 6],
    $localize`:@@plan.one-arm-12w.day.36.desc:Negative Einarmige 3×6`
  ),
  d(37, 'rest', 0, undefined, REST_DAY),
  d(
    38,
    'main',
    24,
    [8, 8, 8],
    $localize`:@@plan.one-arm-12w.day.38.desc:Langsame Archer 3×8 — Phase 2 abschließen`
  ),
  d(39, 'rest', 0, undefined, REST_DAY),
  d(
    40,
    'main',
    65,
    [22, 22, 21],
    $localize`:@@plan.one-arm-12w.day.40.desc:Weite Liegestütze 3×~22`
  ),
  d(41, 'light', 24, [12, 12], LIGHT_DAY),
  d(42, 'rest', 0, undefined, REST_DAY),
  // ─── Phase 3 ────────────────────────────────────────────────
  // Week 7
  d(
    43,
    'main',
    12,
    [4, 4, 4],
    $localize`:@@plan.one-arm-12w.day.43.desc:Partielle Einarmige (niedrige Bank) 3×4`
  ),
  d(44, 'rest', 0, undefined, REST_DAY),
  d(
    45,
    'main',
    18,
    [6, 6, 6],
    $localize`:@@plan.one-arm-12w.day.45.desc:Archer mit langem Tempo 3×6`
  ),
  d(46, 'rest', 0, undefined, REST_DAY),
  d(
    47,
    'main',
    36,
    [12, 12, 12],
    $localize`:@@plan.one-arm-12w.day.47.desc:Diamant-Liegestütze 3×12 (Trizeps-Volumen)`
  ),
  d(48, 'light', 20, [10, 10], LIGHT_DAY),
  d(49, 'rest', 0, undefined, REST_DAY),
  // Week 8
  d(
    50,
    'main',
    12,
    [4, 4, 4],
    $localize`:@@plan.one-arm-12w.day.50.desc:Partielle Einarmige 3×4`
  ),
  d(51, 'rest', 0, undefined, REST_DAY),
  d(
    52,
    'main',
    18,
    [6, 6, 6],
    $localize`:@@plan.one-arm-12w.day.52.desc:Archer mit Tempo 3×6`
  ),
  d(53, 'rest', 0, undefined, REST_DAY),
  d(
    54,
    'main',
    39,
    [13, 13, 13],
    $localize`:@@plan.one-arm-12w.day.54.desc:Diamant 3×13`
  ),
  d(55, 'light', 22, [11, 11], LIGHT_DAY),
  d(56, 'rest', 0, undefined, REST_DAY),
  // Week 9
  d(
    57,
    'main',
    15,
    [5, 5, 5],
    $localize`:@@plan.one-arm-12w.day.57.desc:Partielle Einarmige 3×5 — Phase 3 abschließen`
  ),
  d(58, 'rest', 0, undefined, REST_DAY),
  d(
    59,
    'main',
    21,
    [7, 7, 7],
    $localize`:@@plan.one-arm-12w.day.59.desc:Tempo-Archer 3×7`
  ),
  d(60, 'rest', 0, undefined, REST_DAY),
  d(
    61,
    'main',
    39,
    [13, 13, 13],
    $localize`:@@plan.one-arm-12w.day.61.desc:Diamant 3×13`
  ),
  d(62, 'light', 24, [12, 12], LIGHT_DAY),
  d(63, 'rest', 0, undefined, REST_DAY),
  // ─── Phase 4 ────────────────────────────────────────────────
  // Week 10
  d(
    64,
    'main',
    9,
    [3, 3, 3],
    $localize`:@@plan.one-arm-12w.day.64.desc:Volle Einarmige (weiter Stand) 3×3`
  ),
  d(65, 'rest', 0, undefined, REST_DAY),
  d(
    66,
    'main',
    12,
    [4, 4, 4],
    $localize`:@@plan.one-arm-12w.day.66.desc:Einarmige (etwas engerer Stand) 3×4`
  ),
  d(67, 'rest', 0, undefined, REST_DAY),
  d(
    68,
    'main',
    75,
    [25, 25, 25],
    $localize`:@@plan.one-arm-12w.day.68.desc:Standard 3×25`
  ),
  d(69, 'light', 20, [10, 10], LIGHT_DAY),
  d(70, 'rest', 0, undefined, REST_DAY),
  // Week 11
  d(
    71,
    'main',
    9,
    [3, 3, 3],
    $localize`:@@plan.one-arm-12w.day.71.desc:Volle Einarmige 3×3`
  ),
  d(72, 'rest', 0, undefined, REST_DAY),
  d(
    73,
    'main',
    15,
    [5, 5, 5],
    $localize`:@@plan.one-arm-12w.day.73.desc:Einarmige enger Stand 3×5`
  ),
  d(74, 'rest', 0, undefined, REST_DAY),
  d(
    75,
    'main',
    75,
    [25, 25, 25],
    $localize`:@@plan.one-arm-12w.day.75.desc:Standard 3×25`
  ),
  d(76, 'light', 22, [11, 11], LIGHT_DAY),
  d(77, 'rest', 0, undefined, REST_DAY),
  // Week 12 — taper toward final test.
  d(
    78,
    'main',
    9,
    [3, 3, 3],
    $localize`:@@plan.one-arm-12w.day.78.desc:Letzte schwere Einheit 3×3`
  ),
  d(79, 'rest', 0, undefined, REST_DAY),
  d(
    80,
    'light',
    8,
    [4, 4],
    $localize`:@@plan.one-arm-12w.day.80.desc:Technik-Taper 2×4 saubere Wiederholungen`
  ),
  d(81, 'rest', 0, undefined, REST_DAY),
  d(
    82,
    'light',
    6,
    [3, 3],
    $localize`:@@plan.one-arm-12w.day.82.desc:Mobility + 2×3 leichte Wiederholungen`
  ),
  d(
    83,
    'rest',
    0,
    undefined,
    $localize`:@@plan.one-arm-12w.day.83.desc:Ruhetag — bereit für Endtest`
  ),
  d(
    84,
    'test',
    5,
    undefined,
    $localize`:@@plan.one-arm-12w.day.84.desc:Endtest: maximale saubere einarmige Liegestütze pro Seite`
  ),
];

// Push-Pull Balance — 6-week intermediate plan. Trains push and pull
// symmetrically to avoid the all-push imbalance the single-exercise
// pushup plans encourage. Each main day prescribes a paired pull
// movement (rows, pull-up negatives, face pulls) alongside the push
// work. `targetReps` tracks the pushup component only — that's what
// the auto-mark + Quick-Add flow can credit. Pull work counts toward
// the day via the description and the user's manual completion.
const PUSH_PULL_BALANCE_DAYS: ReadonlyArray<TrainingPlanDay> = [
  // Week 1 — baseline volume.
  d(
    1,
    'main',
    30,
    [10, 10, 10],
    $localize`:@@plan.push-pull-6w.day.1.desc:Push 3×10 saubere Liegestütze · Pull 3×8 invertierte Rudern, 90 s Pause`
  ),
  d(
    2,
    'main',
    24,
    [12, 12],
    $localize`:@@plan.push-pull-6w.day.2.desc:Pull-Tag: 4×8 Australian Rows · Push 2×12 Knie-Liegestütze als Aktivierung`
  ),
  d(3, 'rest', 0, undefined, REST_DAY),
  d(
    4,
    'main',
    33,
    [11, 11, 11],
    $localize`:@@plan.push-pull-6w.day.4.desc:Push 3×11 · Pull 3×6 Klimmzug-Negative (5 s Exzentrik)`
  ),
  d(
    5,
    'light',
    20,
    [10, 10],
    $localize`:@@plan.push-pull-6w.day.5.desc:Leichter Tag 2×10 · 3×12 Face Pulls`
  ),
  d(
    6,
    'main',
    36,
    [12, 12, 12],
    $localize`:@@plan.push-pull-6w.day.6.desc:Push 3×12 · Pull 3×8 invertierte Rudern · Plank 3×30 s`
  ),
  d(7, 'rest', 0, undefined, REST_DAY),
  // Week 2 — same scheme, +10 % volume.
  d(
    8,
    'main',
    36,
    [13, 12, 11],
    $localize`:@@plan.push-pull-6w.day.8.desc:Push 3×AMRAP (Ziel 13-12-11) · Pull 3×9 Rudern`
  ),
  d(
    9,
    'main',
    27,
    [9, 9, 9],
    $localize`:@@plan.push-pull-6w.day.9.desc:Pull-Tag: 4×9 Australian Rows · Push 3×9 saubere LS`
  ),
  d(10, 'rest', 0, undefined, REST_DAY),
  d(
    11,
    'main',
    39,
    [14, 13, 12],
    $localize`:@@plan.push-pull-6w.day.11.desc:Push 3×AMRAP (Ziel 14-13-12) · Pull 3×7 Klimmzug-Negative`
  ),
  d(
    12,
    'light',
    22,
    [11, 11],
    $localize`:@@plan.push-pull-6w.day.12.desc:Leichter Tag 2×11 · 3×12 Face Pulls · Schulter-Mobility`
  ),
  d(
    13,
    'main',
    42,
    [15, 14, 13],
    $localize`:@@plan.push-pull-6w.day.13.desc:Push 3×AMRAP · Pull 3×10 invertierte Rudern · Plank 3×40 s`
  ),
  d(14, 'rest', 0, undefined, REST_DAY),
  // Week 3 — 4 sets, balanced volume.
  d(
    15,
    'main',
    45,
    [12, 11, 11, 11],
    $localize`:@@plan.push-pull-6w.day.15.desc:Push 4 Sätze · Pull 4×6 Klimmzüge (oder Negative)`
  ),
  d(
    16,
    'main',
    30,
    [10, 10, 10],
    $localize`:@@plan.push-pull-6w.day.16.desc:Pull-Tag: 5×8 Australian Rows · Push 3×10 saubere LS`
  ),
  d(17, 'rest', 0, undefined, REST_DAY),
  d(
    18,
    'main',
    48,
    [13, 12, 12, 11],
    $localize`:@@plan.push-pull-6w.day.18.desc:Push 4×AMRAP · Pull 4×7 Klimmzüge · Plank 3×45 s`
  ),
  d(
    19,
    'light',
    24,
    [12, 12],
    $localize`:@@plan.push-pull-6w.day.19.desc:Leichter Tag 2×12 · 3×15 Face Pulls`
  ),
  d(
    20,
    'main',
    51,
    [14, 13, 12, 12],
    $localize`:@@plan.push-pull-6w.day.20.desc:Push 4×AMRAP · Pull 4×8 Klimmzüge · Hollow Hold 3×20 s`
  ),
  d(21, 'rest', 0, undefined, REST_DAY),
  // Week 4 — heavier loads, balanced sets.
  d(
    22,
    'main',
    54,
    [15, 13, 13, 13],
    $localize`:@@plan.push-pull-6w.day.22.desc:Push 4 Sätze, 60 s Pause · Pull 4×8 Klimmzüge`
  ),
  d(
    23,
    'main',
    33,
    [11, 11, 11],
    $localize`:@@plan.push-pull-6w.day.23.desc:Pull-Tag: 5×9 Australian Rows · Push 3×11 LS`
  ),
  d(24, 'rest', 0, undefined, REST_DAY),
  d(
    25,
    'main',
    57,
    [16, 14, 14, 13],
    $localize`:@@plan.push-pull-6w.day.25.desc:Push 4×AMRAP · Pull 4×9 Klimmzüge · Plank 3×50 s`
  ),
  d(
    26,
    'light',
    26,
    [13, 13],
    $localize`:@@plan.push-pull-6w.day.26.desc:Leichter Tag 2×13 · Brust- und Rücken-Mobility`
  ),
  d(
    27,
    'main',
    60,
    [17, 15, 14, 14],
    $localize`:@@plan.push-pull-6w.day.27.desc:Push 4×AMRAP · Pull 4×10 Klimmzüge · Hollow Hold 3×30 s`
  ),
  d(28, 'rest', 0, undefined, REST_DAY),
  // Week 5 — 5 sets, descending reps.
  d(
    29,
    'main',
    65,
    [14, 13, 13, 13, 12],
    $localize`:@@plan.push-pull-6w.day.29.desc:Push 5 Sätze · Pull 5×7 Klimmzüge, 90 s Pause`
  ),
  d(
    30,
    'main',
    36,
    [12, 12, 12],
    $localize`:@@plan.push-pull-6w.day.30.desc:Pull-Tag: 5×10 Australian Rows · Push 3×12 LS`
  ),
  d(31, 'rest', 0, undefined, REST_DAY),
  d(
    32,
    'main',
    70,
    [15, 14, 14, 14, 13],
    $localize`:@@plan.push-pull-6w.day.32.desc:Push 5 Sätze · Pull 5×8 Klimmzüge · Plank 3×60 s`
  ),
  d(
    33,
    'light',
    28,
    [14, 14],
    $localize`:@@plan.push-pull-6w.day.33.desc:Leichter Tag 2×14 · 4×12 Face Pulls`
  ),
  d(
    34,
    'main',
    75,
    [16, 15, 15, 15, 14],
    $localize`:@@plan.push-pull-6w.day.34.desc:Push 5 Sätze · Pull 5×9 Klimmzüge · Hollow Hold 3×40 s`
  ),
  d(35, 'rest', 0, undefined, REST_DAY),
  // Week 6 — peak + final test.
  d(
    36,
    'main',
    80,
    [17, 16, 16, 16, 15],
    $localize`:@@plan.push-pull-6w.day.36.desc:Push 5 Sätze schwer · Pull 5×10 Klimmzüge`
  ),
  d(
    37,
    'main',
    40,
    [10, 10, 10, 10],
    $localize`:@@plan.push-pull-6w.day.37.desc:Pull-Schwerpunkt: 5×AMRAP Klimmzüge · Push 4×10 LS`
  ),
  d(38, 'rest', 0, undefined, REST_DAY_MOBILITY),
  d(
    39,
    'main',
    60,
    [15, 15, 15, 15],
    $localize`:@@plan.push-pull-6w.day.39.desc:Taper-Tag: 4×15 saubere LS · 3×6 Klimmzüge`
  ),
  d(
    40,
    'light',
    20,
    [10, 10],
    $localize`:@@plan.push-pull-6w.day.40.desc:Leichter Tag 2×10 · Mobility`
  ),
  d(41, 'rest', 0, undefined, REST_DAY_PREP_FINAL),
  d(
    42,
    'test',
    100,
    undefined,
    $localize`:@@plan.push-pull-6w.day.42.desc:Endtest: maximale Liegestütze + maximale Klimmzüge in einem Satz`
  ),
];

// Full Body Strong — 6-week intermediate plan combining the four
// foundational bodyweight patterns: push (Liegestütze), squat
// (Kniebeugen), hinge (Glute Bridge), and anti-extension (Plank).
// Each main day is a circuit; `targetReps` tracks pushups, the
// description prescribes the full circuit.
const FULL_BODY_DAYS: ReadonlyArray<TrainingPlanDay> = [
  // Week 1 — circuit foundation, 3 main days.
  d(
    1,
    'test',
    20,
    undefined,
    $localize`:@@plan.full-body-6w.day.1.desc:Baseline-Test: maximale Liegestütze · 1 min Wall-Sit · 1 min Plank`
  ),
  d(
    2,
    'main',
    30,
    [10, 10, 10],
    $localize`:@@plan.full-body-6w.day.2.desc:Zirkel 3 Runden — 10 LS · 15 Kniebeugen · 10 Ausfallschritte je Bein · 30 s Plank`
  ),
  d(3, 'rest', 0, undefined, REST_DAY),
  d(
    4,
    'main',
    30,
    [10, 10, 10],
    $localize`:@@plan.full-body-6w.day.4.desc:Zirkel 3 Runden — 10 LS · 15 Sumo-Kniebeugen · 12 Glute Bridges · 40 s Plank`
  ),
  d(
    5,
    'light',
    20,
    [10, 10],
    $localize`:@@plan.full-body-6w.day.5.desc:Leichter Tag — 2×10 LS · Mobility 10 min`
  ),
  d(
    6,
    'main',
    30,
    [10, 10, 10],
    $localize`:@@plan.full-body-6w.day.6.desc:Zirkel 3 Runden — 10 LS · 15 Kniebeugen · 10 Glute Bridges · 30 s Hollow Hold`
  ),
  d(7, 'rest', 0, undefined, REST_DAY),
  // Week 2 — +20 % volume per circuit station.
  d(
    8,
    'main',
    36,
    [12, 12, 12],
    $localize`:@@plan.full-body-6w.day.8.desc:Zirkel 3 Runden — 12 LS · 18 Kniebeugen · 12 Ausfallschritte je Bein · 40 s Plank`
  ),
  d(9, 'rest', 0, undefined, REST_DAY),
  d(
    10,
    'main',
    36,
    [12, 12, 12],
    $localize`:@@plan.full-body-6w.day.10.desc:Zirkel 3 Runden — 12 LS · 18 Sumo-Kniebeugen · 15 Glute Bridges · 45 s Plank`
  ),
  d(
    11,
    'light',
    22,
    [11, 11],
    $localize`:@@plan.full-body-6w.day.11.desc:Leichter Tag — 2×11 LS · Hip Opener 10 min`
  ),
  d(
    12,
    'main',
    36,
    [12, 12, 12],
    $localize`:@@plan.full-body-6w.day.12.desc:Zirkel 3 Runden — 12 LS · 12 Step-Ups je Bein · 15 Russian Twists · 40 s Plank`
  ),
  d(13, 'rest', 0, undefined, REST_DAY),
  d(14, 'rest', 0, undefined, REST_DAY),
  // Week 3 — 4-round circuits.
  d(
    15,
    'main',
    40,
    [10, 10, 10, 10],
    $localize`:@@plan.full-body-6w.day.15.desc:Zirkel 4 Runden — 10 LS · 15 Kniebeugen · 12 Glute Bridges · 40 s Plank`
  ),
  d(16, 'rest', 0, undefined, REST_DAY),
  d(
    17,
    'main',
    44,
    [11, 11, 11, 11],
    $localize`:@@plan.full-body-6w.day.17.desc:Zirkel 4 Runden — 11 LS · 16 Ausfallschritte je Bein · 15 Glute Bridges · 45 s Plank`
  ),
  d(
    18,
    'light',
    24,
    [12, 12],
    $localize`:@@plan.full-body-6w.day.18.desc:Leichter Tag — 2×12 LS · Yoga 20 min`
  ),
  d(
    19,
    'main',
    48,
    [12, 12, 12, 12],
    $localize`:@@plan.full-body-6w.day.19.desc:Zirkel 4 Runden — 12 LS · 15 Jump Squats · 12 Glute Bridges · 45 s Plank`
  ),
  d(20, 'rest', 0, undefined, REST_DAY),
  d(21, 'rest', 0, undefined, REST_DAY),
  // Week 4 — heavier per station.
  d(
    22,
    'main',
    52,
    [13, 13, 13, 13],
    $localize`:@@plan.full-body-6w.day.22.desc:Zirkel 4 Runden — 13 LS · 18 Kniebeugen · 15 Glute Bridges · 50 s Plank`
  ),
  d(23, 'rest', 0, undefined, REST_DAY),
  d(
    24,
    'main',
    56,
    [14, 14, 14, 14],
    $localize`:@@plan.full-body-6w.day.24.desc:Zirkel 4 Runden — 14 LS · 18 Ausfallschritte je Bein · 15 Hip Thrusts · 50 s Plank`
  ),
  d(
    25,
    'light',
    26,
    [13, 13],
    $localize`:@@plan.full-body-6w.day.25.desc:Leichter Tag — 2×13 LS · Foam Rolling 15 min`
  ),
  d(
    26,
    'main',
    60,
    [15, 15, 15, 15],
    $localize`:@@plan.full-body-6w.day.26.desc:Zirkel 4 Runden — 15 LS · 18 Jump Squats · 15 Glute Bridges · 60 s Plank`
  ),
  d(27, 'rest', 0, undefined, REST_DAY),
  d(28, 'rest', 0, undefined, REST_DAY),
  // Week 5 — 5-round circuits.
  d(
    29,
    'main',
    60,
    [12, 12, 12, 12, 12],
    $localize`:@@plan.full-body-6w.day.29.desc:Zirkel 5 Runden — 12 LS · 15 Kniebeugen · 12 Glute Bridges · 45 s Plank`
  ),
  d(30, 'rest', 0, undefined, REST_DAY),
  d(
    31,
    'main',
    65,
    [13, 13, 13, 13, 13],
    $localize`:@@plan.full-body-6w.day.31.desc:Zirkel 5 Runden — 13 LS · 16 Ausfallschritte je Bein · 13 Glute Bridges · 50 s Plank`
  ),
  d(
    32,
    'light',
    28,
    [14, 14],
    $localize`:@@plan.full-body-6w.day.32.desc:Leichter Tag — 2×14 LS · Mobility 15 min`
  ),
  d(
    33,
    'main',
    70,
    [14, 14, 14, 14, 14],
    $localize`:@@plan.full-body-6w.day.33.desc:Zirkel 5 Runden — 14 LS · 18 Jump Squats · 15 Hip Thrusts · 60 s Plank`
  ),
  d(34, 'rest', 0, undefined, REST_DAY),
  d(35, 'rest', 0, undefined, REST_DAY),
  // Week 6 — peak + functional test.
  d(
    36,
    'main',
    75,
    [15, 15, 15, 15, 15],
    $localize`:@@plan.full-body-6w.day.36.desc:Peak-Zirkel 5 Runden — 15 LS · 20 Kniebeugen · 15 Glute Bridges · 60 s Plank`
  ),
  d(37, 'rest', 0, undefined, REST_DAY),
  d(
    38,
    'main',
    60,
    [15, 15, 15, 15],
    $localize`:@@plan.full-body-6w.day.38.desc:Taper-Zirkel 4 Runden, kontrolliertes Tempo — 15 LS · 15 KB · 12 GB · 45 s Plank`
  ),
  d(
    39,
    'light',
    24,
    [12, 12],
    $localize`:@@plan.full-body-6w.day.39.desc:Leichter Tag — 2×12 LS · Mobility`
  ),
  d(40, 'rest', 0, undefined, REST_DAY_MOBILITY),
  d(41, 'rest', 0, undefined, REST_DAY_PREP_FINAL),
  d(
    42,
    'test',
    50,
    undefined,
    $localize`:@@plan.full-body-6w.day.42.desc:Funktionstest: maximale LS · 50 Kniebeugen auf Zeit · 1 min Plank-Halt`
  ),
];

// Core Foundations — 4-week beginner plan centered on core stability.
// Pushups appear as a moderate "activation" component (so the plan
// keeps integrating with the existing auto-mark + pushup tracking),
// but each main day is built around plank, hollow hold, dead bug,
// leg raises, and rotational work prescribed in the description.
const CORE_FOUNDATIONS_DAYS: ReadonlyArray<TrainingPlanDay> = [
  // Week 1 — establish baseline holds.
  d(
    1,
    'test',
    10,
    undefined,
    $localize`:@@plan.core-4w.day.1.desc:Baseline: maximale Plank-Zeit · 10 saubere LS · maximale Hollow-Hold-Zeit`
  ),
  d(
    2,
    'main',
    20,
    [10, 10],
    $localize`:@@plan.core-4w.day.2.desc:Plank 3×30 s · Hollow Hold 3×20 s · Dead Bug 3×10 je Seite · LS 2×10`
  ),
  d(
    3,
    'main',
    24,
    [12, 12],
    $localize`:@@plan.core-4w.day.3.desc:Beinheben 3×10 · Russian Twist 3×15 · Plank 3×30 s · LS 2×12`
  ),
  d(4, 'rest', 0, undefined, REST_DAY),
  d(
    5,
    'main',
    20,
    [10, 10],
    $localize`:@@plan.core-4w.day.5.desc:Mountain Climbers 3×30 s · Dead Bug 3×12 · Plank 3×35 s · LS 2×10`
  ),
  d(
    6,
    'light',
    14,
    [7, 7],
    $localize`:@@plan.core-4w.day.6.desc:Leichter Tag — Cat-Cow 3×10 · Hip Opener 2 min · 2×7 saubere LS`
  ),
  d(7, 'rest', 0, undefined, REST_DAY),
  // Week 2 — extend holds, add side plank.
  d(
    8,
    'main',
    22,
    [11, 11],
    $localize`:@@plan.core-4w.day.8.desc:Plank 3×40 s · Hollow Hold 3×25 s · Dead Bug 3×12 · LS 2×11`
  ),
  d(
    9,
    'main',
    24,
    [12, 12],
    $localize`:@@plan.core-4w.day.9.desc:Beinheben 3×12 · Russian Twist 3×18 · Plank 3×40 s · LS 2×12`
  ),
  d(10, 'rest', 0, undefined, REST_DAY),
  d(
    11,
    'main',
    24,
    [12, 12],
    $localize`:@@plan.core-4w.day.11.desc:Mountain Climbers 4×30 s · Side Plank 2×25 s je Seite · LS 2×12`
  ),
  d(
    12,
    'light',
    16,
    [8, 8],
    $localize`:@@plan.core-4w.day.12.desc:Leichter Tag — Mobility 10 min · 2×8 LS`
  ),
  d(
    13,
    'main',
    26,
    [13, 13],
    $localize`:@@plan.core-4w.day.13.desc:Core-Zirkel 3 Runden — 40 s Plank · 20 s Hollow Hold · 12 Dead Bugs · 10 LS`
  ),
  d(14, 'rest', 0, undefined, REST_DAY),
  // Week 3 — heavier holds, hanging work.
  d(
    15,
    'main',
    30,
    [15, 15],
    $localize`:@@plan.core-4w.day.15.desc:Plank 3×50 s · Side Plank 3×30 s je Seite · Hollow Hold 3×30 s · LS 2×15`
  ),
  d(
    16,
    'main',
    30,
    [15, 15],
    $localize`:@@plan.core-4w.day.16.desc:Hängendes Knieheben 3×8 · Russian Twist 3×20 · Plank 3×50 s · LS 2×15`
  ),
  d(17, 'rest', 0, undefined, REST_DAY),
  d(
    18,
    'main',
    30,
    [15, 15],
    $localize`:@@plan.core-4w.day.18.desc:Core-Power: Plank 3×60 s · Dead Bug 3×15 · Mountain Climbers 3×45 s · LS 2×15`
  ),
  d(
    19,
    'light',
    18,
    [9, 9],
    $localize`:@@plan.core-4w.day.19.desc:Leichter Tag — 2×9 LS · Stretching 10 min`
  ),
  d(
    20,
    'main',
    30,
    [15, 15],
    $localize`:@@plan.core-4w.day.20.desc:Core-Zirkel 3 Runden — 50 s Plank · 12 Beinheben · 20 Russian Twists · 10 LS`
  ),
  d(21, 'rest', 0, undefined, REST_DAY),
  // Week 4 — peak + test.
  d(
    22,
    'main',
    32,
    [16, 16],
    $localize`:@@plan.core-4w.day.22.desc:Plank 3×60 s · Hollow Hold 3×40 s · Hängendes Knieheben 3×10 · LS 2×16`
  ),
  d(
    23,
    'main',
    32,
    [16, 16],
    $localize`:@@plan.core-4w.day.23.desc:Core-Zirkel 3 Runden — 1 min Plank · 30 Russian Twists · 12 Beinheben · 12 LS`
  ),
  d(24, 'rest', 0, undefined, REST_DAY),
  d(
    25,
    'main',
    32,
    [16, 16],
    $localize`:@@plan.core-4w.day.25.desc:Side Plank 3×40 s je Seite · Dead Bug 3×16 · Hollow Hold 3×40 s · LS 2×16`
  ),
  d(
    26,
    'light',
    18,
    [9, 9],
    $localize`:@@plan.core-4w.day.26.desc:Leichter Tag — 2×9 LS · Mobility`
  ),
  d(27, 'rest', 0, undefined, REST_DAY_PREP_FINAL),
  d(
    28,
    'test',
    30,
    undefined,
    $localize`:@@plan.core-4w.day.28.desc:Endtest: 1 min Plank-Halt · maximale LS · 1 min Hollow Hold`
  ),
];

// HIIT Burner — 4-week intermediate plan. High-intensity intervals
// combining pushups with burpees, mountain climbers, jumping jacks,
// and squats. `targetReps` tracks the pushup portion of each
// interval. Best paired with the 30-day Challenge or the 6-week
// recruit plan as a conditioning block.
const HIIT_BURNER_DAYS: ReadonlyArray<TrainingPlanDay> = [
  // Week 1 — short Tabata-style intervals.
  d(
    1,
    'main',
    30,
    [10, 10, 10],
    $localize`:@@plan.hiit-4w.day.1.desc:HIIT 4 Runden 30/15 s — LS · Burpees · Mountain Climbers · Jumping Jacks`
  ),
  d(2, 'rest', 0, undefined, REST_DAY),
  d(
    3,
    'main',
    30,
    [10, 10, 10],
    $localize`:@@plan.hiit-4w.day.3.desc:HIIT 5 Runden 30/30 s — LS · Burpees · Hampelmänner · Plank`
  ),
  d(
    4,
    'light',
    20,
    [10, 10],
    $localize`:@@plan.hiit-4w.day.4.desc:Aktive Erholung — 15 min Gehen · 2×10 LS · Mobility`
  ),
  d(
    5,
    'main',
    32,
    [12, 10, 10],
    $localize`:@@plan.hiit-4w.day.5.desc:Tabata 8 Runden 20/10 s — LS · Burpees · Mountain Climbers · Jump Squats`
  ),
  d(6, 'rest', 0, undefined, REST_DAY),
  d(7, 'rest', 0, undefined, REST_DAY),
  // Week 2 — longer work intervals.
  d(
    8,
    'main',
    36,
    [12, 12, 12],
    $localize`:@@plan.hiit-4w.day.8.desc:HIIT 5 Runden 40/20 s — LS · Burpees · Mountain Climbers · Squats · Plank`
  ),
  d(9, 'rest', 0, undefined, REST_DAY),
  d(
    10,
    'main',
    36,
    [12, 12, 12],
    $localize`:@@plan.hiit-4w.day.10.desc:HIIT-Ladder 10-9-8-…-1 — LS · Burpees (jede Runde 1 Wiederholung weniger)`
  ),
  d(
    11,
    'light',
    22,
    [11, 11],
    $localize`:@@plan.hiit-4w.day.11.desc:Aktive Erholung — 20 min lockeres Cardio · 2×11 LS`
  ),
  d(
    12,
    'main',
    40,
    [14, 13, 13],
    $localize`:@@plan.hiit-4w.day.12.desc:HIIT 6 Runden 30/15 s — LS · Burpees · Mountain Climbers · Jumping Jacks`
  ),
  d(13, 'rest', 0, undefined, REST_DAY),
  d(14, 'rest', 0, undefined, REST_DAY),
  // Week 3 — pyramid + EMOM.
  d(
    15,
    'main',
    44,
    [11, 11, 11, 11],
    $localize`:@@plan.hiit-4w.day.15.desc:HIIT-Pyramide 1-2-3-4-5-4-3-2-1 — Burpees · LS · Kniebeugen je Stufe`
  ),
  d(16, 'rest', 0, undefined, REST_DAY),
  d(
    17,
    'main',
    48,
    [12, 12, 12, 12],
    $localize`:@@plan.hiit-4w.day.17.desc:HIIT 6 Runden 40/20 s — LS · Burpees · MC · Hampelmänner · Squats · Plank`
  ),
  d(
    18,
    'light',
    24,
    [12, 12],
    $localize`:@@plan.hiit-4w.day.18.desc:Aktive Erholung — Yoga 20 min · 2×12 LS`
  ),
  d(
    19,
    'main',
    52,
    [13, 13, 13, 13],
    $localize`:@@plan.hiit-4w.day.19.desc:Tabata 8 Runden 20/10 s — abwechselnd LS · Burpees · Squats · MC`
  ),
  d(20, 'rest', 0, undefined, REST_DAY),
  d(21, 'rest', 0, undefined, REST_DAY),
  // Week 4 — peak + conditioning test.
  d(
    22,
    'main',
    56,
    [14, 14, 14, 14],
    $localize`:@@plan.hiit-4w.day.22.desc:HIIT-Finale 10 Runden 30/15 s — LS · Burpees · MC · Hampelmänner`
  ),
  d(23, 'rest', 0, undefined, REST_DAY),
  d(
    24,
    'main',
    60,
    [15, 15, 15, 15],
    $localize`:@@plan.hiit-4w.day.24.desc:EMOM 20 min — pro Minute 5 LS · 5 Burpees · 10 Hampelmänner`
  ),
  d(
    25,
    'light',
    26,
    [13, 13],
    $localize`:@@plan.hiit-4w.day.25.desc:Aktive Erholung — Mobility · 2×13 LS`
  ),
  d(26, 'rest', 0, undefined, REST_DAY),
  d(27, 'rest', 0, undefined, REST_DAY_PREP_FINAL),
  d(
    28,
    'test',
    50,
    undefined,
    $localize`:@@plan.hiit-4w.day.28.desc:Konditionstest: 100 LS + 50 Burpees auf Zeit (Bestzeit notieren)`
  ),
];

// Mobility & Recovery — 2-week beginner deload. Daily light pushup
// volume + mobility / yoga / foam rolling work. Designed as a
// recovery block between two hard plans, or as an on-ramp for
// returning after a break.
const MOBILITY_RECOVERY_DAYS: ReadonlyArray<TrainingPlanDay> = [
  d(
    1,
    'light',
    10,
    [10],
    $localize`:@@plan.mobility-2w.day.1.desc:Dynamisches Aufwärmen 10 min · 1×10 saubere LS · 10 min Stretching`
  ),
  d(
    2,
    'light',
    10,
    [10],
    $localize`:@@plan.mobility-2w.day.2.desc:Yoga-Flow 20 min · 1×10 LS · Brust-Stretching`
  ),
  d(
    3,
    'light',
    12,
    [6, 6],
    $localize`:@@plan.mobility-2w.day.3.desc:Cat-Cow 3×10 · Hip Opener 2 min · 2×6 LS · 5 min Foam Rolling`
  ),
  d(
    4,
    'rest',
    0,
    undefined,
    $localize`:@@plan.mobility-2w.day.4.desc:Ruhetag — Foam Rolling 15 min`
  ),
  d(
    5,
    'light',
    12,
    [6, 6],
    $localize`:@@plan.mobility-2w.day.5.desc:Brust-Stretching 5 min · 2×6 LS · 10 min Spaziergang`
  ),
  d(
    6,
    'light',
    14,
    [7, 7],
    $localize`:@@plan.mobility-2w.day.6.desc:Dynamisches Aufwärmen 10 min · 2×7 LS · Schulter-Mobility 5 min`
  ),
  d(7, 'rest', 0, undefined, ACTIVE_RECOVERY),
  d(
    8,
    'light',
    14,
    [7, 7],
    $localize`:@@plan.mobility-2w.day.8.desc:Schulter-Mobility 10 min · 2×7 LS · 10 min Stretching`
  ),
  d(
    9,
    'light',
    16,
    [8, 8],
    $localize`:@@plan.mobility-2w.day.9.desc:Yoga 20 min · 2×8 LS`
  ),
  d(
    10,
    'light',
    16,
    [8, 8],
    $localize`:@@plan.mobility-2w.day.10.desc:Foam Rolling 10 min · 2×8 LS · Hip Opener 5 min`
  ),
  d(
    11,
    'rest',
    0,
    undefined,
    $localize`:@@plan.mobility-2w.day.11.desc:Ruhetag — Stretching nach Bedarf`
  ),
  d(
    12,
    'light',
    18,
    [9, 9],
    $localize`:@@plan.mobility-2w.day.12.desc:Dynamisches Aufwärmen · 2×9 LS · 10 min Mobility`
  ),
  d(
    13,
    'light',
    20,
    [10, 10],
    $localize`:@@plan.mobility-2w.day.13.desc:2×10 LS · 15 min Yoga`
  ),
  d(
    14,
    'light',
    20,
    [10, 10],
    $localize`:@@plan.mobility-2w.day.14.desc:Form-Check: 2×10 saubere LS · vollständige Mobility-Session 20 min`
  ),
];

export const TRAINING_PLANS: ReadonlyArray<TrainingPlan> = [
  {
    id: 'recruit-6w-v1',
    slug: 'recruit-6w',
    title: $localize`:@@plan.recruit-6w.title:Von 0 auf 100 — 6-Wochen-Aufbau`,
    summary: $localize`:@@plan.recruit-6w.summary:Strukturierter Plan für Einsteiger: drei Trainingstage pro Woche, progressive Belastungssteigerung und ein Endtest in Woche 6.`,
    level: 'beginner',
    totalDays: 42,
    blogSlug: $localize`:@@plan.recruit-6w.blogSlug:liegestuetze-steigern`,
    days: RECRUIT_DAYS,
  },
  {
    id: 'challenge-30d-v1',
    slug: 'challenge-30d',
    title: $localize`:@@plan.challenge-30d.title:30-Tage-Challenge`,
    summary: $localize`:@@plan.challenge-30d.summary:Dreißig Tage tägliches Training mit gezielten Ruhetagen. Tag 1 ist der Maximaltest, Tag 30 der Endtest.`,
    level: 'intermediate',
    totalDays: 30,
    blogSlug: $localize`:@@plan.challenge-30d.blogSlug:30-tage-liegestuetze-challenge`,
    days: CHALLENGE_30_DAYS,
  },
  {
    id: 'over-40-4w-v1',
    slug: 'over-40-4w',
    title: $localize`:@@plan.over-40-4w.title:Liegestütze ab 40 — 4-Wochen-Plan`,
    summary: $localize`:@@plan.over-40-4w.summary:Schonender 4-Wochen-Plan für Einsteiger ab 40: Fokus auf saubere Technik, ausreichend Pause und langsames Tempo.`,
    level: 'beginner',
    totalDays: 28,
    blogSlug: $localize`:@@plan.over-40-4w.blogSlug:liegestuetze-ab-40`,
    days: OVER_40_DAYS,
  },
  {
    id: 'daily-100-30d-v1',
    slug: 'daily-100-30d',
    title: $localize`:@@plan.daily-100-30d.title:Daily 100 — 30 Tage zur 100er-Marke`,
    summary: $localize`:@@plan.daily-100-30d.summary:30-Tage-Volumenplan: ramp-up von 50 auf 100 saubere Wiederholungen pro Einheit, danach zwei Wochen Konsolidierung. 5 Trainingstage + 1 leichter + 1 Ruhetag pro Woche.`,
    level: 'intermediate',
    totalDays: 30,
    days: DAILY_100_DAYS,
  },
  {
    id: 'one-arm-12w-v1',
    slug: 'one-arm-12w',
    title: $localize`:@@plan.one-arm-12w.title:Einarmige Liegestütze — 12-Wochen-Aufbau`,
    summary: $localize`:@@plan.one-arm-12w.summary:Vier-Phasen-Plan in Richtung saubere einarmige Liegestütze: Archer und Wand-Negativen, Bank-Negativen, partielle Einarmige, schließlich volle Einarmige im weiten Stand. 4 aktive Tage + 3 Ruhetage pro Woche.`,
    level: 'advanced',
    totalDays: 84,
    days: ONE_ARM_DAYS,
  },
  {
    id: 'push-pull-6w-v1',
    slug: 'push-pull-6w',
    title: $localize`:@@plan.push-pull-6w.title:Push & Pull Balance — 6-Wochen-Plan`,
    summary: $localize`:@@plan.push-pull-6w.summary:Symmetrischer 6-Wochen-Plan für Liegestütze und Rückenübungen (Rudern, Klimmzug-Negative, Face Pulls). Vermeidet das klassische "nur Push"-Ungleichgewicht und stärkt die hintere Kette gleichwertig. Pull-Tag pro Woche zusätzlich zur Push-Progression.`,
    level: 'intermediate',
    totalDays: 42,
    days: PUSH_PULL_BALANCE_DAYS,
  },
  {
    id: 'full-body-6w-v1',
    slug: 'full-body-6w',
    title: $localize`:@@plan.full-body-6w.title:Full Body Strong — 6-Wochen-Ganzkörperplan`,
    summary: $localize`:@@plan.full-body-6w.summary:Sechs Wochen Ganzkörper-Zirkel: Liegestütze, Kniebeugen, Ausfallschritte, Glute Bridges und Plank in 3-, 4- und 5-Runden-Zirkeln. Drei Trainingstage pro Woche, klar steigende Volumen, funktioneller Endtest in Woche 6.`,
    level: 'intermediate',
    totalDays: 42,
    days: FULL_BODY_DAYS,
  },
  {
    id: 'core-4w-v1',
    slug: 'core-4w',
    title: $localize`:@@plan.core-4w.title:Core Foundations — 4-Wochen-Rumpfplan`,
    summary: $localize`:@@plan.core-4w.summary:Vier Wochen Rumpfstabilität: Plank, Hollow Hold, Dead Bug, Beinheben und Rotation. Pro Trainingstag eine moderate Liegestütze-Aktivierung. Vier Trainingstage und ein leichter Tag pro Woche, Endtest mit Plank-Halt und Hollow Hold.`,
    level: 'beginner',
    totalDays: 28,
    days: CORE_FOUNDATIONS_DAYS,
  },
  {
    id: 'hiit-4w-v1',
    slug: 'hiit-4w',
    title: $localize`:@@plan.hiit-4w.title:HIIT Burner — 4-Wochen-Konditionsplan`,
    summary: $localize`:@@plan.hiit-4w.summary:Vier Wochen hochintensives Intervalltraining mit Liegestützen, Burpees, Mountain Climbers, Hampelmännern und Kniebeugen. Tabata, Pyramide und EMOM-Strukturen. Eignet sich als Konditions-Booster zwischen klassischen Liegestütze-Plänen.`,
    level: 'intermediate',
    totalDays: 28,
    days: HIIT_BURNER_DAYS,
  },
  {
    id: 'mobility-2w-v1',
    slug: 'mobility-2w',
    title: $localize`:@@plan.mobility-2w.title:Mobility & Recovery — 2-Wochen-Deload`,
    summary: $localize`:@@plan.mobility-2w.summary:Zwei Wochen aktive Erholung: tägliche Mobility-, Yoga- und Stretching-Einheiten mit leichtem Liegestütze-Volumen. Ideal als Deload zwischen zwei harten Plänen oder zum Wiedereinstieg nach einer Trainingspause.`,
    level: 'beginner',
    totalDays: 14,
    days: MOBILITY_RECOVERY_DAYS,
  },
];

const PLANS_BY_ID: ReadonlyMap<string, TrainingPlan> = new Map(
  TRAINING_PLANS.map((plan) => [plan.id, plan])
);

const PLANS_BY_SLUG: ReadonlyMap<string, TrainingPlan> = new Map(
  TRAINING_PLANS.map((plan) => [plan.slug, plan])
);

export function findPlanById(id: string): TrainingPlan | null {
  return PLANS_BY_ID.get(id) ?? null;
}

export function findPlanBySlug(slug: string): TrainingPlan | null {
  return PLANS_BY_SLUG.get(slug) ?? null;
}

export function plansByLevel(level: TrainingPlanLevel): TrainingPlan[] {
  return TRAINING_PLANS.filter((p) => p.level === level);
}

function d(
  dayIndex: number,
  kind: TrainingPlanDay['kind'],
  targetReps: number,
  sets: number[] | undefined,
  description: string
): TrainingPlanDay {
  return sets
    ? { dayIndex, kind, targetReps, sets, description }
    : { dayIndex, kind, targetReps, description };
}
