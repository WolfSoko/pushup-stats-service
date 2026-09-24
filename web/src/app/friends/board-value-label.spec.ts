import { boardValueLabel } from './board-value-label';

describe('boardValueLabel', () => {
  it('should add the XP unit for the XP metric', () => {
    // then
    expect(boardValueLabel('xp', 1250)).toBe('1250 XP');
  });

  it('should keep reps unitless', () => {
    // then
    expect(boardValueLabel('reps', 40)).toBe('40');
  });

  it('should pluralise training days', () => {
    // then
    expect(boardValueLabel('days', 1)).toBe('1 Tag');
    expect(boardValueLabel('days', 3)).toBe('3 Tage');
  });
});
