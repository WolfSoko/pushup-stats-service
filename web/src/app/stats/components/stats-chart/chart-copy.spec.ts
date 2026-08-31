import {
  axisUnit,
  secondaryAxisUnit,
  secondaryLegendText,
  selectSubtitle,
  unitSuffix,
} from './chart-copy';

const variants = {
  reps: 'REPS',
  time: 'TIME',
  distance: 'DISTANCE',
  weight: 'WEIGHT',
  mixed: 'MIXED',
};

describe('selectSubtitle', () => {
  it('should pick the matching variant per measurement', () => {
    // given / when / then
    expect(selectSubtitle('time', variants)).toBe('TIME');
    expect(selectSubtitle('distance', variants)).toBe('DISTANCE');
    expect(selectSubtitle('distance-time', variants)).toBe('DISTANCE');
    expect(selectSubtitle('weight', variants)).toBe('WEIGHT');
    expect(selectSubtitle('mixed', variants)).toBe('MIXED');
  });

  it('should fall back to the reps variant for reps and null', () => {
    // given / when / then
    expect(selectSubtitle('reps', variants)).toBe('REPS');
    expect(selectSubtitle(null, variants)).toBe('REPS');
  });
});

describe('unitSuffix', () => {
  it('should map measurements to their unit suffix', () => {
    // given / when / then
    expect(unitSuffix('time')).toBe(' (s)');
    expect(unitSuffix('distance')).toBe(' (km)');
    expect(unitSuffix('distance-time')).toBe(' (km)');
    expect(unitSuffix('weight')).toBe(' (kg)');
    expect(unitSuffix('reps')).toBe(' (Reps)');
  });

  it('should return an empty suffix for mixed and null', () => {
    // given / when / then
    expect(unitSuffix('mixed')).toBe('');
    expect(unitSuffix(null)).toBe('');
  });
});

describe('secondaryLegendText', () => {
  it('should render the pace label with min/km when in pace mode', () => {
    // given / when
    const text = secondaryLegendText(true, 'Tempo', 'Integral', ' (km)');
    // then
    expect(text).toBe('Tempo (min/km)');
  });

  it('should render the day-integral label with the unit suffix otherwise', () => {
    // given / when
    const text = secondaryLegendText(false, 'Tempo', 'Integral', ' (Reps)');
    // then
    expect(text).toBe('Integral (Reps)');
  });
});

describe('axisUnit', () => {
  it('should strip the parentheses off the legend suffix', () => {
    // given / when / then
    expect(axisUnit('reps')).toBe('Reps');
    expect(axisUnit('time')).toBe('s');
    expect(axisUnit('distance')).toBe('km');
    expect(axisUnit('distance-time')).toBe('km');
    expect(axisUnit('weight')).toBe('kg');
  });

  it('should stay empty for mixed and unknown views', () => {
    // given / when / then
    expect(axisUnit('mixed')).toBe('');
    expect(axisUnit(null)).toBe('');
  });
});

describe('secondaryAxisUnit', () => {
  it('should label the pace axis in min/km', () => {
    // given / when / then
    expect(secondaryAxisUnit(true, 'distance')).toBe('min/km');
  });

  it('should mark the cumulative axis with a sigma', () => {
    // given / when / then
    expect(secondaryAxisUnit(false, 'reps')).toBe('Σ Reps');
    expect(secondaryAxisUnit(false, 'time')).toBe('Σ s');
  });

  it('should stay empty when no single unit describes the bars', () => {
    // given / when / then
    expect(secondaryAxisUnit(false, 'mixed')).toBe('');
  });
});
