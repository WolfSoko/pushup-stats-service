import { StatsGranularity } from '@pu-stats/models';
import { selectSubtitle } from './chart-copy';
import { ChartMeasurement } from './stats-chart.models';

const TITLE_BY_GRANULARITY: Record<StatsGranularity, string> = {
  hourly: $localize`:@@chart.titleHourly:Verlauf (Stundenwerte)`,
  daily: $localize`:@@chart.titleDaily:Verlauf (Tageswerte)`,
  weekly: $localize`:@@chart.titleWeekly:Verlauf (Wochenwerte)`,
  monthly: $localize`:@@chart.titleMonthly:Verlauf (Monatswerte)`,
};

// The orange line runs cumulatively across the whole visible range, so
// the wording says "Zeitraum", not "Tag" — with week and month buckets
// a day is not even one bar. The `.range` ids replace the older
// day-worded ones; reusing those would have left eight locales
// translating a sentence the chart no longer shows.
const SUBTITLES = {
  reps: $localize`:@@chart.subtitle.reps.range:Balken zeigen deine Wiederholungen pro Zeitabschnitt. Die orange Linie summiert den Zeitraum, die grüne zeigt deinen Trend.`,
  time: $localize`:@@chart.subtitle.time.range:Balken zeigen deine Übungsdauer (s) pro Zeitabschnitt. Die orange Linie summiert den Zeitraum, die grüne zeigt deinen Trend.`,
  distance: $localize`:@@chart.subtitle.distance:Balken zeigen deine Strecke (km) pro Zeitabschnitt. Die orange Linie zeigt dein Tempo (min/km), die grüne deinen Strecken-Trend.`,
  weight: $localize`:@@chart.subtitle.weight.range:Balken zeigen dein Trainingsgewicht (kg) pro Zeitabschnitt. Die orange Linie summiert den Zeitraum, die grüne zeigt deinen Trend.`,
  mixed: $localize`:@@chart.subtitle.mixed.range:Balken zeigen dein Trainingsvolumen pro Zeitabschnitt. Die orange Linie summiert den Zeitraum, die grüne zeigt deinen Trend.`,
};

export const CHART_LABELS = {
  interval: $localize`:@@chart.interval:Intervallwert`,
  dayIntegral: $localize`:@@chart.dayIntegral:Tages-Integral`,
  cumulative: $localize`:@@chart.cumulative:Kumuliert`,
  pace: $localize`:@@chart.kmPace:km Tempo`,
  movingAvg: $localize`:@@chart.movingAvg:Gleitender Durchschnitt`,
  setsTooltip: $localize`:@@chart.setsTooltip:Sets`,
  weekAbbrev: $localize`:@@chart.weekAbbrev:KW`,
  withSets: $localize`:@@chart.withSets:Mit Sets`,
};

/** Card heading, optionally narrowed to the exercise the tab shows. */
export function chartTitleFor(
  granularity: StatsGranularity,
  kindLabel: string
): string {
  const base = TITLE_BY_GRANULARITY[granularity];
  const label = kindLabel.trim();
  return label ? `${base} – ${label}` : base;
}

export function chartSubtitleFor(measurement: ChartMeasurement): string {
  return selectSubtitle(measurement, SUBTITLES);
}

/**
 * Name of the running-total line. It sums the whole visible range, so
 * only hour and day buckets can honestly call that a day's integral —
 * week and month buckets get the neutral wording.
 */
export function cumulativeLabelFor(granularity: StatsGranularity): string {
  return granularity === 'weekly' || granularity === 'monthly'
    ? CHART_LABELS.cumulative
    : CHART_LABELS.dayIntegral;
}
