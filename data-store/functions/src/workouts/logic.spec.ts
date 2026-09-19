import { MAX_PROFILE_WORKOUTS, MAX_WORKOUTS } from '@pu-stats/models';

import { profileWorkouts, splitByRoom } from './logic';

const VALID = {
  ownerId: 'owner',
  title: 'Ganzkörper',
  description: 'Kurz',
  exercises: [{ exerciseId: 'pushup', target: 30, sets: [10, 10, 10] }],
  onProfile: true,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

describe('profileWorkouts', () => {
  it('should list the valid workouts the owner put on the profile, newest first', () => {
    // given
    const docs = [
      { id: 'old', data: { ...VALID, updatedAt: '2026-08-01T00:00:00.000Z' } },
      { id: 'new', data: { ...VALID, updatedAt: '2026-09-09T00:00:00.000Z' } },
      { id: 'private', data: { ...VALID, onProfile: false } },
      { id: 'broken', data: { ...VALID, exercises: [] } },
    ];

    // when
    const result = profileWorkouts(docs);

    // then — only what a visitor may act on, nothing about the owner
    expect(result.map((w) => w.id)).toEqual(['new', 'old']);
    expect(result[0]).toEqual({
      id: 'new',
      title: 'Ganzkörper',
      description: 'Kurz',
      exercises: [{ exerciseId: 'pushup', target: 30, sets: [10, 10, 10] }],
    });
    expect(result[0]).not.toHaveProperty('ownerId');
  });

  it('should cap the list', () => {
    const docs = Array.from({ length: MAX_PROFILE_WORKOUTS + 3 }, (_, i) => ({
      id: `w${i}`,
      data: VALID,
    }));
    expect(profileWorkouts(docs)).toHaveLength(MAX_PROFILE_WORKOUTS);
  });
});

describe('splitByRoom', () => {
  it('should skip recipients at their limit instead of failing the share', () => {
    // given
    const counts = new Map([
      ['a', 3],
      ['b', MAX_WORKOUTS],
    ]);

    // when
    const split = splitByRoom(['a', 'b', 'c'], counts);

    // then — an unknown count means an empty list
    expect(split).toEqual({ send: ['a', 'c'], full: ['b'] });
  });
});
