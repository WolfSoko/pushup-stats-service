import { workoutRejectionMessage } from './workouts-messages';
import type { WorkoutActionReason } from './workouts.store';

describe('workoutRejectionMessage', () => {
  it('should say nothing when nothing was refused', () => {
    expect(workoutRejectionMessage(undefined)).toBeNull();
  });

  it.each<Exclude<WorkoutActionReason, undefined>>([
    'title',
    'description',
    'no-exercises',
    'too-many-exercises',
    'exercise',
    'target',
    'sets',
    'limit',
    'not-found',
    'no-friends',
    'too-many',
    'not-friends',
    'invalid',
    'failed',
  ])('should explain %s', (reason) => {
    // then — never the raw token
    const message = workoutRejectionMessage(reason);
    expect(message).toBeTruthy();
    expect(message).not.toBe(reason);
  });
});
