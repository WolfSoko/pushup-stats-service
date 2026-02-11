export type StatsGranularity = 'daily' | 'hourly';

export interface StatsMeta {
  from: string | null;
  to: string | null;
  entries: number;
  days: number;
  total: number;
  granularity: StatsGranularity;
}

export interface StatsSeriesEntry {
  bucket: string;
  total: number;
  dayIntegral: number;
}

export interface StatsResponse {
  meta: StatsMeta;
  series: StatsSeriesEntry[];
}

export interface StatsFilter {
  from?: string;
  to?: string;
}

export interface PushupRecord {
  _id: string;
  timestamp: string;
  reps: number;
  source: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PushupCreate {
  timestamp: string;
  reps: number;
  source?: string;
}

export interface PushupUpdate {
  timestamp?: string;
  reps?: number;
  source?: string;
}
