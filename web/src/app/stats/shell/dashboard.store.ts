import { computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  PushupLiveService,
  StatsApiService,
  UserConfigApiService,
} from '@pu-stats/data-access';
import {
  PushupRecord,
  StatsGranularity,
  StatsResponse,
  StatsSeriesEntry,
} from '@pu-stats/models';
import { UserContextService } from '../../user-context.service';
import { createWeekRange } from '../../util/date/create-week-range';
import { inferRangeMode } from '../../util/date/infer-range-mode';
import { RangeModes } from '../../util/date/range-modes.type';
import { toLocalIsoDate } from '../../util/date/to-local-iso-date';

const EMPTY_STATS: StatsResponse = {
  meta: {
    from: null,
    to: null,
    entries: 0,
    days: 0,
    total: 0,
    granularity: 'daily',
  },
  series: [],
};

const PERIOD_TITLE_MAP: Record<RangeModes | 'today', string> = {
  today: $localize`:@@period.today:Heute`,
  day: $localize`:@@period.day:Tag`,
  week: $localize`:@@period.week:Woche`,
  month: $localize`:@@period.month:Monat`,
  year: $localize`:@@period.year:Jahr`,
  custom: $localize`:@@period.range:Zeitraum`,
};

type DashboardState = {
  from: string;
  to: string;
  rangeMode: RangeModes;
  busyAction: 'create' | 'update' | 'delete' | null;
  busyId: string | null;
  stats: StatsResponse;
  allTimeStats: StatsResponse;
  entryRows: PushupRecord[];
  dailyGoal: number;
  dayChartMode: '24h' | '14h';
  savingDayChartMode: boolean;
  loading: boolean;
  errorMessage: string;
};

const defaultRange = createWeekRange();

const initialState: DashboardState = {
  from: defaultRange.from,
  to: defaultRange.to,
  rangeMode: inferRangeMode(defaultRange.from, defaultRange.to),
  busyAction: null,
  busyId: null,
  stats: EMPTY_STATS,
  allTimeStats: EMPTY_STATS,
  entryRows: [],
  dailyGoal: 100,
  dayChartMode: '14h',
  savingDayChartMode: false,
  loading: false,
  errorMessage: '',
};

export const DashboardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => {
    const live = inject(PushupLiveService);

    return {
      total: computed(() => store.stats().meta.total),
      days: computed(() => store.stats().meta.days),
      entries: computed(() => store.stats().meta.entries),
      avg: computed(() => {
        const days = store.stats().meta.days;
        const total = store.stats().meta.total;
        return days ? (total / days).toFixed(1) : '0';
      }),

      allTimeTotal: computed(() => store.allTimeStats().meta.total),
      allTimeDays: computed(() => store.allTimeStats().meta.days),
      allTimeEntries: computed(() => store.allTimeStats().meta.entries),
      allTimeAvg: computed(() => {
        const days = store.allTimeStats().meta.days;
        const total = store.allTimeStats().meta.total;
        return days ? (total / days).toFixed(1) : '0';
      }),

      granularity: computed<StatsGranularity>(
        () => store.stats().meta.granularity
      ),
      rows: computed<StatsSeriesEntry[]>(() => store.stats().series),

      selectedDayTotal: computed(() => {
        const day = store.from() || toLocalIsoDate(new Date());
        return store
          .entryRows()
          .filter((entry) => entry.timestamp.slice(0, 10) === day)
          .reduce((sum, entry) => sum + entry.reps, 0);
      }),

      periodTotal: computed(() => {
        if (store.rangeMode() === 'day') {
          const day = store.from() || toLocalIsoDate(new Date());
          return store
            .entryRows()
            .filter((entry) => entry.timestamp.slice(0, 10) === day)
            .reduce((sum, entry) => sum + entry.reps, 0);
        }
        return store.stats().meta.total;
      }),

      periodGoal: computed(() => {
        const multiplier =
          store.rangeMode() === 'day'
            ? 1
            : Math.max(1, store.stats().meta.days);
        return store.dailyGoal() * multiplier;
      }),

      goalProgressPercent: computed(() => {
        const periodTotal =
          store.rangeMode() === 'day'
            ? store
                .entryRows()
                .filter(
                  (entry) =>
                    entry.timestamp.slice(0, 10) ===
                    (store.from() || toLocalIsoDate(new Date()))
                )
                .reduce((sum, entry) => sum + entry.reps, 0)
            : store.stats().meta.total;
        const periodGoal =
          store.dailyGoal() *
          (store.rangeMode() === 'day'
            ? 1
            : Math.max(1, store.stats().meta.days));

        return periodGoal
          ? Math.min(100, Math.round((periodTotal / periodGoal) * 100))
          : 0;
      }),

      periodTitle: computed(() => {
        if (
          store.rangeMode() === 'day' &&
          toLocalIsoDate(new Date()) === store.from()
        ) {
          return PERIOD_TITLE_MAP.today;
        }
        return PERIOD_TITLE_MAP[store.rangeMode()];
      }),

      lastEntry: computed<PushupRecord | null>(() => {
        const rows = store.entryRows();
        if (!rows.length) return null;
        return (
          [...rows].sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )[0] ?? null
        );
      }),

      latestEntries: computed<PushupRecord[]>(() =>
        [...store.entryRows()]
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
          .slice(0, 10)
      ),

      liveConnected: computed(() => live.connected()),
    };
  }),
  withMethods((store) => {
    const api = inject(StatsApiService);
    const user = inject(UserContextService);
    const userConfigApi = inject(UserConfigApiService);

    const loadCurrentStats = async () => {
      const from = store.from();
      const to = store.to();
      const stats = await firstValueFrom(
        api.load({ from: from || undefined, to: to || undefined })
      );
      patchState(store, { stats: stats ?? EMPTY_STATS });
    };

    const loadEntries = async () => {
      const from = store.from();
      const to = store.to();
      const rows = await firstValueFrom(
        api.listPushups({ from: from || undefined, to: to || undefined })
      );
      patchState(store, { entryRows: rows ?? [] });
    };

    const loadAllTime = async () => {
      const allTimeStats = await firstValueFrom(api.load({}));
      patchState(store, { allTimeStats: allTimeStats ?? EMPTY_STATS });
    };

    return {
      setFrom(from: string) {
        patchState(store, {
          from,
          rangeMode: inferRangeMode(from, store.to()),
        });
        void this.refreshAll();
      },

      setTo(to: string) {
        patchState(store, {
          to,
          rangeMode: inferRangeMode(store.from(), to),
        });
        void this.refreshAll();
      },

      setRangeMode(mode: RangeModes) {
        patchState(store, { rangeMode: mode });
      },

      async initFromUrl(search: string) {
        const params = new URLSearchParams(search);
        const from = params.get('from') ?? defaultRange.from;
        const to = params.get('to') ?? defaultRange.to;
        patchState(store, {
          from,
          to,
          rangeMode: inferRangeMode(from, to),
        });
        await this.loadUserConfig();
        await this.refreshAll();
      },

      async refreshAll() {
        patchState(store, { loading: true, errorMessage: '' });
        try {
          await Promise.all([loadCurrentStats(), loadEntries(), loadAllTime()]);
        } catch {
          patchState(store, {
            errorMessage:
              'Daten konnten nicht geladen werden. Bitte Zeitraum prüfen oder die Seite neu laden.',
          });
        } finally {
          patchState(store, { loading: false });
        }
      },

      async loadUserConfig() {
        const cfg = await firstValueFrom(
          userConfigApi.getConfig(user.userIdSafe())
        );
        patchState(store, {
          dailyGoal: cfg.dailyGoal ?? 100,
          dayChartMode: cfg.ui?.dayChartMode === '24h' ? '24h' : '14h',
        });
      },

      async onCreateEntry(payload: {
        timestamp: string;
        reps: number;
        source?: string;
        type?: string;
      }) {
        patchState(store, { busyAction: 'create', busyId: null });
        try {
          await firstValueFrom(api.createPushup(payload));
          await this.refreshAll();
        } finally {
          patchState(store, { busyAction: null, busyId: null });
        }
      },

      async onUpdateEntry(payload: {
        id: string;
        timestamp: string;
        reps: number;
        source?: string;
        type?: string;
      }) {
        patchState(store, { busyAction: 'update', busyId: payload.id });
        try {
          await firstValueFrom(
            api.updatePushup(payload.id, {
              timestamp: payload.timestamp,
              reps: payload.reps,
              source: payload.source,
              type: payload.type,
            })
          );
          await this.refreshAll();
        } finally {
          patchState(store, { busyAction: null, busyId: null });
        }
      },

      async onDeleteEntry(id: string) {
        patchState(store, { busyAction: 'delete', busyId: id });
        try {
          await firstValueFrom(api.deletePushup(id));
          await this.refreshAll();
        } finally {
          patchState(store, { busyAction: null, busyId: null });
        }
      },

      async onDayChartModeChange(mode: '24h' | '14h') {
        if (!mode || mode === store.dayChartMode()) return;
        patchState(store, { dayChartMode: mode, savingDayChartMode: true });
        try {
          await firstValueFrom(
            userConfigApi.updateConfig(user.userIdSafe(), {
              ui: { dayChartMode: mode },
            })
          );
          await this.loadUserConfig();
          await loadCurrentStats();
        } finally {
          patchState(store, { savingDayChartMode: false });
        }
      },

      async addQuickEntry(reps: number) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');

        await this.onCreateEntry({
          timestamp: `${y}-${m}-${d}T${hh}:${mm}`,
          reps,
          source: 'web',
          type: 'Standard',
        });
      },
    };
  })
);
