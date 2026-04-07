// Domain-specific statistics types
export type StatsGranularity = 'daily' | 'hourly';

export interface StatsMeta {
  from: string | null;
  to: string | null;
  entries: number;
  days: number;
  total: number;
  granularity: StatsGranularity;
  dayChartMode?: '24h' | '14h';
}

export interface StatsSeriesEntry {
  bucket: string;
  total: number;
  dayIntegral: number;
  bucketLabel?: string;
}

export interface StatsResponse {
  meta: StatsMeta;
  series: StatsSeriesEntry[];
}

export interface StatsFilter {
  from?: string;
  to?: string;
  dayChartMode?: '24h' | '14h';
}

// Re-export all domain models for backward compatibility
export * from './pushup.models';
export * from './user-config.models';
export * from './reminder-config.models';
export * from './user-stats.models';
