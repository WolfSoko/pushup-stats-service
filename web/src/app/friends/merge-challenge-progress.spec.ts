import type { ChallengeView } from './challenges-api.service';
import { withKnownProgress } from './merge-challenge-progress';

describe('withKnownProgress', () => {
  const base: ChallengeView = {
    id: 'c1',
    createdBy: 'me',
    exerciseId: 'pushup',
    target: 500,
    from: '2026-09-14',
    to: '2026-09-20',
    status: 'active',
    entries: [],
    invited: [],
    viewerInvited: false,
  };

  const scored: ChallengeView = {
    ...base,
    entries: [
      { uid: 'friend', displayName: 'Ada', value: 300, isViewer: false },
      { uid: 'me', displayName: 'Wolf', value: 120, isViewer: true },
    ],
  };

  /** What the server sends when the sums were skipped: everyone at 0. */
  const counted: ChallengeView = {
    ...base,
    entries: [
      { uid: 'friend', displayName: 'Ada', value: 0, isViewer: false },
      { uid: 'me', displayName: 'Wolf', value: 0, isViewer: true },
    ],
  };

  it('should keep the sums a full load already read', () => {
    // given / when
    const merged = withKnownProgress([counted], [scored]);

    // then
    expect(merged[0].entries.map((e) => [e.uid, e.value])).toEqual([
      ['friend', 300],
      ['me', 120],
    ]);
  });

  it('should re-sort the board so the one ahead stays on top', () => {
    // given — the count-only answer is ordered by name, not by score
    const known: ChallengeView = {
      ...scored,
      entries: [
        { uid: 'me', displayName: 'Wolf', value: 480, isViewer: true },
        { uid: 'friend', displayName: 'Ada', value: 120, isViewer: false },
      ],
    };

    // when
    const merged = withKnownProgress([counted], [known]);

    // then
    expect(merged[0].entries.map((e) => e.uid)).toEqual(['me', 'friend']);
  });

  it('should carry the flag saying a sum could not be read', () => {
    // given / when
    const merged = withKnownProgress(
      [counted],
      [{ ...scored, progressUnavailable: true }]
    );

    // then
    expect(merged[0].progressUnavailable).toBe(true);
  });

  it('should leave a challenge nothing is known about untouched', () => {
    // given — a challenge that appeared between the two calls
    const fresh: ChallengeView = { ...counted, id: 'c2' };

    // when
    const merged = withKnownProgress([fresh], [scored]);

    // then
    expect(merged[0]).toBe(fresh);
  });

  it('should keep a participant who joined after the full load', () => {
    // given
    const joined: ChallengeView = {
      ...counted,
      entries: [
        ...counted.entries,
        { uid: 'new', displayName: 'Bo', value: 0, isViewer: false },
      ],
    };

    // when
    const merged = withKnownProgress([joined], [scored]);

    // then — no sum is known for them yet, but they are on the board
    expect(merged[0].entries.map((e) => [e.uid, e.value])).toEqual([
      ['friend', 300],
      ['me', 120],
      ['new', 0],
    ]);
  });

  it('should pass the answer through when nothing is known yet', () => {
    // given / when
    const fresh = [counted];

    // then
    expect(withKnownProgress(fresh, [])).toBe(fresh);
  });
});
