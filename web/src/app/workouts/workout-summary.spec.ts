import { workoutExerciseLine, workoutSummary } from './workout-summary';

describe('workoutExerciseLine', () => {
  it('should fold equal sets into a multiplier', () => {
    expect(
      workoutExerciseLine({
        exerciseId: 'pushup',
        target: 30,
        sets: [10, 10, 10],
      })
    ).toBe('3×10 Liegestütze');
  });

  it('should list uneven sets', () => {
    expect(
      workoutExerciseLine({
        exerciseId: 'pushup',
        target: 27,
        sets: [12, 10, 5],
      })
    ).toBe('12/10/5 Liegestütze');
  });

  it('should show a timed target as m:ss', () => {
    expect(
      workoutExerciseLine({ exerciseId: 'plank.standard', target: 90 })
    ).toBe('1:30 Plank');
  });

  it('should name the variant when one is prescribed', () => {
    expect(
      workoutExerciseLine({
        exerciseId: 'legs.squats',
        target: 20,
        variantId: 'bodyweight',
      })
    ).toMatch(/^20 Kniebeugen · /);
  });
});

describe('workoutSummary', () => {
  it('should join the lines', () => {
    expect(
      workoutSummary([
        { exerciseId: 'pushup', target: 10 },
        { exerciseId: 'plank.standard', target: 60 },
      ])
    ).toBe('10 Liegestütze · 1:00 Plank');
  });
});
