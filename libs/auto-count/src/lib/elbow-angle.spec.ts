import { angleAtElbowDeg } from './elbow-angle';

describe('angleAtElbowDeg', () => {
  it('given a fully extended arm on a line, when measured, then it is 180 degrees', () => {
    const angle = angleAtElbowDeg(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 }
    );
    expect(angle).toBeCloseTo(180, 5);
  });

  it('given a right-angled bend, when measured, then it is 90 degrees', () => {
    const angle = angleAtElbowDeg(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 }
    );
    expect(angle).toBeCloseTo(90, 5);
  });

  it('given a fully folded arm (wrist back at shoulder), when measured, then it is 0 degrees', () => {
    const angle = angleAtElbowDeg(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 }
    );
    expect(angle).toBeCloseTo(0, 5);
  });

  it('given a 45 degree bend in a pushup-like pose, when measured, then it is 45 degrees', () => {
    const angle = angleAtElbowDeg(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1 - Math.cos(Math.PI / 4), y: Math.sin(Math.PI / 4) }
    );
    expect(angle).toBeCloseTo(45, 5);
  });

  it('given a degenerate triplet where wrist equals elbow, when measured, then it is NaN', () => {
    const angle = angleAtElbowDeg(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 }
    );
    expect(Number.isNaN(angle)).toBe(true);
  });

  it('given a degenerate triplet where shoulder equals elbow, when measured, then it is NaN', () => {
    const angle = angleAtElbowDeg(
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 }
    );
    expect(Number.isNaN(angle)).toBe(true);
  });
});
