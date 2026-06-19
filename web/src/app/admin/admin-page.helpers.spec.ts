import {
  adminFeedbackSortValue,
  adminUserSortValue,
  errorMessage,
  filterAdminUsers,
  toggleSetMember,
} from './admin-page.helpers';
import { AdminFeedback, AdminUser } from './admin-page.models';

function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    uid: 'uid-1',
    displayName: 'Alice',
    email: 'alice@example.com',
    anonymous: false,
    pushupCount: 10,
    lastEntry: '2026-01-02T08:00:00.000Z',
    createdAt: '2026-01-01T08:00:00.000Z',
    role: null,
    ...overrides,
  };
}

function makeFeedback(overrides: Partial<AdminFeedback> = {}): AdminFeedback {
  return {
    id: 'f1',
    name: 'Bob',
    email: 'bob@example.com',
    message: 'hi',
    userId: null,
    createdAt: '2026-03-04T10:00:00.000Z',
    userAgent: null,
    read: false,
    githubIssueUrl: null,
    ...overrides,
  };
}

describe('adminUserSortValue', () => {
  it('should lowercase displayName and fall back to empty string when null', () => {
    // given
    const named = makeUser({ displayName: 'ZÉBRA' });
    const unnamed = makeUser({ displayName: null });
    // when
    // then
    expect(adminUserSortValue(named, 'displayName')).toBe('zébra');
    expect(adminUserSortValue(unnamed, 'displayName')).toBe('');
  });

  it('should lowercase email and fall back to empty string when null', () => {
    // given
    const user = makeUser({ email: 'A@B.COM' });
    const noEmail = makeUser({ email: null });
    // when
    // then
    expect(adminUserSortValue(user, 'email')).toBe('a@b.com');
    expect(adminUserSortValue(noEmail, 'email')).toBe('');
  });

  it('should map anonymous to 1 and non-anonymous to 0', () => {
    // given
    // when
    // then
    expect(adminUserSortValue(makeUser({ anonymous: true }), 'anonymous')).toBe(
      1
    );
    expect(
      adminUserSortValue(makeUser({ anonymous: false }), 'anonymous')
    ).toBe(0);
  });

  it('should return the raw pushupCount', () => {
    // given
    // when
    // then
    expect(
      adminUserSortValue(makeUser({ pushupCount: 42 }), 'pushupCount')
    ).toBe(42);
  });

  it('should convert lastEntry/createdAt to epoch ms and use 0 when null', () => {
    // given
    const iso = '2026-01-02T08:00:00.000Z';
    const expected = new Date(iso).getTime();
    // when
    // then
    expect(adminUserSortValue(makeUser({ lastEntry: iso }), 'lastEntry')).toBe(
      expected
    );
    expect(adminUserSortValue(makeUser({ lastEntry: null }), 'lastEntry')).toBe(
      0
    );
    expect(adminUserSortValue(makeUser({ createdAt: iso }), 'createdAt')).toBe(
      expected
    );
    expect(adminUserSortValue(makeUser({ createdAt: null }), 'createdAt')).toBe(
      0
    );
  });

  it('should return empty string for an unknown property', () => {
    // given
    // when
    // then
    expect(adminUserSortValue(makeUser(), 'role')).toBe('');
  });
});

describe('adminFeedbackSortValue', () => {
  it('should convert createdAt to epoch ms and use 0 when null', () => {
    // given
    const iso = '2026-03-04T10:00:00.000Z';
    // when
    // then
    expect(
      adminFeedbackSortValue(makeFeedback({ createdAt: iso }), 'createdAt')
    ).toBe(new Date(iso).getTime());
    expect(
      adminFeedbackSortValue(makeFeedback({ createdAt: null }), 'createdAt')
    ).toBe(0);
  });

  it('should lowercase name/email and fall back to empty string when null', () => {
    // given
    // when
    // then
    expect(adminFeedbackSortValue(makeFeedback({ name: 'CARL' }), 'name')).toBe(
      'carl'
    );
    expect(adminFeedbackSortValue(makeFeedback({ name: null }), 'name')).toBe(
      ''
    );
    expect(
      adminFeedbackSortValue(makeFeedback({ email: 'X@Y.Z' }), 'email')
    ).toBe('x@y.z');
    expect(adminFeedbackSortValue(makeFeedback({ email: null }), 'email')).toBe(
      ''
    );
  });

  it('should return empty string for an unknown property', () => {
    // given
    // when
    // then
    expect(adminFeedbackSortValue(makeFeedback(), 'message')).toBe('');
  });
});

describe('filterAdminUsers', () => {
  it('should return only anonymous users when onlyAnonymous is true', () => {
    // given
    const anon = makeUser({ uid: 'a', anonymous: true });
    const named = makeUser({ uid: 'b', anonymous: false });
    // when
    const result = filterAdminUsers([anon, named], true);
    // then
    expect(result).toEqual([anon]);
  });

  it('should return the same array reference when onlyAnonymous is false', () => {
    // given
    const users = [makeUser()];
    // when
    const result = filterAdminUsers(users, false);
    // then
    expect(result).toBe(users);
  });

  it('should return an empty array when no users are anonymous', () => {
    // given
    const users = [makeUser({ anonymous: false })];
    // when
    // then
    expect(filterAdminUsers(users, true)).toEqual([]);
  });
});

describe('toggleSetMember', () => {
  it('should add the id without mutating the original set when present is true', () => {
    // given
    const original = new Set(['a']);
    // when
    const next = toggleSetMember(original, 'b', true);
    // then
    expect(next).toEqual(new Set(['a', 'b']));
    expect(original).toEqual(new Set(['a']));
    expect(next).not.toBe(original);
  });

  it('should remove the id without mutating the original set when present is false', () => {
    // given
    const original = new Set(['a', 'b']);
    // when
    const next = toggleSetMember(original, 'b', false);
    // then
    expect(next).toEqual(new Set(['a']));
    expect(original).toEqual(new Set(['a', 'b']));
  });

  it('should be a no-op result when removing a missing id', () => {
    // given
    const original = new Set(['a']);
    // when
    // then
    expect(toggleSetMember(original, 'z', false)).toEqual(new Set(['a']));
  });
});

describe('errorMessage', () => {
  it('should return the message of an Error instance', () => {
    // given
    // when
    // then
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('should stringify a non-Error value', () => {
    // given
    // when
    // then
    expect(errorMessage('plain')).toBe('plain');
    expect(errorMessage(404)).toBe('404');
    expect(errorMessage(null)).toBe('null');
  });
});
