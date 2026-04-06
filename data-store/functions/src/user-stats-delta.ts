/**
 * Pure delta-calculation logic for user stats.
 *
 * All functions are side-effect-free and testable without Firestore.
 * The Cloud Function trigger (`updateUserStatsOnPushupWrite`) calls
 * these helpers and writes the result to Firestore.
 */

import {
  type UserStats,
  USERSTATS_VERSION,
  emptyUserStats,
} from '@pu-stats/models';

const TZ = 'Europe/Berlin';

interface BerlinDateParts {
  isoDate: string;
  year: number;
  month: number;
  day: number;
  weekday: string;
  hour: number;
}

const WEEKDAY_MAP: Record<string, string> = {
  Sun: 'So',
  Mon: 'Mo',
  Tue: 'Di',
  Wed: 'Mi',
  Thu: 'Do',
  Fri: 'Fr',
  Sat: 'Sa',
};

/**
 * Check whether a timestamp string contains an explicit timezone indicator
 * (trailing 'Z', or a '+'/'-' offset after the time portion).
 * Timestamps from the app's frontend are stored as Berlin local time
 * WITHOUT any offset (e.g. '2026-04-05T22:50'), so they must NOT be
 * re-interpreted as UTC and then converted to Berlin.
 */
function hasTimezoneIndicator(ts: string): boolean {
  if (ts.endsWith('Z') || ts.endsWith('z')) return true;
  // Look for +HH:MM or -HH:MM after the 'T' separator
  const tIdx = ts.indexOf('T');
  if (tIdx === -1) return false;
  const timePart = ts.slice(tIdx + 1);
  return /[+-]\d{2}:?\d{2}$/.test(timePart);
}

/**
 * Extract Berlin-local date parts from a timestamp string.
 *
 * Two modes:
 * 1. Timestamp WITH timezone (e.g. '…Z' or '…+02:00'): convert to Berlin via Intl.
 * 2. Timestamp WITHOUT timezone (e.g. '2026-04-05T22:50'): already Berlin local time,
 *    parse date/time parts directly from the string to avoid UTC mis-interpretation.
 */
export function berlinParts(isoTimestamp: string): BerlinDateParts {
  if (!hasTimezoneIndicator(isoTimestamp)) {
    // Timestamp is already Berlin local time — parse directly.
    const [datePart, timePart] = isoTimestamp.split('T');
    const [yearStr, monthStr, dayStr] = datePart.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    const hour = timePart ? Number(timePart.split(':')[0]) : 0;

    // Compute weekday from a UTC-safe date (noon avoids DST edge cases)
    const weekDate = new Date(Date.UTC(year, month - 1, day, 12));
    const dayOfWeek = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
    }).format(weekDate);

    return {
      isoDate: `${yearStr}-${monthStr}-${dayStr}`,
      year,
      month,
      day,
      weekday: WEEKDAY_MAP[dayOfWeek] ?? dayOfWeek,
      hour,
    };
  }

  // Timestamp has explicit timezone → convert to Berlin via Intl.
  const d = new Date(isoTimestamp);

  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});

  const dayOfWeek = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
  }).format(d);

  return {
    isoDate: `${dateParts['year']}-${dateParts['month']}-${dateParts['day']}`,
    year: Number(dateParts['year']),
    month: Number(dateParts['month']),
    day: Number(dateParts['day']),
    weekday: WEEKDAY_MAP[dayOfWeek] ?? dayOfWeek,
    hour: Number(timeParts['hour']),
  };
}

/**
 * Compute ISO week number and ISO week year for a given date.
 */
export function isoWeekFromYmd(
  year: number,
  month: number,
  day: number
): { year: number; week: number } {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return { year: d.getUTCFullYear(), week };
}

/**
 * Build period keys from Berlin-local date parts.
 */
export function periodKeys(parts: {
  isoDate: string;
  year: number;
  month: number;
  day: number;
}): { dailyKey: string; weeklyKey: string; monthlyKey: string } {
  const wk = isoWeekFromYmd(parts.year, parts.month, parts.day);
  return {
    dailyKey: parts.isoDate,
    weeklyKey: `${wk.year}-W${String(wk.week).padStart(2, '0')}`,
    monthlyKey: `${parts.year}-${String(parts.month).padStart(2, '0')}`,
  };
}

/**
 * Build heatmap slot key from weekday + hour.
 */
export function heatmapSlot(weekday: string, hour: number): string {
  return `${weekday}-${String(hour).padStart(2, '0')}`;
}

/**
 * Calendar days between two YYYY-MM-DD strings. Positive if b > a.
 */
export function daysBetween(a: string, b: string): number {
  const ad = new Date(`${a}T00:00:00Z`).getTime();
  const bd = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((bd - ad) / 86400000);
}

/**
 * Update the streak given the current streak state and a new entry date.
 */
export function updateStreak(
  currentStreak: number,
  lastEntryDate: string | null,
  entryDate: string
): { currentStreak: number; lastEntryDate: string } {
  if (!lastEntryDate) {
    return { currentStreak: 1, lastEntryDate: entryDate };
  }

  const diff = daysBetween(lastEntryDate, entryDate);

  if (diff === 0) {
    return { currentStreak: currentStreak || 1, lastEntryDate: entryDate };
  }
  if (diff === 1) {
    return { currentStreak: currentStreak + 1, lastEntryDate: entryDate };
  }
  return { currentStreak: 1, lastEntryDate: entryDate };
}

export interface ApplyDeltaParams {
  userId: string;
  /** Positive for add, negative for remove */
  repsDelta: number;
  /** +1 for create, -1 for delete, 0 for update */
  entriesDelta: number;
  /** ISO timestamp of the pushup entry */
  timestamp: string;
  /** Reps of the new/updated entry (for bestSingleEntry tracking) */
  newReps: number;
  /** Current ISO timestamp for updatedAt */
  nowIso: string;
}

/**
 * Apply a delta to an existing UserStats document.
 * Core logic for create (+reps), update (diff), and delete (-reps).
 */
export function applyDelta(
  existing: UserStats | null,
  params: ApplyDeltaParams
): UserStats {
  const { userId, repsDelta, entriesDelta, timestamp, newReps, nowIso } =
    params;
  const base = existing ?? emptyUserStats(userId);
  const parts = berlinParts(timestamp);
  const keys = periodKeys(parts);
  const slot = heatmapSlot(parts.weekday, parts.hour);

  // ── Aggregates ──────────────────────────────────────────────────────
  const total = Math.max(0, base.total + repsDelta);
  const totalEntries = Math.max(0, base.totalEntries + entriesDelta);

  // Early exit: reset to empty when all entries are gone
  if (totalEntries === 0) {
    return { ...emptyUserStats(userId), updatedAt: nowIso };
  }

  // Period reps: only apply delta when entry belongs to the SAME period.
  // If the entry is from a different period, keep stored values unchanged.
  const sameDay = base.dailyKey === keys.dailyKey;
  const sameWeek = base.weeklyKey === keys.weeklyKey;
  const sameMonth = base.monthlyKey === keys.monthlyKey;

  const dailyReps = sameDay
    ? Math.max(0, base.dailyReps + repsDelta)
    : repsDelta > 0
      ? repsDelta // new period starts with this entry's reps
      : base.dailyReps; // different period delete/update → keep current
  const dailyKey = sameDay || repsDelta > 0 ? keys.dailyKey : base.dailyKey;

  const weeklyReps = sameWeek
    ? Math.max(0, base.weeklyReps + repsDelta)
    : repsDelta > 0
      ? repsDelta
      : base.weeklyReps;
  const weeklyKey = sameWeek || repsDelta > 0 ? keys.weeklyKey : base.weeklyKey;

  const monthlyReps = sameMonth
    ? Math.max(0, base.monthlyReps + repsDelta)
    : repsDelta > 0
      ? repsDelta
      : base.monthlyReps;
  const monthlyKey =
    sameMonth || repsDelta > 0 ? keys.monthlyKey : base.monthlyKey;

  // ── Heatmap ─────────────────────────────────────────────────────────
  const heatmap = { ...base.heatmap };
  heatmap[slot] = Math.max(0, (heatmap[slot] ?? 0) + repsDelta);
  if (heatmap[slot] === 0) delete heatmap[slot];

  // ── Streak ──────────────────────────────────────────────────────────
  // Only advance streak for chronological (non-backdated) creates/updates.
  let streakState: { currentStreak: number; lastEntryDate: string | null };
  const isChronological =
    base.lastEntryDate === null || parts.isoDate >= base.lastEntryDate;
  if (entriesDelta >= 0 && isChronological) {
    streakState = updateStreak(
      base.currentStreak,
      base.lastEntryDate,
      parts.isoDate
    );
  } else {
    // Delete or backdated write — keep streak as-is (rebuild corrects it).
    streakState = {
      currentStreak: base.currentStreak,
      lastEntryDate: base.lastEntryDate,
    };
  }

  // ── Best day ────────────────────────────────────────────────────────
  let bestDay = base.bestDay ? { ...base.bestDay } : null;
  if (dailyReps > 0) {
    if (!bestDay || dailyReps > bestDay.total) {
      bestDay = { date: dailyKey, total: dailyReps };
    }
  }

  // ── Best single entry ───────────────────────────────────────────────
  let bestSingleEntry = base.bestSingleEntry
    ? { ...base.bestSingleEntry }
    : null;
  if (newReps > 0) {
    if (!bestSingleEntry || newReps > bestSingleEntry.reps) {
      bestSingleEntry = { reps: newReps, timestamp };
    }
  }

  // totalDays: increment when a new day appears, decrement when current day goes to 0
  let totalDays = base.totalDays;
  if (sameDay && dailyReps === 0 && base.dailyReps > 0) {
    totalDays = Math.max(0, totalDays - 1);
  } else if (!sameDay && repsDelta > 0) {
    totalDays += 1;
  }

  return {
    userId,
    total,
    totalEntries,
    totalDays,
    dailyReps,
    dailyKey,
    weeklyReps,
    weeklyKey,
    monthlyReps,
    monthlyKey,
    currentStreak: streakState.currentStreak,
    lastEntryDate: streakState.lastEntryDate,
    heatmap,
    bestDay,
    bestSingleEntry,
    version: base.version,
    updatedAt: nowIso,
  };
}

export interface PushupEntry {
  timestamp: string;
  reps: number;
}

/**
 * Rebuild UserStats from scratch given all pushup entries for a user.
 * Entries are sorted by timestamp before processing.
 * Used for backfill and streak recalculation after deletes.
 */
export function rebuildFromEntries(
  userId: string,
  entries: PushupEntry[],
  nowIso: string
): UserStats {
  if (entries.length === 0) {
    return { ...emptyUserStats(userId), updatedAt: nowIso };
  }

  const sorted = [...entries].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );

  // Compute all per-entry data
  const total = sorted.reduce((sum, e) => sum + e.reps, 0);
  const totalEntries = sorted.length;

  // Heatmap + per-day aggregation
  const heatmap: Record<string, number> = {};
  const dayTotals = new Map<string, number>();

  for (const entry of sorted) {
    const parts = berlinParts(entry.timestamp);
    const slot = heatmapSlot(parts.weekday, parts.hour);
    heatmap[slot] = (heatmap[slot] ?? 0) + entry.reps;

    dayTotals.set(
      parts.isoDate,
      (dayTotals.get(parts.isoDate) ?? 0) + entry.reps
    );
  }

  // Best day
  let bestDay: { date: string; total: number } | null = null;
  for (const [date, dayTotal] of dayTotals) {
    if (!bestDay || dayTotal > bestDay.total) {
      bestDay = { date, total: dayTotal };
    }
  }

  // Best single entry
  let bestSingleEntry: { reps: number; timestamp: string } | null = null;
  for (const entry of sorted) {
    if (!bestSingleEntry || entry.reps > bestSingleEntry.reps) {
      bestSingleEntry = { reps: entry.reps, timestamp: entry.timestamp };
    }
  }

  // Streak (from sorted unique dates)
  const uniqueDates = [...dayTotals.keys()].sort();
  let currentStreak = 1;
  for (let i = uniqueDates.length - 1; i > 0; i--) {
    if (daysBetween(uniqueDates[i - 1], uniqueDates[i]) === 1) {
      currentStreak++;
    } else {
      break;
    }
  }
  const lastEntryDate = uniqueDates[uniqueDates.length - 1];

  // Period keys from TODAY (not from last entry!)
  // Use the provided nowIso timestamp to calculate current period keys
  const nowParts = berlinParts(nowIso);
  const keys = periodKeys(nowParts);

  // Period reps: sum entries matching TODAY's period
  let dailyReps = 0;
  let weeklyReps = 0;
  let monthlyReps = 0;
  for (const entry of sorted) {
    const parts = berlinParts(entry.timestamp);
    const entryKeys = periodKeys(parts);
    if (entryKeys.dailyKey === keys.dailyKey) dailyReps += entry.reps;
    if (entryKeys.weeklyKey === keys.weeklyKey) weeklyReps += entry.reps;
    if (entryKeys.monthlyKey === keys.monthlyKey) monthlyReps += entry.reps;
  }

  const totalDays = dayTotals.size;

  return {
    userId,
    total,
    totalEntries,
    totalDays,
    dailyReps,
    dailyKey: keys.dailyKey,
    weeklyReps,
    weeklyKey: keys.weeklyKey,
    monthlyReps,
    monthlyKey: keys.monthlyKey,
    currentStreak,
    lastEntryDate,
    heatmap,
    bestDay,
    bestSingleEntry,
    version: USERSTATS_VERSION,
    updatedAt: nowIso,
  };
}

// Re-export for consumers
export { emptyUserStats } from '@pu-stats/models';
