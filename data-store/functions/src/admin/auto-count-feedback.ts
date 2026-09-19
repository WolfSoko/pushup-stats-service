export type AutoCountMode = 'pose' | 'proximity';

/** One stored accuracy report, already normalised out of Firestore. */
export interface AutoCountReport {
  id: string;
  exerciseId: string;
  profileId: string;
  mode: AutoCountMode;
  detectedReps: number;
  actualReps: number;
  thresholds: Record<string, number>;
  userId: string | null;
  createdAt: string | null;
}

/**
 * How one threshold set performed. Grouped by profile *and* threshold
 * set, because that is the comparison the tuning loop needs: "at
 * downAngle 80 we were exact in 92 % of 40 runs, at 90 only in 71 %".
 * A summary over a profile as a whole would average those apart.
 */
export interface AutoCountAccuracySummary {
  profileId: string;
  mode: AutoCountMode;
  /** Stable identity of the threshold set, used for grouping. */
  thresholdKey: string;
  thresholds: Record<string, number>;
  runs: number;
  exactRuns: number;
  /** Share of runs the detector got exactly right, `0..1`. */
  exactRate: number;
  /** Mean signed error (`actual - detected`): positive means undercounting. */
  meanDelta: number;
  /** Mean error regardless of direction — the honest "how far off" number. */
  meanAbsDelta: number;
}

const round = (value: number, digits: number): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/**
 * Deterministic identity for a threshold set. Sorted so two documents
 * that carry the same values in a different key order land in the same
 * bucket instead of splitting the evidence in half.
 */
export function thresholdKey(thresholds: Record<string, number>): string {
  const keys = Object.keys(thresholds).sort();
  if (keys.length === 0) return '(default)';
  return keys.map((key) => `${key}=${thresholds[key]}`).join(';');
}

/**
 * Groups reports by profile + threshold set. Sorted by run count
 * descending: the configuration with the most evidence behind it is the
 * one worth reading first, and a 100 % rate over two runs means nothing.
 */
export function summarizeAutoCountFeedback(
  reports: ReadonlyArray<AutoCountReport>
): AutoCountAccuracySummary[] {
  const buckets = new Map<
    string,
    {
      summary: Omit<
        AutoCountAccuracySummary,
        'exactRate' | 'meanDelta' | 'meanAbsDelta'
      >;
      deltaSum: number;
      absDeltaSum: number;
    }
  >();

  for (const report of reports) {
    const key = thresholdKey(report.thresholds);
    const bucketId = `${report.profileId}|${report.mode}|${key}`;
    let bucket = buckets.get(bucketId);
    if (!bucket) {
      bucket = {
        summary: {
          profileId: report.profileId,
          mode: report.mode,
          thresholdKey: key,
          thresholds: report.thresholds,
          runs: 0,
          exactRuns: 0,
        },
        deltaSum: 0,
        absDeltaSum: 0,
      };
      buckets.set(bucketId, bucket);
    }

    const delta = report.actualReps - report.detectedReps;
    bucket.summary.runs += 1;
    if (delta === 0) bucket.summary.exactRuns += 1;
    bucket.deltaSum += delta;
    bucket.absDeltaSum += Math.abs(delta);
  }

  return [...buckets.values()]
    .map(({ summary, deltaSum, absDeltaSum }) => ({
      ...summary,
      exactRate: round(summary.exactRuns / summary.runs, 4),
      meanDelta: round(deltaSum / summary.runs, 2),
      meanAbsDelta: round(absDeltaSum / summary.runs, 2),
    }))
    .sort((a, b) => b.runs - a.runs || b.exactRate - a.exactRate);
}

const asFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Normalises a stored document. Returns null for anything that cannot
 * be counted — a report with a missing rep count would otherwise poison
 * every average it lands in.
 */
export function toAutoCountReport(
  id: string,
  data: Record<string, unknown>
): AutoCountReport | null {
  const detectedReps = asFiniteNumber(data['detectedReps']);
  const actualReps = asFiniteNumber(data['actualReps']);
  if (detectedReps === null || actualReps === null) return null;

  const rawThresholds = data['thresholds'];
  const thresholds: Record<string, number> = {};
  if (rawThresholds && typeof rawThresholds === 'object') {
    for (const [key, value] of Object.entries(
      rawThresholds as Record<string, unknown>
    )) {
      const numeric = asFiniteNumber(value);
      if (numeric !== null) thresholds[key] = numeric;
    }
  }

  const createdAt = data['createdAt'] as
    | { toDate?: () => Date }
    | undefined
    | null;

  return {
    id,
    exerciseId:
      typeof data['exerciseId'] === 'string' ? data['exerciseId'] : '',
    profileId: typeof data['profileId'] === 'string' ? data['profileId'] : '',
    mode: data['mode'] === 'proximity' ? 'proximity' : 'pose',
    detectedReps,
    actualReps,
    thresholds,
    userId: typeof data['userId'] === 'string' ? data['userId'] : null,
    createdAt: createdAt?.toDate?.()?.toISOString?.() ?? null,
  };
}
