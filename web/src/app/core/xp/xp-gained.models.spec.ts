import type { XpEntryInput } from '@pu-stats/models';

import { buildXpGainedData, MAX_XP_LINES } from './xp-gained.models';

const perRep = (entry: XpEntryInput) => entry.reps ?? 0;

describe('buildXpGainedData', () => {
  it('should sum the XP and derive the level before and after', () => {
    // given
    const entries = [{ exerciseId: 'pushup', reps: 60 }];

    // when
    const data = buildXpGainedData(entries, perRep, 80, 't1');

    // then
    expect(data).toEqual(
      expect.objectContaining({
        xp: 60,
        titleId: 't1',
        before: expect.objectContaining({ level: 1, totalXp: 80 }),
        after: expect.objectContaining({ level: 2, totalXp: 140 }),
      })
    );
  });

  it('should describe each entry with its display value', () => {
    // when
    const data = buildXpGainedData(
      [{ exerciseId: 'pushup', reps: 25 }],
      perRep,
      0,
      't'
    );

    // then
    expect(data?.lines).toEqual([
      {
        label: expect.any(String),
        value: expect.stringContaining('25'),
        xp: 25,
      },
    ]);
  });

  it('should merge repeated exercises into one row with the summed value', () => {
    // when
    const data = buildXpGainedData(
      [
        { exerciseId: 'pushup', reps: 10 },
        { exerciseId: 'pushup', reps: 15 },
      ],
      perRep,
      0,
      't'
    );

    // then
    expect(data?.lines).toEqual([
      expect.objectContaining({ value: expect.stringContaining('25'), xp: 25 }),
    ]);
  });

  it('should cap the summary rows', () => {
    // given
    const ids = [
      'pushup',
      'abs.situps',
      'legs.squats',
      'pull.pullups',
      'push.dips',
    ];

    // when
    const data = buildXpGainedData(
      ids.map((exerciseId) => ({ exerciseId, reps: 5 })),
      perRep,
      0,
      't'
    );

    // then
    expect(data?.lines).toHaveLength(MAX_XP_LINES);
    expect(data?.xp).toBe(25);
  });

  it('should return null when nothing is worth XP', () => {
    // then
    expect(
      buildXpGainedData([{ exerciseId: 'pushup', reps: 0 }], perRep, 0, 't')
    ).toBeNull();
    expect(buildXpGainedData([null, undefined], perRep, 0, 't')).toBeNull();
  });
});
