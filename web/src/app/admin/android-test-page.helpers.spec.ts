import { AdminUser } from './admin-page.models';
import {
  androidTestEmailsForClipboard,
  groupByAndroidTestStatus,
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

  it('should exclude confirmed and declined users from every bucket', () => {
    // given
    const users = [
      user({ uid: 'confirmed', androidTest: { status: 'confirmed' } }),
      user({ uid: 'declined', androidTest: { status: 'declined' } }),
    ];
    // when
    const result = groupByAndroidTestStatus(users);
    // then
    expect(result.candidates).toEqual([]);
    expect(result.optedIn).toEqual([]);
    expect(result.notified).toEqual([]);
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
