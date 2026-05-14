import { angleAtJointDeg } from './joint-angle';

describe('angleAtJointDeg', () => {
  it('given a fully extended elbow on a line, when measured, then it is 180 degrees', () => {
    const angle = angleAtJointDeg(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 }
    );
    expect(angle).toBeCloseTo(180, 5);
  });

  it('given a right-angled bend, when measured, then it is 90 degrees', () => {
    const angle = angleAtJointDeg(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 }
    );
    expect(angle).toBeCloseTo(90, 5);
  });

  it('given a fully folded joint (distal back at proximal), when measured, then it is 0 degrees', () => {
    const angle = angleAtJointDeg(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 }
    );
    expect(angle).toBeCloseTo(0, 5);
  });

  it('given a 45 degree bend, when measured, then it is 45 degrees', () => {
    const angle = angleAtJointDeg(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1 - Math.cos(Math.PI / 4), y: Math.sin(Math.PI / 4) }
    );
    expect(angle).toBeCloseTo(45, 5);
  });

  it('given a degenerate triplet where distal equals joint, when measured, then it is NaN', () => {
    const angle = angleAtJointDeg(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 }
    );
    expect(Number.isNaN(angle)).toBe(true);
  });

  it('given a degenerate triplet where proximal equals joint, when measured, then it is NaN', () => {
    const angle = angleAtJointDeg(
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 }
    );
    expect(Number.isNaN(angle)).toBe(true);
  });
});
