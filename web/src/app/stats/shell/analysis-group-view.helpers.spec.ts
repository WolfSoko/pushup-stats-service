import type { TypeBreakdownDatum } from '../analysis/analysis.types';
import {
  resolveHeatmapMeasurement,
  resolveHeatmapToggleLabels,
  resolveTypeBreakdownDisplay,
} from './analysis-group-view.helpers';

describe('resolveHeatmapMeasurement', () => {
  it('should pass through a concrete measurement bucket', () => {
    // given
    const measurement = 'reps' as const;

    // when
    const resolved = resolveHeatmapMeasurement(measurement);

    // then
    expect(resolved).toBe('reps');
  });

  it('should collapse a null measurement into "mixed" so the heatmap counts entries', () => {
    // given
    const measurement = null;

    // when
    const resolved = resolveHeatmapMeasurement(measurement);

    // then
    expect(resolved).toBe('mixed');
  });

  it('should pass through an explicit "mixed" measurement unchanged', () => {
    // given
    const measurement = 'mixed' as const;

    // when
    const resolved = resolveHeatmapMeasurement(measurement);

    // then
    expect(resolved).toBe('mixed');
  });
});

describe('resolveHeatmapToggleLabels', () => {
  it('should return Reps/Sets labels for reps-measured views', () => {
    // given / when
    const labels = resolveHeatmapToggleLabels('reps');

    // then
    expect(labels).toEqual({ primary: 'Reps', breakdown: 'Sets' });
  });

  it('should return Reps/Sets labels for weight-measured views', () => {
    // given / when
    const labels = resolveHeatmapToggleLabels('weight');

    // then
    expect(labels).toEqual({ primary: 'Reps', breakdown: 'Sets' });
  });

  it('should return Zeit/Intervalle labels for time-measured views', () => {
    // given / when
    const labels = resolveHeatmapToggleLabels('time');

    // then
    expect(labels).toEqual({ primary: 'Zeit', breakdown: 'Intervalle' });
  });

  it('should return Strecke/Intervalle labels for distance views', () => {
    // given / when
    const labels = resolveHeatmapToggleLabels('distance');

    // then
    expect(labels).toEqual({ primary: 'Strecke', breakdown: 'Intervalle' });
  });

  it('should return Strecke/Intervalle labels for distance-time views', () => {
    // given / when
    const labels = resolveHeatmapToggleLabels('distance-time');

    // then
    expect(labels).toEqual({ primary: 'Strecke', breakdown: 'Intervalle' });
  });

  it('should return null for mixed views so the toggle is hidden', () => {
    // given / when
    const labels = resolveHeatmapToggleLabels('mixed');

    // then
    expect(labels).toBeNull();
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
});
