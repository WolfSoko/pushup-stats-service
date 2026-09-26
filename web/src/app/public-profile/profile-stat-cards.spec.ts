import type { PublicProfile } from '@pu-stats/models';

import { buildProfileStatCards } from './profile-stat-cards';

const numbers = {
  total: 4659,
  totalDurationSec: 0,
  totalDistanceM: 0,
  totalEntries: 199,
  totalDays: 82,
  currentStreak: 1,
  bestEntryXp: 70,
  bestDayXp: 168,
} satisfies Partial<PublicProfile>;

function cards(over: Partial<PublicProfile> = {}) {
  return buildProfileStatCards(
    { ...numbers, ...over } as PublicProfile,
    'en-US'
  );
}

describe('buildProfileStatCards', () => {
  it('should label every lifetime number and format it in its unit', () => {
    // when
    const result = cards({ totalDurationSec: 5400, totalDistanceM: 12500 });

    // then
    expect(result.map((c) => [c.key, c.label, c.value])).toEqual([
      ['reps', 'Wiederholungen gesamt', '4,659'],
      ['duration', 'Trainingszeit gesamt', '1 h 30 min'],
      ['distance', 'Strecke gesamt', '12.5 km'],
      ['days', 'Trainingstage', '82'],
      ['streak', 'Tage in Folge', '1'],
      ['entries', 'Einträge gesamt', '199'],
      ['bestEntry', 'Stärkster Eintrag', '70 XP'],
      ['bestDay', 'Stärkster Tag', '168 XP'],
    ]);
  });

  it('should leave out time and distance while nothing was logged', () => {
    // when
    const keys = cards().map((c) => c.key);

    // then
    expect(keys).not.toContain('duration');
    expect(keys).not.toContain('distance');
  });

  it('should put reps, time and distance behind the one total switch', () => {
    // when
    const result = cards({ totalDurationSec: 60, totalDistanceM: 1000 });

    // then
    expect(
      result.filter((c) => c.section === 'total').map((c) => c.key)
    ).toEqual(['reps', 'duration', 'distance']);
  });

  it('should mark a value the viewer may not see as empty', () => {
    // when
    const streak = cards({ currentStreak: null }).find(
      (c) => c.key === 'streak'
    );

    // then
    expect(streak).toMatchObject({ hasContent: false, value: '' });
  });
});
