import type { Workout } from './workout.models';
import { copyWorkout, workoutShareRejection } from './workout-share.models';

const VALID = {
  title: 'Ganzkörper kurz',
  description: 'Drei Runden',
  exercises: [
    { exerciseId: 'pushup', target: 30, sets: [10, 10, 10] },
    { exerciseId: 'plank.standard', target: 60 },
  ],
  onProfile: false,
};

function workout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: 'w1',
    ownerId: 'owner',
    ...VALID,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('copyWorkout', () => {
  it('should hand the recipient their own private copy', () => {
    // when
    const copy = copyWorkout(workout({ onProfile: true }), {
      ownerId: 'friend',
      sharedBy: { uid: 'owner', workoutId: 'w1', displayName: 'Wolfi' },
      now: '2026-09-10T08:00:00.000Z',
    });

    // then — never on the recipient's profile until they say so
    expect(copy.ownerId).toBe('friend');
    expect(copy.onProfile).toBe(false);
    expect(copy.sharedBy).toEqual({
      uid: 'owner',
      workoutId: 'w1',
      displayName: 'Wolfi',
    });
    expect(copy.exercises).toEqual(VALID.exercises);
    expect(copy.exercises).not.toBe(VALID.exercises);
    expect(copy.createdAt).toBe('2026-09-10T08:00:00.000Z');
  });
});

describe('workoutShareRejection', () => {
  const base = {
    uid: 'owner',
    workout: workout(),
    friendUids: ['friend'],
    acceptedFriendUids: ['friend', 'other'],
  };

  it('should let an owner send to confirmed friends', () => {
    expect(workoutShareRejection(base)).toBeNull();
  });

  it('should refuse a workout that is not the caller’s', () => {
    expect(workoutShareRejection({ ...base, uid: 'someone' })).toBe(
      'not-found'
    );
    expect(workoutShareRejection({ ...base, workout: null })).toBe('not-found');
  });

  it('should refuse an empty or oversized recipient list', () => {
    expect(workoutShareRejection({ ...base, friendUids: [] })).toBe(
      'no-friends'
    );
    expect(workoutShareRejection({ ...base, friendUids: 'friend' })).toBe(
      'no-friends'
    );
    expect(
      workoutShareRejection({
        ...base,
        friendUids: Array.from({ length: 21 }, (_, i) => `f${i}`),
      })
    ).toBe('too-many');
  });

  it('should refuse a recipient who is not a confirmed friend', () => {
    expect(
      workoutShareRejection({ ...base, friendUids: ['friend', 'stranger'] })
    ).toBe('not-friends');
  });
});
