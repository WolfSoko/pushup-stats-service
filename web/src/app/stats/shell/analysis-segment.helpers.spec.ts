import type { TypeBreakdownDatum } from '../analysis/analysis.types';
import {
  formatSegmentCell,
  formatSegmentValue,
  resolveTypeBreakdownDisplay,
  segmentHasSets,
  segmentLabel,
} from './analysis-segment.helpers';

describe('segmentLabel', () => {
  it('should name each measurement in the user\u2019s words', () => {
    // given / when / then
    expect(segmentLabel('reps')).toBe('Wiederholungen');
    expect(segmentLabel('time')).toBe('Dauer');
    expect(segmentLabel('distance')).toBe('Strecke');
    expect(segmentLabel('distance-time')).toBe('Strecke & Tempo');
    expect(segmentLabel('weight')).toBe('Gewicht');
    expect(segmentLabel('mixed')).toBe('Sonstige');
  });
});

describe('formatSegmentValue', () => {
  it('should count reps', () => {
    // given / when / then
    expect(formatSegmentValue(42, 'reps')).toBe('42 Reps');
  });

  it('should render a time value as m:ss', () => {
    // given / when / then
    expect(formatSegmentValue(90, 'time')).toBe('1:30');
  });

  it('should switch a distance past 1000 m to km', () => {
    // given / when / then
    expect(formatSegmentValue(5000, 'distance-time')).toBe('5.00 km');
    expect(formatSegmentValue(400, 'distance')).toBe('400 m');
  });

  it('should append kg for weight-measured segments', () => {
    // given / when / then
    expect(formatSegmentValue(80, 'weight')).toBe('80 kg');
  });

  it('should leave the unresolvable bucket unitless', () => {
    // given / when / then
    expect(formatSegmentValue(7, 'mixed')).toBe('7');
  });
});

describe('formatSegmentCell', () => {
  it('should leave the reps unit to the column header', () => {
    // given / when / then
    expect(formatSegmentCell(42, 'reps')).toBe('42');
  });

  it('should keep symbol units that a header cannot carry', () => {
    // given / when / then — distance flips between m and km per row
    expect(formatSegmentCell(90, 'time')).toBe('1:30');
    expect(formatSegmentCell(5000, 'distance-time')).toBe('5.00 km');
    expect(formatSegmentCell(400, 'distance')).toBe('400 m');
    expect(formatSegmentCell(80, 'weight')).toBe('80 kg');
  });
});

describe('segmentHasSets', () => {
  it('should report sets only for the rep-based measurements', () => {
    // given / when / then
    expect(segmentHasSets('reps')).toBe(true);
    expect(segmentHasSets('weight')).toBe(true);
    expect(segmentHasSets('time')).toBe(false);
    expect(segmentHasSets('distance-time')).toBe(false);
  });
});

describe('resolveTypeBreakdownDisplay', () => {
  const datum = (id: string): TypeBreakdownDatum => ({
    id,
    label: id,
    value: 1,
    avgSetSize: 0,
  });

  it('should pass pushup-variant data through untouched for the pushup view', () => {
    // given
    const data = [datum('Standard'), datum('Diamond')];

    // when
    const result = resolveTypeBreakdownDisplay('pushup', [], data);

    // then
    expect(result).toBe(data);
  });

  it('should pass through for the overview view with no kinds filter', () => {
    // given
    const data = [datum('Standard')];

    // when
    const result = resolveTypeBreakdownDisplay('overview', [], data);

    // then
    expect(result).toBe(data);
  });

  it('should pass through for the overview view filtered to pushup only', () => {
    // given
    const data = [datum('Standard')];

    // when
    const result = resolveTypeBreakdownDisplay('overview', ['pushup'], data);

    // then
    expect(result).toBe(data);
  });

  it('should localise bare exerciseIds for a non-pushup category view', () => {
    // given
    const data = [datum('abs.situps')];

    // when
    const result = resolveTypeBreakdownDisplay('core', [], data);

    // then
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'abs.situps', label: 'Sit-ups' });
  });

  it('should localise for the overview view when kinds exclude pushup', () => {
    // given
    const data = [datum('abs.situps')];

    // when
    const result = resolveTypeBreakdownDisplay(
      'overview',
      ['abs.situps'],
      data
    );

    // then
    expect(result[0].label).toBe('Sit-ups');
  });

  it('should leave unknown catalog-miss ids as their raw id', () => {
    // given
    const data = [datum('custom-uuid-1234')];

    // when
    const result = resolveTypeBreakdownDisplay('core', [], data);

    // then
    expect(result[0].label).toBe('custom-uuid-1234');
  });

  it('should localise ids for a non-reps segment even on the pushup tab', () => {
    // given
    const data = [datum('plank.standard')];

    // when
    const result = resolveTypeBreakdownDisplay('pushup', [], data, 'time');

    // then
    expect(result[0].label).toBe('Plank');
  });
});
