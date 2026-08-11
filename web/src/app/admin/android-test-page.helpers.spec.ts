import { AdminUser } from './admin-page.models';
import {
  androidTestEmailsForClipboard,
  groupByAndroidTestStatus,
  MANUAL_ADD_MAX_MATCHES,
  manualAddMatches,
} from './android-test-page.helpers';

function user(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    uid: 'u1',
    displayName: null,
    email: null,
    anonymous: false,
    entryCount: 0,
    lastEntry: null,
    createdAt: null,
    role: null,
    ...overrides,
  };
}

describe('groupByAndroidTestStatus', () => {
  it('should sort users into candidate/optedIn/notified buckets', () => {
    // given
    const users = [
      user({ uid: 'c1', androidTest: { status: 'candidate' } }),
      user({ uid: 'o1', androidTest: { status: 'optedIn' } }),
      user({ uid: 'n1', androidTest: { status: 'notified' } }),
    ];
    // when
    const result = groupByAndroidTestStatus(users);
    // then
    expect(result.candidates.map((u) => u.uid)).toEqual(['c1']);
    expect(result.optedIn.map((u) => u.uid)).toEqual(['o1']);
    expect(result.notified.map((u) => u.uid)).toEqual(['n1']);
  });

  it('should exclude users without an androidTest status', () => {
    // given
    const users = [user({ uid: 'plain' })];
    // when
    const result = groupByAndroidTestStatus(users);
    // then
    expect(result.candidates).toEqual([]);
    expect(result.optedIn).toEqual([]);
    expect(result.notified).toEqual([]);
  });

  it('should surface confirmed users so pending invites stay visible', () => {
    // given
    const users = [
      user({ uid: 'confirmed', androidTest: { status: 'confirmed' } }),
    ];
    // when
    const result = groupByAndroidTestStatus(users);
    // then
    expect(result.confirmed.map((u) => u.uid)).toEqual(['confirmed']);
  });

  it('should exclude declined users from every bucket', () => {
    // given
    const users = [
      user({ uid: 'declined', androidTest: { status: 'declined' } }),
    ];
    // when
    const result = groupByAndroidTestStatus(users);
    // then
    expect(result.candidates).toEqual([]);
    expect(result.confirmed).toEqual([]);
    expect(result.optedIn).toEqual([]);
    expect(result.notified).toEqual([]);
  });
});

describe('manualAddMatches', () => {
  it('should return nothing for an empty search term', () => {
    // given
    const users = [user({ email: 'a@example.com' })];
    // when
    const result = manualAddMatches(users, '   ');
    // then
    expect(result).toEqual([]);
  });

  it('should match on email and on display name, case-insensitively', () => {
    // given
    const users = [
      user({ uid: 'byEmail', email: 'Anna@example.com' }),
      user({ uid: 'byName', email: 'x@example.com', displayName: 'Annika' }),
      user({ uid: 'other', email: 'bob@example.com' }),
    ];
    // when
    const result = manualAddMatches(users, 'ann');
    // then
    expect(result.map((u) => u.uid)).toEqual(['byEmail', 'byName']);
  });

  // Mirrors the backend eligibility rule — offering these would promise an
  // invite that Play Console can never honour.
  it('should never offer anonymous accounts or accounts without an email', () => {
    // given
    const users = [
      user({ uid: 'anon', email: 'anon@example.com', anonymous: true }),
      user({ uid: 'noMail', email: null, displayName: 'anon-ish' }),
    ];
    // when
    const result = manualAddMatches(users, 'anon');
    // then
    expect(result).toEqual([]);
  });

  it('should not offer users already somewhere in the flow', () => {
    // given
    const inFlow = ['candidate', 'confirmed', 'optedIn', 'notified'] as const;
    const users = inFlow.map((status, i) =>
      user({
        uid: status,
        email: `flow${i}@example.com`,
        androidTest: { status },
      })
    );
    // when
    const result = manualAddMatches(users, 'flow');
    // then
    expect(result).toEqual([]);
  });

  it('should offer a previously declined user again, so a mistake can be corrected', () => {
    // given
    const users = [
      user({
        uid: 'declined',
        email: 'declined@example.com',
        androidTest: { status: 'declined' },
      }),
    ];
    // when
    const result = manualAddMatches(users, 'declined');
    // then
    expect(result.map((u) => u.uid)).toEqual(['declined']);
  });

  it('should cap the number of matches', () => {
    // given
    const users = Array.from({ length: MANUAL_ADD_MAX_MATCHES + 5 }, (_, i) =>
      user({ uid: `u${i}`, email: `match${i}@example.com` })
    );
    // when
    const result = manualAddMatches(users, 'match');
    // then
    expect(result).toHaveLength(MANUAL_ADD_MAX_MATCHES);
  });
});

describe('androidTestEmailsForClipboard', () => {
  it('should join user emails with newlines', () => {
    // given
    const users = [
      user({ email: 'a@example.com' }),
      user({ email: 'b@example.com' }),
    ];
    // when
    const result = androidTestEmailsForClipboard(users);
    // then
    expect(result).toBe('a@example.com\nb@example.com');
  });

  it('should skip users without an email', () => {
    // given
    const users = [user({ email: null }), user({ email: 'a@example.com' })];
    // when
    const result = androidTestEmailsForClipboard(users);
    // then
    expect(result).toBe('a@example.com');
  });

  it('should return an empty string for no users', () => {
    // given
    const users: AdminUser[] = [];
    // when
    const result = androidTestEmailsForClipboard(users);
    // then
    expect(result).toBe('');
  });
});
