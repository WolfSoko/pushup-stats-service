import {
  EMPTY_TRAINING_SUMMARY,
  PROFILE_SECTIONS,
  type TrainingSummary,
} from '@pu-stats/models';

import {
  buildPublicProfile,
  isPublicProfileAllowed,
  isValidUid,
} from './public-profile';

describe('isValidUid', () => {
  it.each([
    ['', false],
    // Firebase allows UIDs from 1 to 128 chars; custom-token / fixture UIDs
    // can be shorter than the 28-char anonymous default, so the validator
    // must accept the full range.
    ['x', true],
    ['short', true],
    ['valid-uid-1234567890', true],
    ['ALongIshUidWithMixedCase_-09', true],
    ['has spaces', false],
    ['has/slash', false],
    ['has..dot', false],
    ['x'.repeat(128), true],
    ['x'.repeat(129), false],
  ])('isValidUid(%j) => %s', (input, expected) => {
    expect(isValidUid(input)).toBe(expected);
  });

  it('rejects non-string inputs', () => {
    expect(isValidUid(undefined)).toBe(false);
    expect(isValidUid(null)).toBe(false);
    expect(isValidUid(123)).toBe(false);
    expect(isValidUid({})).toBe(false);
  });
});

describe('isPublicProfileAllowed', () => {
  it('Given missing config, Then returns false', () => {
    expect(isPublicProfileAllowed(undefined)).toBe(false);
    expect(isPublicProfileAllowed(null)).toBe(false);
  });

  it('Given config without ui.publicProfile, Then returns false', () => {
    expect(isPublicProfileAllowed({ displayName: 'Wolfi' })).toBe(false);
    expect(isPublicProfileAllowed({ displayName: 'Wolfi', ui: {} })).toBe(
      false
    );
  });

  it('Given ui.publicProfile=false, Then returns false', () => {
    expect(
      isPublicProfileAllowed({
        displayName: 'Wolfi',
        ui: { publicProfile: false },
      })
    ).toBe(false);
  });

  it('Given a section published to everyone, Then returns true', () => {
    // The settings master switch is gone: a level of `public` on any one
    // section is what publishes the profile now.
    expect(
      isPublicProfileAllowed({
        displayName: 'Wolfi',
        ui: { profileVisibility: { streak: 'public' } },
      })
    ).toBe(true);
  });

  it('Given every section narrowed to friends, Then returns false', () => {
    expect(
      isPublicProfileAllowed({
        displayName: 'Wolfi',
        ui: {
          publicProfile: true,
          profileVisibility: Object.fromEntries(
            PROFILE_SECTIONS.map((section) => [section, 'friends'])
          ),
        },
      })
    ).toBe(false);
  });

  it('Given ui.publicProfile=true, Then returns true', () => {
    expect(
      isPublicProfileAllowed({
        displayName: 'Wolfi',
        ui: { publicProfile: true },
      })
    ).toBe(true);
  });

  it('Defaults to private even when other ui flags are set', () => {
    // Regression: leaderboard opt-in should NOT auto-grant a public profile.
    expect(
      isPublicProfileAllowed({
        displayName: 'Wolfi',
        ui: { hideFromLeaderboard: false },
      })
    ).toBe(false);
  });
});

const SUMMARY: TrainingSummary = {
  reps: 5000,
  durationSec: 3600,
  distanceM: 42000,
  entries: 200,
  days: 90,
  currentStreak: 14,
  bestEntryXp: 50,
  bestDayXp: 250,
};

describe('buildPublicProfile', () => {
  const uid = 'abcdef1234567890';

  it('Given user has not opted in, Then returns null', () => {
    expect(buildPublicProfile(uid, null, null)).toBeNull();
    expect(
      buildPublicProfile(uid, { displayName: 'Wolfi', ui: {} }, null)
    ).toBeNull();
    expect(
      buildPublicProfile(
        uid,
        { displayName: 'Wolfi', ui: { publicProfile: false } },
        null
      )
    ).toBeNull();
  });

  it('should return zeros when nothing was summed yet', () => {
    // when
    const result = buildPublicProfile(
      uid,
      { displayName: 'Wolfi', ui: { publicProfile: true } },
      null
    );

    // then
    expect(result).toEqual({
      uid,
      displayName: 'Wolfi',
      total: 0,
      totalDurationSec: 0,
      totalDistanceM: 0,
      totalEntries: 0,
      totalDays: 0,
      currentStreak: 0,
      bestEntryXp: 0,
      bestDayXp: 0,
      xp: null,
      achievements: [],
      photoURL: null,
      memberSince: null,
      heatmap: {},
      exercises: [],
      recent: [],
      plan: null,
      workouts: [],
      isPrivate: false,
      viewerIsOwner: false,
      viewerIsFriend: false,
      viewerCheeredToday: false,
      hidden: [],
      visibility: {},
      updatedAt: '',
    });
  });

  it('should project the cross-exercise summary', () => {
    // when
    const result = buildPublicProfile(
      uid,
      { displayName: 'Wolfi', ui: { publicProfile: true } },
      { updatedAt: '2026-04-29T08:30:00.000Z' },
      { summary: SUMMARY }
    );

    // then
    expect(result).toMatchObject({
      total: 5000,
      totalDurationSec: 3600,
      totalDistanceM: 42000,
      totalEntries: 200,
      totalDays: 90,
      currentStreak: 14,
      bestEntryXp: 50,
      bestDayXp: 250,
      updatedAt: '2026-04-29T08:30:00.000Z',
    });
  });

  it('should fall back to the anonymous label when displayName is missing', () => {
    // when
    const result = buildPublicProfile(
      uid,
      { ui: { publicProfile: true } },
      null
    );

    // then
    expect(result?.displayName).toBe('anonym');
  });

  it('should fall back to an empty updatedAt when the value is not a string', () => {
    // when
    const result = buildPublicProfile(
      uid,
      { displayName: 'Wolfi', ui: { publicProfile: true } },
      // @ts-expect-error – intentionally testing bad runtime data
      { updatedAt: 1714383600000 }
    );

    // then
    expect(result?.updatedAt).toBe('');
  });

  // Privacy regression — explicit list of fields a future careless edit
  // could leak. If anyone adds a property to this projection, this spec
  // forces them to acknowledge it.
  it('Never leaks privacy-sensitive fields from the source documents', () => {
    const result = buildPublicProfile(
      uid,
      {
        displayName: 'Wolfi',
        ui: { publicProfile: true, hideFromLeaderboard: false },
        // Hypothetical future field — must not appear in projection.
        ...({ email: 'leak@example.com' } as Record<string, unknown>),
      },
      {
        // Sensitive timestamps must not pass through.
        ...({ lastEntryDate: '2026-04-28' } as Record<string, unknown>),
        heatmap: { 'Mo-08': 100 },
        updatedAt: '2026-04-29T00:00:00Z',
      },
      { summary: SUMMARY, xp: { total: 10, weeklyKey: 'leak' } }
    );
    const allowed = new Set([
      'uid',
      'displayName',
      'total',
      'totalDurationSec',
      'totalDistanceM',
      'totalEntries',
      'totalDays',
      'currentStreak',
      'bestEntryXp',
      'bestDayXp',
      'xp',
      'achievements',
      'photoURL',
      'memberSince',
      'heatmap',
      'exercises',
      'recent',
      'plan',
      'workouts',
      'isPrivate',
      'viewerIsOwner',
      'viewerIsFriend',
      'viewerCheeredToday',
      'hidden',
      'visibility',
      'updatedAt',
    ]);
    // Naming the offenders beats a bare `true !== false`: this guard
    // fires when someone adds a field, and the message should say which.
    expect(
      Object.keys(result ?? {}).filter((key) => !allowed.has(key))
    ).toEqual([]);
  });
});

describe('buildPublicProfile viewerCheeredToday', () => {
  const config = { displayName: 'Wolfi', ui: { publicProfile: true } };

  it('should pass the cheer state through for a friend', () => {
    // when
    const result = buildPublicProfile('u1', config, null, {
      viewerIsFriend: true,
      viewerCheeredToday: true,
    });

    // then
    expect(result?.viewerCheeredToday).toBe(true);
  });

  it('should never report a cheer to someone who is not a friend', () => {
    // when
    const result = buildPublicProfile('u1', config, null, {
      viewerCheeredToday: true,
    });

    // then
    expect(result?.viewerCheeredToday).toBe(false);
  });
});

describe('buildPublicProfile achievements', () => {
  const uid = 'abc123';
  const config = { displayName: 'Wolfi', ui: { publicProfile: true } };

  it('should project earned achievement ids newest first', () => {
    // when
    const result = buildPublicProfile(uid, config, null, {
      achievements: {
        earned: [
          { id: 'plan-days-1', awardedAt: '2026-01-02T00:00:00.000Z' },
          {
            id: 'plan-completed-core-4w',
            awardedAt: '2026-03-01T00:00:00.000Z',
          },
          { id: 'plan-days-10', awardedAt: '2026-02-01T00:00:00.000Z' },
        ],
      },
    });

    // then
    expect(result?.achievements).toEqual([
      'plan-completed-core-4w',
      'plan-days-10',
      'plan-days-1',
    ]);
  });

  it('should expose ids only, never the award timestamps', () => {
    // given — when a badge was earned reveals activity patterns, which
    // the profile deliberately does not publish
    // when
    const result = buildPublicProfile(uid, config, null, {
      achievements: {
        earned: [{ id: 'plan-days-1', awardedAt: '2026-01-02T00:00:00.000Z' }],
      },
    });

    // then
    expect(result?.achievements).toEqual(['plan-days-1']);
    expect(JSON.stringify(result)).not.toContain('2026-01-02');
  });

  it.each([
    ['no document', null],
    ['an empty document', {}],
    ['a non-array earned field', { earned: 'nope' } as never],
    ['entries without an id', { earned: [{ awardedAt: '2026-01-02' }] }],
    ['entries with an empty id', { earned: [{ id: '', awardedAt: 'x' }] }],
  ])('should degrade to no badges for %s', (_label, achievements) => {
    // then — the profile is served unauthenticated; a malformed document
    // must not break the page
    expect(
      buildPublicProfile(uid, config, null, { achievements })?.achievements
    ).toEqual([]);
  });
});

describe('buildPublicProfile owner access', () => {
  const uid = 'abc123';
  const privateConfig = {
    displayName: 'Wolfi',
    ui: { publicProfile: false },
  };

  it('should show a private profile to its own owner', () => {
    // when
    const result = buildPublicProfile(uid, privateConfig, null, {
      viewerIsOwner: true,
    });

    // then
    expect(result?.uid).toBe(uid);
    expect(result?.isPrivate).toBe(true);
  });

  it.each([
    ['a stranger', { viewerIsOwner: false }],
    ['an anonymous visitor', {}],
  ])('should stay hidden from %s', (_label, extras) => {
    // then — the opt-in gate has exactly one bypass and this is not it
    expect(buildPublicProfile(uid, privateConfig, null, extras)).toBeNull();
  });

  it('should not mark a public profile as private for its owner', () => {
    // given
    const publicConfig = { displayName: 'Wolfi', ui: { publicProfile: true } };

    // then
    expect(
      buildPublicProfile(uid, publicConfig, null, { viewerIsOwner: true })
        ?.isPrivate
    ).toBe(false);
  });

  it('should still refuse a missing config even for the owner', () => {
    // then — no config means no account; ownership cannot conjure one
    expect(
      buildPublicProfile(uid, null, null, { viewerIsOwner: true })
    ).toBeNull();
  });
});

describe('buildPublicProfile xp', () => {
  const uid = 'abc123';
  const config = {
    displayName: 'Wolfi',
    ui: { publicProfile: true, profileVisibility: { xp: 'public' } },
  };
  const xp = {
    total: 4321,
    weeklyXp: 300,
    weeklyKey: '2026-W36',
    monthlyXp: 1200,
    monthlyKey: '2026-09',
  };

  it('should report the period buckets that belong to the current period', () => {
    // when
    const result = buildPublicProfile(uid, config, null, {
      xp,
      currentWeeklyKey: '2026-W36',
      currentMonthlyKey: '2026-09',
    });

    // then
    expect(result?.xp).toEqual({ total: 4321, weekly: 300, monthly: 1200 });
  });

  it('should zero a stale bucket instead of presenting it as current', () => {
    // given — a user who last trained in August would otherwise show
    // August's XP as "this month"
    const result = buildPublicProfile(uid, config, null, {
      xp,
      currentWeeklyKey: '2026-W37',
      currentMonthlyKey: '2026-10',
    });

    // then
    expect(result?.xp).toEqual({ total: 4321, weekly: 0, monthly: 0 });
  });

  it('should zero the buckets when the current period is unknown', () => {
    // when
    const result = buildPublicProfile(uid, config, null, { xp });

    // then — guessing would be worse than showing nothing
    expect(result?.xp).toEqual({ total: 4321, weekly: 0, monthly: 0 });
  });

  it('should be null before the first XP was booked', () => {
    // when
    const result = buildPublicProfile(uid, config, null, { xp: null });

    // then
    expect(result?.xp).toBeNull();
  });

  it('should keep XP from visitors until the owner publishes it', () => {
    // given — XP is newer than the profile levels, so an earlier opt-in
    // does not cover it
    const legacy = { displayName: 'Wolfi', ui: { publicProfile: true } };

    // when
    const visitor = buildPublicProfile(uid, legacy, null, { xp });
    const owner = buildPublicProfile(uid, legacy, null, {
      xp,
      viewerIsOwner: true,
    });

    // then
    expect(visitor?.xp).toBeNull();
    expect(owner?.xp?.total).toBe(4321);
  });
});

describe('buildPublicProfile heatmap', () => {
  const uid = 'abc123';
  const config = { displayName: 'Wolfi', ui: { publicProfile: true } };

  it('should keep well-formed slots', () => {
    // when
    const result = buildPublicProfile(
      uid,
      config,
      { heatmap: { 'Mo-08': 120, 'Fr-19': 40 } },
      {}
    );

    // then
    expect(result?.heatmap).toEqual({ 'Mo-08': 120, 'Fr-19': 40 });
  });

  it.each([
    ['a malformed slot key', { nonsense: 5 }],
    ['a non-numeric value', { 'Mo-08': 'viel' }],
    ['a zero or negative value', { 'Mo-08': 0, 'Di-09': -3 }],
    ['a non-object heatmap', 'kaputt'],
  ])('should drop %s', (_label, heatmap) => {
    // then — served unauthenticated, so a malformed document must degrade
    expect(
      buildPublicProfile(uid, config, { heatmap } as never, {})?.heatmap
    ).toEqual({});
  });
});

describe('buildPublicProfile element visibility', () => {
  const uid = 'abc123';
  const stats = { heatmap: { 'Mo-07': 40 } };
  const extras = {
    summary: { ...SUMMARY, currentStreak: 7 },
    currentWeeklyKey: '2026-W36',
    currentMonthlyKey: '2026-09',
    achievements: { earned: { 'plan-days-10': '2026-09-01T00:00:00.000Z' } },
    exercises: [
      { exerciseId: 'pushup', total: 5000, measurement: 'reps' as const },
    ],
  };
  const configWith = (profileHidden: unknown) => ({
    displayName: 'Wolfi',
    ui: { publicProfile: true, profileHidden },
  });

  describe('Given a visitor', () => {
    it.each([
      ['total', 'total'],
      ['total', 'totalDurationSec'],
      ['total', 'totalDistanceM'],
      ['streak', 'currentStreak'],
      ['days', 'totalDays'],
      ['entries', 'totalEntries'],
      ['bestSet', 'bestEntryXp'],
      ['bestDay', 'bestDayXp'],
    ])('should omit %s entirely from the payload', (section, field) => {
      // then — the projection goes over the wire, so hiding it only in
      // the template would still ship the number to anyone who looks
      const result = buildPublicProfile(uid, configWith([section]), stats, {
        ...extras,
      });
      expect(result?.[field as keyof typeof result]).toBeNull();
    });

    it('should omit hidden achievements', () => {
      const result = buildPublicProfile(
        uid,
        configWith(['achievements']),
        stats,
        { ...extras }
      );
      expect(result?.achievements).toEqual([]);
    });

    it('should omit hidden exercises', () => {
      const result = buildPublicProfile(uid, configWith(['exercises']), stats, {
        ...extras,
      });
      expect(result?.exercises).toEqual([]);
    });

    it('should omit a hidden heatmap', () => {
      const result = buildPublicProfile(uid, configWith(['heatmap']), stats, {
        ...extras,
      });
      expect(result?.heatmap).toEqual({});
    });

    it('should not reveal which elements are hidden', () => {
      // then — listing them would hand back exactly what the switch is
      // there to withhold
      const result = buildPublicProfile(uid, configWith(['streak']), stats, {
        ...extras,
      });
      expect(result?.hidden).toEqual([]);
      expect(result?.viewerIsOwner).toBe(false);
    });

    it('should leave everything else untouched', () => {
      const result = buildPublicProfile(uid, configWith(['streak']), stats, {
        ...extras,
      });
      expect(result?.total).toBe(5000);
      expect(result?.totalDays).toBe(90);
    });
  });

  describe('Given the owner', () => {
    it('should still receive the hidden values', () => {
      // then — the switches need something to switch, and the owner is
      // allowed to see their own numbers
      const result = buildPublicProfile(uid, configWith(['streak']), stats, {
        ...extras,
        viewerIsOwner: true,
      });
      expect(result?.currentStreak).toBe(7);
    });

    it('should learn which elements are hidden', () => {
      const result = buildPublicProfile(
        uid,
        configWith(['streak', 'heatmap']),
        stats,
        { ...extras, viewerIsOwner: true }
      );
      // Sections that are off by default until the owner publishes them
      // belong in the list too — it is what the owner's page dims.
      expect(result?.hidden).toEqual([
        'xp',
        'streak',
        'heatmap',
        'recent',
        'plan',
        'workouts',
      ]);
      expect(result?.viewerIsOwner).toBe(true);
    });
  });

  it('should default to showing everything', () => {
    // then — no config means every existing profile is unchanged
    const result = buildPublicProfile(uid, configWith(undefined), stats, {
      ...extras,
    });
    expect(result?.hidden).toEqual([]);
    expect(result?.total).toBe(5000);
    expect(result?.heatmap).not.toEqual({});
  });
});

describe('buildPublicProfile for friends', () => {
  const uid = 'abc123';
  const stats = { updatedAt: 'x' };
  const summary = { ...EMPTY_TRAINING_SUMMARY, reps: 5000, currentStreak: 7 };

  it('should show a private profile to a confirmed friend', () => {
    // given a profile that was never made public
    const config = { displayName: 'Wolf', ui: { publicProfile: false } };

    // when
    const result = buildPublicProfile(uid, config, stats, {
      summary,
      viewerIsFriend: true,
    });

    // then — the friendship is the consent; legacy sections default to
    // friends-only, so the numbers come through
    expect(result).not.toBeNull();
    expect(result?.total).toBe(5000);
    expect(result?.viewerIsFriend).toBe(true);
    expect(result?.isPrivate).toBe(true);
  });

  it('should still refuse that profile to everyone else', () => {
    // given
    const config = { displayName: 'Wolf', ui: { publicProfile: false } };

    // when / then
    expect(buildPublicProfile(uid, config, stats, { summary })).toBeNull();
  });

  it('should keep a section switched off hidden from friends too', () => {
    // given
    const config = {
      displayName: 'Wolf',
      ui: { profileVisibility: { total: 'off', streak: 'friends' } },
    };

    // when
    const result = buildPublicProfile(uid, config, stats, {
      summary,
      viewerIsFriend: true,
    });

    // then
    expect(result?.total).toBeNull();
    expect(result?.currentStreak).toBe(7);
  });

  it('should keep a friends-only section out of the public projection', () => {
    // given a public profile with one section narrowed to friends
    const config = {
      displayName: 'Wolf',
      ui: { publicProfile: true, profileVisibility: { total: 'friends' } },
    };

    // when
    const result = buildPublicProfile(uid, config, stats, { summary });

    // then
    expect(result?.total).toBeNull();
    expect(result?.currentStreak).toBe(7);
  });

  it('should hand the owner their levels and nobody else', () => {
    // given
    const config = {
      displayName: 'Wolf',
      ui: { publicProfile: true, profileVisibility: { total: 'friends' } },
    };

    // when
    const owner = buildPublicProfile(uid, config, stats, {
      summary,
      viewerIsOwner: true,
    });
    const visitor = buildPublicProfile(uid, config, stats, { summary });

    // then
    expect(owner?.visibility.total).toBe('friends');
    expect(visitor?.visibility).toEqual({});
  });
});

describe('buildPublicProfile › recent workouts', () => {
  const uid = 'abcdef1234567890';
  const recent = [
    {
      exerciseId: 'pushup',
      value: 40,
      measurement: 'reps' as const,
      timestamp: '2026-09-11T18:00:00.000Z',
    },
  ];
  const config = {
    displayName: 'Wolfi',
    ui: { publicProfile: true, hideFromLeaderboard: false },
  };

  it('should keep them from a visitor of a legacy public profile', () => {
    // given — the old master switch was never consent for publishing
    // what was trained and when
    const result = buildPublicProfile(uid, config, null, { recent });

    // then
    expect(result?.recent).toEqual([]);
  });

  it('should keep them from a friend who was never told about them', () => {
    // given — the friendship was accepted before this section existed
    const result = buildPublicProfile(uid, config, null, {
      recent,
      viewerIsFriend: true,
    });

    // then
    expect(result?.recent).toEqual([]);
  });

  it('should show them to a friend once the owner chose that', () => {
    // given
    const result = buildPublicProfile(
      uid,
      {
        ...config,
        ui: { ...config.ui, profileVisibility: { recent: 'friends' } },
      },
      null,
      { recent, viewerIsFriend: true }
    );

    // then
    expect(result?.recent).toEqual(recent);
  });

  it('should show them to the owner', () => {
    // given — the owner needs to see what the switch governs
    const result = buildPublicProfile(uid, config, null, {
      recent,
      viewerIsOwner: true,
    });

    // then
    expect(result?.recent).toEqual(recent);
  });

  it('should show them to everyone once the owner says so', () => {
    // given
    const result = buildPublicProfile(
      uid,
      {
        ...config,
        ui: { ...config.ui, profileVisibility: { recent: 'public' } },
      },
      null,
      { recent }
    );

    // then
    expect(result?.recent).toEqual(recent);
  });

  it('should drop them when the section is switched off', () => {
    // given
    const result = buildPublicProfile(
      uid,
      { ...config, ui: { ...config.ui, profileVisibility: { recent: 'off' } } },
      null,
      { recent, viewerIsFriend: true }
    );

    // then
    expect(result?.recent).toEqual([]);
  });
});

describe('buildPublicProfile › shared workouts', () => {
  const uid = 'abcdef1234567890';
  const workouts = [
    {
      id: 'w1',
      title: 'Ganzkörper',
      description: '',
      exercises: [{ exerciseId: 'pushup', target: 30 }],
    },
  ];
  const config = {
    displayName: 'Wolfi',
    ui: { publicProfile: true, hideFromLeaderboard: false },
  };

  it('should keep them from a visitor of a legacy public profile', () => {
    // given — a section invented later starts switched off
    const result = buildPublicProfile(uid, config, null, { workouts });

    // then
    expect(result?.workouts).toEqual([]);
  });

  it('should show them to a friend once the owner opened the section to friends', () => {
    const result = buildPublicProfile(
      uid,
      {
        ...config,
        ui: { ...config.ui, profileVisibility: { workouts: 'friends' } },
      },
      null,
      { workouts, viewerIsFriend: true }
    );
    expect(result?.workouts).toEqual(workouts);
  });

  it('should keep them from a visitor while the section is friends-only', () => {
    const result = buildPublicProfile(
      uid,
      {
        ...config,
        ui: { ...config.ui, profileVisibility: { workouts: 'friends' } },
      },
      null,
      { workouts }
    );
    expect(result?.workouts).toEqual([]);
  });

  it('should always show the owner their own', () => {
    const result = buildPublicProfile(uid, config, null, {
      workouts,
      viewerIsOwner: true,
    });
    expect(result?.workouts).toEqual(workouts);
  });
});
