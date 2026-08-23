import {
  resolveHeatmapMeasurement,
  resolveHeatmapToggleLabels,
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
