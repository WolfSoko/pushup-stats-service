import {
  buildPublicProfile,
  isPublicProfileAllowed,
  isValidUid,
} from './public-profile';

describe('isValidUid', () => {
  it.each([
    ['', false],
    ['short', false],
    ['valid-uid-1234567890', true],
    ['ALongIshUidWithMixedCase_-09', true],
    ['has spaces', false],
    ['has/slash', false],
    ['has..dot', false],
    ['x'.repeat(8), true],
    ['x'.repeat(7), false],
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
      'bestSingleEntry',
      'bestDayTotal',
      'updatedAt',
    ]);
    for (const key of Object.keys(result ?? {})) {
      expect(allowed.has(key)).toBe(true);
    }
  });
});
