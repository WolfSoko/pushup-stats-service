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
  d(1, 'main', 30, [10, 10, 10], '3×10 saubere Liegestütze, 90 s Pause', '3×10 clean push-ups, 90 s rest'),
  d(2, 'rest', 0, undefined, 'Ruhetag — Stretching, Mobility', 'Rest day — stretching, mobility'),
  d(3, 'main', 33, [12, 11, 10], '3×AMRAP, 90 s Pause (Ziel ≈12-11-10)', '3×AMRAP, 90 s rest (target ≈12-11-10)'),
  d(4, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(5, 'main', 36, [13, 12, 11], '3×AMRAP, 90 s Pause', '3×AMRAP, 90 s rest'),
  d(6, 'light', 20, [10, 10], 'Leichter Tag — 50 % vom Maximum', 'Light day — 50% of max'),
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
  d(15, 'main', 48, [14, 12, 12, 10], '4×AMRAP, 60 s Pause', '4×AMRAP, 60 s rest'),
  d(16, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(17, 'main', 52, [15, 13, 12, 12], '4×AMRAP, 60 s Pause', '4×AMRAP, 60 s rest'),
  d(18, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(19, 'main', 56, [16, 14, 13, 13], '4×AMRAP, 60 s Pause', '4×AMRAP, 60 s rest'),
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
  d(29, 'main', 64, [15, 14, 13, 12, 10], '5 Sätze Zielwiederholungen', '5 sets target reps'),
  d(30, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(31, 'main', 68, [16, 15, 14, 13, 10], '5 Sätze Zielwiederholungen', '5 sets target reps'),
  d(32, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(33, 'main', 72, [17, 16, 15, 14, 10], '5 Sätze Zielwiederholungen', '5 sets target reps'),
  d(34, 'light', 28, [14, 14], 'Leichter Tag', 'Light day'),
  d(35, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 6 — peak + final test.
  d(36, 'main', 76, [18, 17, 16, 14, 11], '5 Sätze, volle Bewegungsamplitude', '5 sets, full range of motion'),
  d(37, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(38, 'main', 80, [19, 18, 16, 14, 13], '5 Sätze, kontrolliertes Tempo', '5 sets, controlled tempo'),
  d(39, 'rest', 0, undefined, 'Ruhetag — Vorbereitung Endtest', 'Rest day — prepare for final test'),
  d(40, 'main', 84, [20, 18, 17, 15, 14], '5 Sätze leicht', '5 sets light'),
  d(41, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(42, 'test', 100, undefined, 'Endtest: Maximale Liegestütze ohne Pause', 'Final test: max push-ups without stopping'),
];

const CHALLENGE_30_DAYS: ReadonlyArray<TrainingPlanDay> = [
  // Week 1 — Foundation. 3× AMRAP @ 90s on main days; light = 50% max.
  d(1, 'test', 0, undefined, 'Maximaltest — als Ausgangswert eintragen', 'Max test — log as your baseline'),
  d(2, 'main', 60, [20, 20, 20], '3×AMRAP, 90 s Pause', '3×AMRAP, 90 s rest'),
  d(3, 'light', 20, [10, 10], 'Leichter Tag — 2×50 % vom Maximum', 'Light day — 2×50% of max'),
  d(4, 'main', 63, [22, 21, 20], '3×AMRAP, 90 s Pause', '3×AMRAP, 90 s rest'),
  d(5, 'light', 22, [11, 11], 'Leichter Tag', 'Light day'),
  d(6, 'main', 66, [23, 22, 21], '3×AMRAP, 90 s Pause', '3×AMRAP, 90 s rest'),
  d(7, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 2 — Volume. 4× AMRAP @ 60s; light = 60% max.
  d(8, 'main', 80, [22, 20, 19, 19], '4×AMRAP, 60 s Pause', '4×AMRAP, 60 s rest'),
  d(9, 'light', 30, [10, 10, 10], 'Leichter Tag — 3×60 % vom Maximum', 'Light day — 3×60% of max'),
  d(10, 'main', 84, [23, 21, 20, 20], '4×AMRAP, 60 s Pause', '4×AMRAP, 60 s rest'),
  d(11, 'light', 33, [11, 11, 11], 'Leichter Tag', 'Light day'),
  d(12, 'main', 88, [24, 22, 21, 21], '4×AMRAP, 60 s Pause', '4×AMRAP, 60 s rest'),
  d(13, 'light', 36, [12, 12, 12], 'Leichter Tag', 'Light day'),
  d(14, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 3 — Intensity. 5× target reps (~80% max). No light days.
  d(15, 'main', 100, [22, 20, 20, 20, 18], '5 Sätze à ~80 % vom Maximum', '5 sets at ~80% of max'),
  d(16, 'rest', 0, undefined, 'Mobility & Brust-Stretching', 'Mobility & chest stretching'),
  d(17, 'main', 105, [23, 22, 20, 20, 20], '5 Sätze Zielwiederholungen', '5 sets target reps'),
  d(18, 'rest', 0, undefined, 'Mobility & Brust-Stretching', 'Mobility & chest stretching'),
  d(19, 'main', 110, [24, 22, 22, 22, 20], '5 Sätze Zielwiederholungen', '5 sets target reps'),
  d(20, 'rest', 0, undefined, 'Mobility & Brust-Stretching', 'Mobility & chest stretching'),
  d(21, 'main', 115, [25, 23, 23, 22, 22], '5 Sätze Zielwiederholungen', '5 sets target reps'),
  // Week 4 — Tapering & Peak. 3× 70% max, last 2 days active recovery.
  d(22, 'main', 70, [25, 23, 22], '3 Sätze à 70 % — Qualität vor Quantität', '3 sets at 70% — quality over quantity'),
  d(23, 'light', 30, [15, 15], 'Leichter Tag — 2×50 %', 'Light day — 2×50%'),
  d(24, 'main', 75, [26, 25, 24], '3 Sätze à 70 %', '3 sets at 70%'),
  d(25, 'light', 30, [15, 15], 'Leichter Tag — 2×50 %', 'Light day — 2×50%'),
  d(26, 'main', 75, [26, 25, 24], '3 Sätze à 70 %', '3 sets at 70%'),
  d(27, 'rest', 0, undefined, 'Aktive Erholung — Spaziergang, Mobility', 'Active recovery — walk, mobility'),
  d(28, 'rest', 0, undefined, 'Aktive Erholung', 'Active recovery'),
  d(29, 'rest', 0, undefined, 'Ruhe vor dem Endtest', 'Rest before the final test'),
  d(30, 'test', 100, undefined, 'Endtest: Maximale Liegestütze ohne Pause', 'Final test: max push-ups without stopping'),
];

const OVER_40_DAYS: ReadonlyArray<TrainingPlanDay> = [
  // Week 1 — Technique focus, low volume.
  d(1, 'test', 0, undefined, 'Maximaltest mit sauberer Technik', 'Max test with clean form'),
  d(2, 'main', 24, [8, 8, 8], '3×8 Knie- oder erhöhte Liegestütze', '3×8 knee or elevated push-ups'),
  d(3, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(4, 'main', 27, [9, 9, 9], '3×9 saubere Liegestütze', '3×9 clean push-ups'),
  d(5, 'rest', 0, undefined, 'Ruhetag — Schulter-Mobility', 'Rest day — shoulder mobility'),
  d(6, 'main', 30, [10, 10, 10], '3×10 saubere Liegestütze', '3×10 clean push-ups'),
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
  d(15, 'main', 48, [13, 12, 12, 11], '4 Sätze, 90 s Pause', '4 sets, 90 s rest'),
  d(16, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(17, 'main', 52, [14, 13, 13, 12], '4 Sätze, 90 s Pause', '4 sets, 90 s rest'),
  d(18, 'rest', 0, undefined, 'Ruhetag — Mobility', 'Rest day — mobility'),
  d(19, 'main', 56, [15, 14, 14, 13], '4 Sätze, 90 s Pause', '4 sets, 90 s rest'),
  d(20, 'light', 18, [9, 9], 'Leichter Tag', 'Light day'),
  d(21, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  // Week 4 — peak + final test (still gentle volume).
  d(22, 'main', 60, [16, 15, 15, 14], '4 Sätze, kontrolliertes Tempo', '4 sets, controlled tempo'),
  d(23, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(24, 'main', 64, [17, 16, 16, 15], '4 Sätze, langsame Exzentrik', '4 sets, slow eccentric'),
  d(25, 'rest', 0, undefined, 'Ruhetag', 'Rest day'),
  d(26, 'light', 20, [10, 10], 'Leichter Tag', 'Light day'),
  d(27, 'rest', 0, undefined, 'Ruhetag — Vorbereitung Endtest', 'Rest day — prepare final test'),
  d(28, 'test', 50, undefined, 'Endtest: Maximale Liegestütze', 'Final test: max push-ups'),
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
