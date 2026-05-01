import {
  TrainingPlan,
  TrainingPlanDay,
  TrainingPlanLevel,
} from './training-plan.models';

/**
 * Curated training plans, derived from existing blog articles in
 * `web/src/app/blog/blog-posts.data.ts`. The numeric targets are
 * absolute baselines suitable for the stated audience — users whose
 * current max differs significantly should treat them as anchors and
 * adjust by `±20%`.
 */

const RECRUIT_DAYS: ReadonlyArray<TrainingPlanDay> = [
  // Week 1 (Mon–Sun) — 3× full reps with 90s rest. Targets are
  // suitable for someone whose max is roughly 10–15 reps.
  d(
    1,
    'main',
    30,
    [10, 10, 10],
    '3×10 saubere Liegestütze, 90 s Pause',
    '3×10 clean push-ups, 90 s rest'
  ),
  d(
    2,
    'rest',
    0,
    undefined,
    'Ruhetag — Stretching, Mobility',
    'Rest day — stretching, mobility'
  ),
  d(
    3,
    'main',
    33,
    [12, 11, 10],
    '3×AMRAP, 90 s Pause (Ziel ≈12-11-10)',
    '3×AMRAP, 90 s rest (target ≈12-11-10)'
  ),
  d(4, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(5, 'main', 36, [13, 12, 11], '3×AMRAP, 90 s Pause', '3×AMRAP, 90 s rest'),
  d(
    6,
    'light',
    20,
    [10, 10],
    'Leichter Tag — 50 % vom Maximum',
    'Light day — 50% of max'
  ),
  d(7, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 2 — same scheme, +10% volume.
  d(8, 'main', 36, [13, 12, 11], '3×AMRAP', '3×AMRAP'),
  d(9, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(10, 'main', 39, [14, 13, 12], '3×AMRAP', '3×AMRAP'),
  d(11, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(12, 'main', 42, [15, 14, 13], '3×AMRAP', '3×AMRAP'),
  d(13, 'light', 22, [11, 11], 'Leichter Tag', 'Light day'),
  d(14, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 3 — 4 sets, shorter rest (60s).
  d(
    15,
    'main',
    48,
    [14, 12, 12, 10],
    '4×AMRAP, 60 s Pause',
    '4×AMRAP, 60 s rest'
  ),
  d(16, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    17,
    'main',
    52,
    [15, 13, 12, 12],
    '4×AMRAP, 60 s Pause',
    '4×AMRAP, 60 s rest'
  ),
  d(18, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    19,
    'main',
    56,
    [16, 14, 13, 13],
    '4×AMRAP, 60 s Pause',
    '4×AMRAP, 60 s rest'
  ),
  d(20, 'light', 24, [12, 12], 'Leichter Tag', 'Light day'),
  d(21, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 4 — 4 sets, slightly higher reps.
  d(22, 'main', 60, [17, 15, 14, 14], '4×AMRAP', '4×AMRAP'),
  d(23, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(24, 'main', 64, [18, 16, 15, 15], '4×AMRAP', '4×AMRAP'),
  d(25, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(26, 'main', 68, [19, 17, 16, 16], '4×AMRAP', '4×AMRAP'),
  d(27, 'light', 26, [13, 13], 'Leichter Tag', 'Light day'),
  d(28, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 5 — 5 sets, target reps (descending).
  d(
    29,
    'main',
    64,
    [15, 14, 13, 12, 10],
    '5 Sätze Zielwiederholungen',
    '5 sets target reps'
  ),
  d(30, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    31,
    'main',
    68,
    [16, 15, 14, 13, 10],
    '5 Sätze Zielwiederholungen',
    '5 sets target reps'
  ),
  d(32, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    33,
    'main',
    72,
    [17, 16, 15, 14, 10],
    '5 Sätze Zielwiederholungen',
    '5 sets target reps'
  ),
  d(34, 'light', 28, [14, 14], 'Leichter Tag', 'Light day'),
  d(35, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 6 — peak + final test.
  d(
    36,
    'main',
    76,
    [18, 17, 16, 14, 11],
    '5 Sätze, volle Bewegungsamplitude',
    '5 sets, full range of motion'
  ),
  d(37, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    38,
    'main',
    80,
    [19, 18, 16, 14, 13],
    '5 Sätze, kontrolliertes Tempo',
    '5 sets, controlled tempo'
  ),
  d(
    39,
    'rest',
    0,
    undefined,
    'Ruhetag — Vorbereitung Endtest',
    'Rest day — prepare for final test'
  ),
  d(40, 'main', 84, [20, 18, 17, 15, 14], '5 Sätze leicht', '5 sets light'),
  d(41, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    42,
    'test',
    100,
    undefined,
    'Endtest: Maximale Liegestütze ohne Pause',
    'Final test: max push-ups without stopping'
  ),
];

const CHALLENGE_30_DAYS: ReadonlyArray<TrainingPlanDay> = [
  // Week 1 — Foundation. 3× AMRAP @ 90s on main days; light = 50% max.
  d(
    1,
    'test',
    0,
    undefined,
    'Maximaltest — als Ausgangswert eintragen',
    'Max test — log as your baseline'
  ),
  d(2, 'main', 60, [20, 20, 20], '3×AMRAP, 90 s Pause', '3×AMRAP, 90 s rest'),
  d(
    3,
    'light',
    20,
    [10, 10],
    'Leichter Tag — 2×50 % vom Maximum',
    'Light day — 2×50% of max'
  ),
  d(4, 'main', 63, [22, 21, 20], '3×AMRAP, 90 s Pause', '3×AMRAP, 90 s rest'),
  d(5, 'light', 22, [11, 11], 'Leichter Tag', 'Light day'),
  d(6, 'main', 66, [23, 22, 21], '3×AMRAP, 90 s Pause', '3×AMRAP, 90 s rest'),
  d(7, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 2 — Volume. 4× AMRAP @ 60s; light = 60% max.
  d(
    8,
    'main',
    80,
    [22, 20, 19, 19],
    '4×AMRAP, 60 s Pause',
    '4×AMRAP, 60 s rest'
  ),
  d(
    9,
    'light',
    30,
    [10, 10, 10],
    'Leichter Tag — 3×60 % vom Maximum',
    'Light day — 3×60% of max'
  ),
  d(
    10,
    'main',
    84,
    [23, 21, 20, 20],
    '4×AMRAP, 60 s Pause',
    '4×AMRAP, 60 s rest'
  ),
  d(11, 'light', 33, [11, 11, 11], 'Leichter Tag', 'Light day'),
  d(
    12,
    'main',
    88,
    [24, 22, 21, 21],
    '4×AMRAP, 60 s Pause',
    '4×AMRAP, 60 s rest'
  ),
  d(13, 'light', 36, [12, 12, 12], 'Leichter Tag', 'Light day'),
  d(14, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 3 — Intensity. 5× target reps (~80% max). No light days.
  d(
    15,
    'main',
    100,
    [22, 20, 20, 20, 18],
    '5 Sätze à ~80 % vom Maximum',
    '5 sets at ~80% of max'
  ),
  d(
    16,
    'rest',
    0,
    undefined,
    'Mobility & Brust-Stretching',
    'Mobility & chest stretching'
  ),
  d(
    17,
    'main',
    105,
    [23, 22, 20, 20, 20],
    '5 Sätze Zielwiederholungen',
    '5 sets target reps'
  ),
  d(
    18,
    'rest',
    0,
    undefined,
    'Mobility & Brust-Stretching',
    'Mobility & chest stretching'
  ),
  d(
    19,
    'main',
    110,
    [24, 22, 22, 22, 20],
    '5 Sätze Zielwiederholungen',
    '5 sets target reps'
  ),
  d(
    20,
    'rest',
    0,
    undefined,
    'Mobility & Brust-Stretching',
    'Mobility & chest stretching'
  ),
  d(
    21,
    'main',
    115,
    [25, 23, 23, 22, 22],
    '5 Sätze Zielwiederholungen',
    '5 sets target reps'
  ),
  // Week 4 — Tapering & Peak. 3× 70% max, last 2 days active recovery.
  d(
    22,
    'main',
    70,
    [25, 23, 22],
    '3 Sätze à 70 % — Qualität vor Quantität',
    '3 sets at 70% — quality over quantity'
  ),
  d(23, 'light', 30, [15, 15], 'Leichter Tag — 2×50 %', 'Light day — 2×50%'),
  d(24, 'main', 75, [26, 25, 24], '3 Sätze à 70 %', '3 sets at 70%'),
  d(25, 'light', 30, [15, 15], 'Leichter Tag — 2×50 %', 'Light day — 2×50%'),
  d(26, 'main', 75, [26, 25, 24], '3 Sätze à 70 %', '3 sets at 70%'),
  d(
    27,
    'rest',
    0,
    undefined,
    'Aktive Erholung — Spaziergang, Mobility',
    'Active recovery — walk, mobility'
  ),
  d(28, 'rest', 0, undefined, 'Aktive Erholung', 'Active recovery'),
  d(
    29,
    'rest',
    0,
    undefined,
    'Ruhe vor dem Endtest',
    'Rest before the final test'
  ),
  d(
    30,
    'test',
    100,
    undefined,
    'Endtest: Maximale Liegestütze ohne Pause',
    'Final test: max push-ups without stopping'
  ),
];

const OVER_40_DAYS: ReadonlyArray<TrainingPlanDay> = [
  // Week 1 — Technique focus, low volume.
  d(
    1,
    'test',
    0,
    undefined,
    'Maximaltest mit sauberer Technik',
    'Max test with clean form'
  ),
  d(
    2,
    'main',
    24,
    [8, 8, 8],
    '3×8 Knie- oder erhöhte Liegestütze',
    '3×8 knee or elevated push-ups'
  ),
  d(3, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(4, 'main', 27, [9, 9, 9], '3×9 saubere Liegestütze', '3×9 clean push-ups'),
  d(
    5,
    'rest',
    0,
    undefined,
    'Ruhetag — Schulter-Mobility',
    'Rest day — shoulder mobility'
  ),
  d(
    6,
    'main',
    30,
    [10, 10, 10],
    '3×10 saubere Liegestütze',
    '3×10 clean push-ups'
  ),
  d(7, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 2 — slight volume increase.
  d(8, 'main', 33, [11, 11, 11], '3×11', '3×11'),
  d(9, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(10, 'main', 36, [12, 12, 12], '3×12', '3×12'),
  d(11, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(12, 'main', 39, [13, 13, 13], '3×13', '3×13'),
  d(13, 'light', 16, [8, 8], 'Leichter Tag', 'Light day'),
  d(14, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 3 — 4 sets, more volume but still 90s rest.
  d(
    15,
    'main',
    48,
    [13, 12, 12, 11],
    '4 Sätze, 90 s Pause',
    '4 sets, 90 s rest'
  ),
  d(16, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    17,
    'main',
    52,
    [14, 13, 13, 12],
    '4 Sätze, 90 s Pause',
    '4 sets, 90 s rest'
  ),
  d(18, 'rest', 0, undefined, 'Ruhetag — Mobility', 'Rest day — mobility'),
  d(
    19,
    'main',
    56,
    [15, 14, 14, 13],
    '4 Sätze, 90 s Pause',
    '4 sets, 90 s rest'
  ),
  d(20, 'light', 18, [9, 9], 'Leichter Tag', 'Light day'),
  d(21, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 4 — peak + final test (still gentle volume).
  d(
    22,
    'main',
    60,
    [16, 15, 15, 14],
    '4 Sätze, kontrolliertes Tempo',
    '4 sets, controlled tempo'
  ),
  d(23, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    24,
    'main',
    64,
    [17, 16, 16, 15],
    '4 Sätze, langsame Exzentrik',
    '4 sets, slow eccentric'
  ),
  d(25, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(26, 'light', 20, [10, 10], 'Leichter Tag', 'Light day'),
  d(
    27,
    'rest',
    0,
    undefined,
    'Ruhetag — Vorbereitung Endtest',
    'Rest day — prepare final test'
  ),
  d(
    28,
    'test',
    50,
    undefined,
    'Endtest: Maximale Liegestütze',
    'Final test: max push-ups'
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
    'Baseline-Test: maximale Wiederholungen in einem Satz',
    'Baseline test: max reps in a single set'
  ),
  d(
    2,
    'main',
    50,
    [10, 10, 10, 10, 10],
    '5×10 saubere Wiederholungen, 60 s Pause',
    '5×10 clean reps, 60 s rest'
  ),
  d(3, 'main', 60, [12, 12, 12, 12, 12], '5×12, 60 s Pause', '5×12, 60 s rest'),
  d(4, 'main', 60, [12, 12, 12, 12, 12], '5×12, 60 s Pause', '5×12, 60 s rest'),
  d(5, 'main', 70, [14, 14, 14, 14, 14], '5×14, 60 s Pause', '5×14, 60 s rest'),
  d(
    6,
    'light',
    30,
    [15, 15],
    'Leichter Tag — 2×15 in lockerem Tempo',
    'Light day — 2×15 at easy pace'
  ),
  d(7, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 2 — push to 100 reps daily.
  d(8, 'main', 80, [16, 16, 16, 16, 16], '5×16', '5×16'),
  d(9, 'main', 80, [16, 16, 16, 16, 16], '5×16', '5×16'),
  d(10, 'main', 90, [18, 18, 18, 18, 18], '5×18', '5×18'),
  d(11, 'main', 90, [18, 18, 18, 18, 18], '5×18', '5×18'),
  d(
    12,
    'main',
    100,
    [20, 20, 20, 20, 20],
    'Erstes Hundert: 5×20',
    'First hundred: 5×20'
  ),
  d(13, 'light', 40, [20, 20], 'Leichter Tag', 'Light day'),
  d(14, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 3 — consolidate at 100, vary set count.
  d(
    15,
    'main',
    100,
    [25, 25, 25, 25],
    '4×25 (weniger Sätze, mehr Wiederholungen)',
    '4×25 (fewer sets, more reps)'
  ),
  d(16, 'main', 100, [20, 20, 20, 20, 20], '5×20', '5×20'),
  d(17, 'main', 100, [25, 25, 25, 25], '4×25', '4×25'),
  d(18, 'main', 100, [20, 20, 20, 20, 20], '5×20', '5×20'),
  d(
    19,
    'main',
    100,
    [25, 25, 25, 25],
    '4×25 — Tempo bewusst verlangsamen',
    '4×25 — slow tempo intentionally'
  ),
  d(20, 'light', 40, [20, 20], 'Leichter Tag', 'Light day'),
  d(21, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 4 — maintenance + taper to final test.
  d(22, 'main', 100, [20, 20, 20, 20, 20], '5×20', '5×20'),
  d(23, 'main', 100, [25, 25, 25, 25], '4×25', '4×25'),
  d(24, 'main', 100, [20, 20, 20, 20, 20], '5×20', '5×20'),
  d(25, 'main', 100, [25, 25, 25, 25], '4×25', '4×25'),
  d(
    26,
    'main',
    100,
    [20, 20, 20, 20, 20],
    'Letzter 100er-Tag vor dem Test',
    'Last 100-rep day before the test'
  ),
  d(
    27,
    'light',
    40,
    [20, 20],
    'Leichter Tag — Form-Check',
    'Light day — form check'
  ),
  d(28, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    29,
    'rest',
    0,
    undefined,
    'Ruhetag — Vorbereitung auf den Endtest',
    'Rest day — prepare for final test'
  ),
  d(
    30,
    'test',
    100,
    undefined,
    'Endtest: Maximale saubere Wiederholungen in einem Satz',
    'Final test: max clean reps in a single set'
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
  d(1, 'main', 18, [6, 6, 6], 'Archer-Liegestütze 3×6', 'Archer push-ups 3×6'),
  d(2, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    3,
    'main',
    30,
    [10, 10, 10],
    'Wand-Einarmige 3×10 (langsame Exzentrik)',
    'Wall one-arm 3×10 (slow eccentric)'
  ),
  d(4, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    5,
    'main',
    60,
    [20, 20, 20],
    'Standard-Liegestütze 3×20 (Volumen)',
    'Standard push-ups 3×20 (volume)'
  ),
  d(6, 'light', 20, [10, 10], 'Leichter Tag 2×10', 'Light day 2×10'),
  d(7, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 2
  d(8, 'main', 24, [8, 8, 8], 'Archer 3×8', 'Archer 3×8'),
  d(9, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(10, 'main', 36, [12, 12, 12], 'Wand-Einarmige 3×12', 'Wall one-arm 3×12'),
  d(11, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(12, 'main', 66, [22, 22, 22], 'Standard 3×22', 'Standard 3×22'),
  d(13, 'light', 24, [12, 12], 'Leichter Tag 2×12', 'Light day 2×12'),
  d(14, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 3
  d(
    15,
    'main',
    30,
    [10, 10, 10],
    'Archer 3×10 — Phase 1 abschließen',
    'Archer 3×10 — close out phase 1'
  ),
  d(16, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(17, 'main', 45, [15, 15, 15], 'Wand-Einarmige 3×15', 'Wall one-arm 3×15'),
  d(18, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(19, 'main', 75, [25, 25, 25], 'Standard 3×25', 'Standard 3×25'),
  d(20, 'light', 28, [14, 14], 'Leichter Tag 2×14', 'Light day 2×14'),
  d(21, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // ─── Phase 2 ────────────────────────────────────────────────
  // Week 4
  d(
    22,
    'main',
    15,
    [5, 5, 5],
    'Negative Einarmige von Bank 3×5 (3 s runter)',
    'Negative one-arm from bench 3×5 (3 s down)'
  ),
  d(23, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    24,
    'main',
    18,
    [6, 6, 6],
    'Langsame Archer 3×6 (Tempo 3-1-1)',
    'Slow archer 3×6 (tempo 3-1-1)'
  ),
  d(25, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    26,
    'main',
    60,
    [20, 20, 20],
    'Weite Liegestütze 3×20 (Brust-Volumen)',
    'Wide push-ups 3×20 (chest volume)'
  ),
  d(27, 'light', 20, [10, 10], 'Leichter Tag', 'Light day'),
  d(28, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 5
  d(
    29,
    'main',
    15,
    [5, 5, 5],
    'Negative Einarmige 3×5',
    'Negative one-arm 3×5'
  ),
  d(30, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(31, 'main', 21, [7, 7, 7], 'Langsame Archer 3×7', 'Slow archer 3×7'),
  d(32, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    33,
    'main',
    60,
    [20, 20, 20],
    'Weite Liegestütze 3×20',
    'Wide push-ups 3×20'
  ),
  d(34, 'light', 22, [11, 11], 'Leichter Tag 2×11', 'Light day 2×11'),
  d(35, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 6
  d(
    36,
    'main',
    18,
    [6, 6, 6],
    'Negative Einarmige 3×6',
    'Negative one-arm 3×6'
  ),
  d(37, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    38,
    'main',
    24,
    [8, 8, 8],
    'Langsame Archer 3×8 — Phase 2 abschließen',
    'Slow archer 3×8 — close out phase 2'
  ),
  d(39, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    40,
    'main',
    65,
    [22, 22, 21],
    'Weite Liegestütze 3×~22',
    'Wide push-ups 3×~22'
  ),
  d(41, 'light', 24, [12, 12], 'Leichter Tag', 'Light day'),
  d(42, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // ─── Phase 3 ────────────────────────────────────────────────
  // Week 7
  d(
    43,
    'main',
    12,
    [4, 4, 4],
    'Partielle Einarmige (niedrige Bank) 3×4',
    'Partial one-arm (low bench) 3×4'
  ),
  d(44, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    45,
    'main',
    18,
    [6, 6, 6],
    'Archer mit langem Tempo 3×6',
    'Archer with long tempo 3×6'
  ),
  d(46, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    47,
    'main',
    36,
    [12, 12, 12],
    'Diamant-Liegestütze 3×12 (Trizeps-Volumen)',
    'Diamond push-ups 3×12 (triceps volume)'
  ),
  d(48, 'light', 20, [10, 10], 'Leichter Tag', 'Light day'),
  d(49, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 8
  d(
    50,
    'main',
    12,
    [4, 4, 4],
    'Partielle Einarmige 3×4',
    'Partial one-arm 3×4'
  ),
  d(51, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(52, 'main', 18, [6, 6, 6], 'Archer mit Tempo 3×6', 'Tempo archer 3×6'),
  d(53, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(54, 'main', 39, [13, 13, 13], 'Diamant 3×13', 'Diamond 3×13'),
  d(55, 'light', 22, [11, 11], 'Leichter Tag', 'Light day'),
  d(56, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 9
  d(
    57,
    'main',
    15,
    [5, 5, 5],
    'Partielle Einarmige 3×5 — Phase 3 abschließen',
    'Partial one-arm 3×5 — close out phase 3'
  ),
  d(58, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(59, 'main', 21, [7, 7, 7], 'Tempo-Archer 3×7', 'Tempo archer 3×7'),
  d(60, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(61, 'main', 39, [13, 13, 13], 'Diamant 3×13', 'Diamond 3×13'),
  d(62, 'light', 24, [12, 12], 'Leichter Tag', 'Light day'),
  d(63, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // ─── Phase 4 ────────────────────────────────────────────────
  // Week 10
  d(
    64,
    'main',
    9,
    [3, 3, 3],
    'Volle Einarmige (weiter Stand) 3×3',
    'Full one-arm (wide stance) 3×3'
  ),
  d(65, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    66,
    'main',
    12,
    [4, 4, 4],
    'Einarmige (etwas engerer Stand) 3×4',
    'One-arm (slightly narrower stance) 3×4'
  ),
  d(67, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(68, 'main', 75, [25, 25, 25], 'Standard 3×25', 'Standard 3×25'),
  d(69, 'light', 20, [10, 10], 'Leichter Tag', 'Light day'),
  d(70, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 11
  d(71, 'main', 9, [3, 3, 3], 'Volle Einarmige 3×3', 'Full one-arm 3×3'),
  d(72, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    73,
    'main',
    15,
    [5, 5, 5],
    'Einarmige enger Stand 3×5',
    'One-arm narrower stance 3×5'
  ),
  d(74, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(75, 'main', 75, [25, 25, 25], 'Standard 3×25', 'Standard 3×25'),
  d(76, 'light', 22, [11, 11], 'Leichter Tag', 'Light day'),
  d(77, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 12 — taper toward final test.
  d(
    78,
    'main',
    9,
    [3, 3, 3],
    'Letzte schwere Einheit 3×3',
    'Final heavy session 3×3'
  ),
  d(79, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    80,
    'light',
    8,
    [4, 4],
    'Technik-Taper 2×4 saubere Wiederholungen',
    'Technique taper 2×4 clean reps'
  ),
  d(81, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(
    82,
    'light',
    6,
    [3, 3],
    'Mobility + 2×3 leichte Wiederholungen',
    'Mobility + 2×3 light reps'
  ),
  d(
    83,
    'rest',
    0,
    undefined,
    'Ruhetag — bereit für Endtest',
    'Rest day — ready for final'
  ),
  d(
    84,
    'test',
    5,
    undefined,
    'Endtest: maximale saubere einarmige Liegestütze pro Seite',
    'Final test: max clean one-arm push-ups per side'
  ),
];

export const TRAINING_PLANS: ReadonlyArray<TrainingPlan> = [
  {
    id: 'recruit-6w-v1',
    slug: 'recruit-6w',
    title: 'Von 0 auf 100 — 6-Wochen-Aufbau',
    titleEn: 'From 0 to 100 — 6-week buildup',
    summary:
      'Strukturierter Plan für Einsteiger: drei Trainingstage pro Woche, progressive Belastungssteigerung und ein Endtest in Woche 6.',
    summaryEn:
      'Beginner-friendly plan: three training days per week, progressive overload, and a final max test in week 6.',
    level: 'beginner',
    totalDays: 42,
    blogSlugDe: 'liegestuetze-steigern',
    blogSlugEn: 'pushup-progression',
    days: RECRUIT_DAYS,
  },
  {
    id: 'challenge-30d-v1',
    slug: 'challenge-30d',
    title: '30-Tage-Challenge',
    titleEn: '30-day challenge',
    summary:
      'Dreißig Tage tägliches Training mit gezielten Ruhetagen. Tag 1 ist der Maximaltest, Tag 30 der Endtest.',
    summaryEn:
      'Thirty days of daily training with strategic rest days. Day 1 is the baseline test, Day 30 the final.',
    level: 'intermediate',
    totalDays: 30,
    blogSlugDe: '30-tage-liegestuetze-challenge',
    blogSlugEn: '30-day-pushup-challenge',
    days: CHALLENGE_30_DAYS,
  },
  {
    id: 'over-40-4w-v1',
    slug: 'over-40-4w',
    title: 'Liegestütze ab 40 — 4-Wochen-Plan',
    titleEn: 'Push-ups after 40 — 4-week plan',
    summary:
      'Schonender 4-Wochen-Plan für Einsteiger ab 40: Fokus auf saubere Technik, ausreichend Pause und langsames Tempo.',
    summaryEn:
      'Gentle 4-week plan for beginners 40+: focus on clean technique, full recovery, and controlled tempo.',
    level: 'beginner',
    totalDays: 28,
    blogSlugDe: 'liegestuetze-ab-40',
    blogSlugEn: 'pushups-over-40',
    days: OVER_40_DAYS,
  },
  {
    id: 'daily-100-30d-v1',
    slug: 'daily-100-30d',
    title: 'Daily 100 — 30 Tage zur 100er-Marke',
    titleEn: 'Daily 100 — 30 days to the 100-rep mark',
    summary:
      '30-Tage-Volumenplan: ramp-up von 50 auf 100 saubere Wiederholungen pro Einheit, danach zwei Wochen Konsolidierung. 5 Trainingstage + 1 leichter + 1 Ruhetag pro Woche.',
    summaryEn:
      '30-day volume plan: ramp from 50 to 100 clean reps per session, then two weeks of consolidation. 5 training days + 1 light + 1 rest per week.',
    level: 'intermediate',
    totalDays: 30,
    days: DAILY_100_DAYS,
  },
  {
    id: 'one-arm-12w-v1',
    slug: 'one-arm-12w',
    title: 'Einarmige Liegestütze — 12-Wochen-Aufbau',
    titleEn: 'One-arm push-up — 12-week buildup',
    summary:
      'Vier-Phasen-Plan in Richtung saubere einarmige Liegestütze: Archer und Wand-Negativen, Bank-Negativen, partielle Einarmige, schließlich volle Einarmige im weiten Stand. 4 aktive Tage + 3 Ruhetage pro Woche.',
    summaryEn:
      'Four-phase progression toward a clean one-arm push-up: archer + wall negatives, bench negatives, partial-ROM one-arm, then full-ROM at wide stance. 4 active days + 3 rest days per week.',
    level: 'advanced',
    totalDays: 84,
    days: ONE_ARM_DAYS,
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
  description: string,
  descriptionEn: string
): TrainingPlanDay {
  return sets
    ? { dayIndex, kind, targetReps, sets, description, descriptionEn }
    : { dayIndex, kind, targetReps, description, descriptionEn };
}
