import {
  type AutoCountReport,
  summarizeAutoCountFeedback,
  thresholdKey,
  toAutoCountReport,
} from './auto-count-feedback';

const report = (overrides: Partial<AutoCountReport> = {}): AutoCountReport => ({
  id: 'r1',
  exerciseId: 'pushup',
  profileId: 'pushup',
  mode: 'pose',
  detectedReps: 10,
  actualReps: 10,
  thresholds: { downAngleDeg: 90 },
  userId: 'uid',
  createdAt: '2026-09-01T10:00:00.000Z',
  ...overrides,
});

describe('thresholdKey', () => {
  it('given the same values in a different key order, when keyed, then both land in the same bucket', () => {
    // given / when
    const a = thresholdKey({ downAngleDeg: 90, upAngleDeg: 150 });
    const b = thresholdKey({ upAngleDeg: 150, downAngleDeg: 90 });

    // then
    expect(a).toBe(b);
  });

  it('given no overrides, when keyed, then the catalog default is named', () => {
    // given / when / then
    expect(thresholdKey({})).toBe('(default)');
  });
});

describe('summarizeAutoCountFeedback', () => {
  it('given runs on one threshold set, when summarized, then the exact rate is reported', () => {
    // given — three runs, two of them exact
    const reports = [
      report(),
      report({ detectedReps: 10, actualReps: 10 }),
      report({ detectedReps: 10, actualReps: 12 }),
    ];

    // when
    const [summary] = summarizeAutoCountFeedback(reports);

    // then
    expect(summary.runs).toBe(3);
    expect(summary.exactRuns).toBe(2);
    expect(summary.exactRate).toBeCloseTo(0.6667, 3);
  });

  it('given a detector that misses reps, when summarized, then the mean delta is positive', () => {
    // given — actual above detected means reps were not counted
    const reports = [
      report({ detectedReps: 8, actualReps: 10 }),
      report({ detectedReps: 9, actualReps: 10 }),
    ];

    // when
    const [summary] = summarizeAutoCountFeedback(reports);

    // then
    expect(summary.meanDelta).toBeCloseTo(1.5, 5);
    expect(summary.meanAbsDelta).toBeCloseTo(1.5, 5);
  });

  it('given errors in both directions, when summarized, then they cancel in the signed mean but not the absolute one', () => {
    // given
    const reports = [
      report({ detectedReps: 10, actualReps: 12 }),
      report({ detectedReps: 10, actualReps: 8 }),
    ];

    // when
    const [summary] = summarizeAutoCountFeedback(reports);

    // then
    expect(summary.meanDelta).toBe(0);
    expect(summary.meanAbsDelta).toBe(2);
  });

  it('given two different threshold sets, when summarized, then they are compared side by side', () => {
    // given
    const reports = [
      report({ thresholds: { downAngleDeg: 90 }, actualReps: 12 }),
      report({ thresholds: { downAngleDeg: 80 } }),
      report({ thresholds: { downAngleDeg: 80 } }),
      report({ thresholds: { downAngleDeg: 80 } }),
    ];

    // when
    const summaries = summarizeAutoCountFeedback(reports);

    // then — best-sampled configuration first
    expect(summaries).toHaveLength(2);
    expect(summaries[0].thresholdKey).toBe('downAngleDeg=80');
    expect(summaries[0].runs).toBe(3);
    expect(summaries[0].exactRate).toBe(1);
    expect(summaries[1].exactRate).toBe(0);
  });

  it('given the same thresholds under different profiles, when summarized, then they stay apart', () => {
    // given
    const reports = [
      report({ profileId: 'pushup' }),
      report({ profileId: 'squat' }),
    ];

    // when
    const summaries = summarizeAutoCountFeedback(reports);

    // then
    expect(summaries).toHaveLength(2);
  });

  it('given no reports, when summarized, then the result is empty rather than throwing', () => {
    // given / when / then
    expect(summarizeAutoCountFeedback([])).toEqual([]);
  });
});

describe('toAutoCountReport', () => {
  it('given a stored document, when normalised, then the timestamp becomes an ISO string', () => {
    // given
    const createdAt = new Date('2026-09-01T10:00:00.000Z');

    // when
    const result = toAutoCountReport('doc-1', {
      exerciseId: 'pushup',
      profileId: 'pushup',
      mode: 'pose',
      detectedReps: 10,
      actualReps: 11,
      thresholds: { downAngleDeg: 90 },
      userId: 'uid-1',
      createdAt: { toDate: () => createdAt },
    });

    // then
    expect(result).toEqual({
      id: 'doc-1',
      exerciseId: 'pushup',
      profileId: 'pushup',
      mode: 'pose',
      detectedReps: 10,
      actualReps: 11,
      thresholds: { downAngleDeg: 90 },
      userId: 'uid-1',
      createdAt: '2026-09-01T10:00:00.000Z',
    });
  });

  it('given a document without rep counts, when normalised, then it is rejected', () => {
    // given / when / then
    expect(toAutoCountReport('doc-1', { detectedReps: 10 })).toBeNull();
    expect(toAutoCountReport('doc-1', {})).toBeNull();
  });

  it('given non-numeric threshold values, when normalised, then they are dropped', () => {
    // given / when
    const result = toAutoCountReport('doc-1', {
      detectedReps: 10,
      actualReps: 10,
      thresholds: { downAngleDeg: 90, broken: 'nope' },
    });

    // then
    expect(result?.thresholds).toEqual({ downAngleDeg: 90 });
  });

  it('given an unknown mode, when normalised, then it falls back to pose', () => {
    // given / when
    const result = toAutoCountReport('doc-1', {
      detectedReps: 10,
      actualReps: 10,
      mode: 'something-else',
    });

    // then
    expect(result?.mode).toBe('pose');
  });
});
