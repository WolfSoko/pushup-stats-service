import {
  CHART_LABELS,
  chartSubtitleFor,
  chartTitleFor,
  cumulativeLabelFor,
} from './chart-messages';

describe('chartTitleFor', () => {
  it('should name the bucket size of every granularity', () => {
    // given / when / then
    expect(chartTitleFor('hourly', '')).toContain('Stundenwerte');
    expect(chartTitleFor('daily', '')).toContain('Tageswerte');
    expect(chartTitleFor('weekly', '')).toContain('Wochenwerte');
    expect(chartTitleFor('monthly', '')).toContain('Monatswerte');
  });

  it('should append the exercise label when the tab is narrowed to one', () => {
    // given / when
    const title = chartTitleFor('weekly', '  Liegestütze  ');
    // then
    expect(title).toBe('Verlauf (Wochenwerte) – Liegestütze');
  });
});

describe('chartSubtitleFor', () => {
  it('should pick the wording matching the measurement', () => {
    // given / when / then
    expect(chartSubtitleFor('reps')).toContain('Wiederholungen');
    expect(chartSubtitleFor('time')).toContain('Übungsdauer');
    expect(chartSubtitleFor('mixed')).toContain('Trainingsvolumen');
  });
});

describe('cumulativeLabelFor', () => {
  it('should call the running total a day integral for hour and day buckets', () => {
    // given / when / then
    expect(cumulativeLabelFor('hourly')).toBe(CHART_LABELS.dayIntegral);
    expect(cumulativeLabelFor('daily')).toBe(CHART_LABELS.dayIntegral);
  });

  it('should drop the day wording once a bucket spans more than a day', () => {
    // given / when / then
    expect(cumulativeLabelFor('weekly')).toBe(CHART_LABELS.cumulative);
    expect(cumulativeLabelFor('monthly')).toBe(CHART_LABELS.cumulative);
  });
});
