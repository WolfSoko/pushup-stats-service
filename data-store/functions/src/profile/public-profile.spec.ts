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

  it('Given opt-in but no stats yet, Then returns zeros for numeric fields', () => {
    const result = buildPublicProfile(
      uid,
      { displayName: 'Wolfi', ui: { publicProfile: true } },
      null
    );
    expect(result).toEqual({
      uid,
      displayName: 'Wolfi',
      total: 0,
      totalEntries: 0,
      totalDays: 0,
      currentStreak: 0,
      bestSingleEntry: null,
      bestDayTotal: null,
      achievements: [],
      photoURL: null,
      memberSince: null,
      weeklyReps: 0,
      monthlyReps: 0,
      heatmap: {},
      exercises: [],
      isPrivate: false,
      viewerIsOwner: false,
      viewerIsFriend: false,
      hidden: [],
      visibility: {},
      updatedAt: '',
    });
  });

  it('Given opt-in and full stats, Then projects whitelisted fields only', () => {
    const result = buildPublicProfile(
      uid,
      { displayName: 'Wolfi', ui: { publicProfile: true } },
      {
        total: 5000,
        totalEntries: 200,
        totalDays: 90,
        currentStreak: 14,
        bestSingleEntry: { reps: 50, timestamp: '2026-04-01T12:00:00Z' },
        bestDay: { date: '2026-04-15', total: 250 },
        updatedAt: '2026-04-29T08:30:00.000Z',
      }
    );
    expect(result).toEqual({
      uid,
      displayName: 'Wolfi',
      total: 5000,
      totalEntries: 200,
      totalDays: 90,
      currentStreak: 14,
      bestSingleEntry: 50,
      bestDayTotal: 250,
      achievements: [],
      photoURL: null,
      memberSince: null,
      weeklyReps: 0,
      monthlyReps: 0,
      heatmap: {},
      exercises: [],
      isPrivate: false,
      viewerIsOwner: false,
      viewerIsFriend: false,
      hidden: [],
      visibility: {},
      updatedAt: '2026-04-29T08:30:00.000Z',
    });
  });

  it('Falls back to anonymous label when displayName is missing', () => {
    const result = buildPublicProfile(
      uid,
      { ui: { publicProfile: true } },
      null
    );
    expect(result?.displayName).toBe('anonym');
  });

  it('Coerces non-numeric stats fields to 0', () => {
    const result = buildPublicProfile(
      uid,
      { displayName: 'Wolfi', ui: { publicProfile: true } },
      {
        total: NaN,
        totalEntries: undefined,
        totalDays: 'oops' as unknown as number,
        currentStreak: Infinity,
      }
    );
    expect(result).toMatchObject({
      total: 0,
      totalEntries: 0,
      totalDays: 0,
      currentStreak: 0,
    });
  });

  it('Returns null for bestSingleEntry when reps is Infinity', () => {
    const result = buildPublicProfile(
      uid,
      { displayName: 'Wolfi', ui: { publicProfile: true } },
      {
        bestSingleEntry: { reps: Infinity, timestamp: '2026-04-01T12:00:00Z' },
        updatedAt: '2026-04-29T00:00:00Z',
      }
    );
    expect(result?.bestSingleEntry).toBeNull();
  });

  it('Returns null for bestDayTotal when total is NaN', () => {
    const result = buildPublicProfile(
      uid,
      { displayName: 'Wolfi', ui: { publicProfile: true } },
      {
        bestDay: { date: '2026-04-15', total: NaN },
        updatedAt: '2026-04-29T00:00:00Z',
      }
    );
    expect(result?.bestDayTotal).toBeNull();
  });

  it('Falls back to empty string for updatedAt when value is not a string', () => {
    const result = buildPublicProfile(
      uid,
      { displayName: 'Wolfi', ui: { publicProfile: true } },
      {
        total: 100,
        // @ts-expect-error – intentionally testing bad runtime data
        updatedAt: 1714383600000,
      }
    );
    expect(result?.updatedAt).toBe('');
  });

  it('Returns bestSingleEntry and bestDayTotal as null when both are absent', () => {
    const result = buildPublicProfile(
      uid,
      { displayName: 'Wolfi', ui: { publicProfile: true } },
      { total: 100 }
    );
    expect(result?.bestSingleEntry).toBeNull();
    expect(result?.bestDayTotal).toBeNull();
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
        total: 1,
        totalEntries: 1,
        totalDays: 1,
        currentStreak: 1,
        // Sensitive timestamps and full heatmap must not pass through.
        ...({ heatmap: { 'Mo-08': 100 } } as Record<string, unknown>),
        updatedAt: '2026-04-29T00:00:00Z',
      } as never
    );
    const allowed = new Set([
      'uid',
      'displayName',
      'total',
      'totalEntries',
      'totalDays',
      'currentStreak',
      'achievements',
      'photoURL',
      'memberSince',
      'weeklyReps',
      'monthlyReps',
      'heatmap',
      'exercises',
      'isPrivate',
      'viewerIsOwner',
      'viewerIsFriend',
      'hidden',
      'visibility',
      'bestSingleEntry',
      'bestDayTotal',
      'updatedAt',
    ]);
    // Naming the offenders beats a bare `true !== false`: this guard
    // fires when someone adds a field, and the message should say which.
    expect(
      Object.keys(result ?? {}).filter((key) => !allowed.has(key))
    ).toEqual([]);
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

describe('buildPublicProfile period buckets', () => {
  const uid = 'abc123';
  const config = { displayName: 'Wolfi', ui: { publicProfile: true } };
  const stats = {
    weeklyReps: 300,
    weeklyKey: '2026-W36',
    monthlyReps: 1200,
    monthlyKey: '2026-09',
  };

  it('should report the bucket when it belongs to the current period', () => {
    // when
    const result = buildPublicProfile(uid, config, stats, {
      currentWeeklyKey: '2026-W36',
      currentMonthlyKey: '2026-09',
    });

    // then
    expect(result?.weeklyReps).toBe(300);
    expect(result?.monthlyReps).toBe(1200);
  });

  it('should zero a stale bucket instead of presenting it as current', () => {
    // given — a user who last trained in August would otherwise show
    // August's volume as "this month"
    const result = buildPublicProfile(uid, config, stats, {
      currentWeeklyKey: '2026-W37',
      currentMonthlyKey: '2026-10',
    });

    // then
    expect(result?.weeklyReps).toBe(0);
    expect(result?.monthlyReps).toBe(0);
  });

  it('should zero when the current period is unknown', () => {
    // then — guessing would be worse than showing nothing
    const result = buildPublicProfile(uid, config, stats, {});
    expect(result?.weeklyReps).toBe(0);
    expect(result?.monthlyReps).toBe(0);
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
  const stats = {
    total: 5000,
    totalEntries: 120,
    totalDays: 90,
    currentStreak: 7,
    bestSingleEntry: { reps: 60, timestamp: '2026-09-01T10:00:00.000Z' },
    bestDay: { date: '2026-09-01', total: 200 },
    weeklyReps: 300,
    weeklyKey: '2026-W36',
    monthlyReps: 1200,
    monthlyKey: '2026-09',
    heatmap: { 'Mo-07': 40 },
  };
  const extras = {
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
      ['streak', 'currentStreak'],
      ['days', 'totalDays'],
      ['entries', 'totalEntries'],
      ['week', 'weeklyReps'],
      ['month', 'monthlyReps'],
      ['bestSet', 'bestSingleEntry'],
      ['bestDay', 'bestDayTotal'],
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
      expect(result?.hidden).toEqual(['streak', 'heatmap']);
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
  const stats = { total: 5000, currentStreak: 7, updatedAt: 'x' } as never;

  it('should show a private profile to a confirmed friend', () => {
    // given a profile that was never made public
    const config = { displayName: 'Wolf', ui: { publicProfile: false } };

    // when
    const result = buildPublicProfile(uid, config, stats, {
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
    expect(buildPublicProfile(uid, config, stats, {})).toBeNull();
  });

  it('should keep a section switched off hidden from friends too', () => {
    // given
    const config = {
      displayName: 'Wolf',
      ui: { profileVisibility: { total: 'off', streak: 'friends' } },
    };

    // when
    const result = buildPublicProfile(uid, config, stats, {
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
    const result = buildPublicProfile(uid, config, stats, {});

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
      viewerIsOwner: true,
    });
    const visitor = buildPublicProfile(uid, config, stats, {});

    // then
    expect(owner?.visibility.total).toBe('friends');
    expect(visitor?.visibility).toEqual({});
  });
});
