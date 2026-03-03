import { isPlatformServer } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  inject,
  Injectable,
  makeStateKey,
  PLATFORM_ID,
  TransferState,
} from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import {
  PushupCreate,
  PushupRecord,
  PushupUpdate,
  StatsFilter,
  StatsResponse,
  UserConfig,
} from '@pu-stats/models';
import { from, map, Observable, of, switchMap, tap } from 'rxjs';
import { buildServerApiBaseUrl } from './base-url.util';

const PUSHUPS_ENDPOINT = `/api/pushups`;
const STATS_ENDPOINT = `/api/stats`;
const USER_CONFIGS_COLLECTION = 'userConfigs';
const PUSHUPS_COLLECTION = 'pushups';

@Injectable({ providedIn: 'root' })
export class StatsApiService {
  private readonly http = inject(HttpClient);
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly platformId = inject(PLATFORM_ID);
  private readonly transferState = inject(TransferState);

  load(filter: StatsFilter = {}): Observable<StatsResponse> {
    if (!isPlatformServer(this.platformId)) {
      return this.listPushups(filter).pipe(
        switchMap((rows) =>
          from(this.resolveDailyGoal(this.resolveUserId())).pipe(
            map((goal) => this.toStatsResponse(rows, filter, goal))
          )
        )
      );
    }

    const params = new URLSearchParams();
    if (filter.from) params.set('from', filter.from);
    if (filter.to) params.set('to', filter.to);
    const query = params.toString();
    const key = makeStateKey<StatsResponse>(`stats:${query || 'all'}`);

    if (this.transferState.hasKey(key)) {
      const cached = this.transferState.get<StatsResponse>(
        key,
        {} as StatsResponse
      );
      this.transferState.remove(key);
      return of(cached);
    }

    return this.http
      .get<StatsResponse>(
        `${this.baseUrl()}${STATS_ENDPOINT}${query ? `?${query}` : ''}`
      )
      .pipe(
        tap((payload) => {
          if (isPlatformServer(this.platformId)) {
            this.transferState.set(key, payload);
          }
        })
      );
  }

  listPushups(filter: StatsFilter = {}): Observable<PushupRecord[]> {
    if (isPlatformServer(this.platformId)) {
      return this.http
        .get<PushupRecord[]>(`${this.baseUrl()}${PUSHUPS_ENDPOINT}`)
        .pipe(map((rows) => this.applyDateFilter(rows, filter)));
    }

    const userId = this.resolveUserId();
    const firestore = this.requireFirestore();
    const pushupsRef = collection(firestore, PUSHUPS_COLLECTION);
    const constraints = [
      where('userId', '==', userId),
      orderBy('timestamp', 'asc'),
    ];
    const q = query(pushupsRef, ...constraints);

    return from(getDocs(q)).pipe(
      map((snapshot) =>
        this.applyDateFilter(
          snapshot.docs.map((d) => {
            const data = d.data() as Omit<PushupRecord, '_id'>;
            return { _id: d.id, ...data } as PushupRecord;
          }),
          filter
        )
      )
    );
  }

  createPushup(payload: PushupCreate): Observable<PushupRecord> {
    if (isPlatformServer(this.platformId)) {
      return this.http.post<PushupRecord>(
        `${this.baseUrl()}${PUSHUPS_ENDPOINT}`,
        payload
      );
    }

    const firestore = this.requireFirestore();
    const pushupsRef = collection(firestore, PUSHUPS_COLLECTION);
    const newRef = doc(pushupsRef);
    const nowIso = new Date().toISOString();
    const userId = this.resolveUserId();
    const record: PushupRecord & { userId: string } = {
      _id: newRef.id,
      timestamp: payload.timestamp,
      reps: payload.reps,
      source: payload.source ?? 'web',
      type: payload.type,
      createdAt: nowIso,
      updatedAt: nowIso,
      userId,
    };

    return from(
      setDoc(newRef, {
        timestamp: record.timestamp,
        reps: record.reps,
        source: record.source,
        type: record.type ?? 'Standard',
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        userId,
      })
    ).pipe(map(() => record));
  }

  updatePushup(id: string, payload: PushupUpdate): Observable<PushupRecord> {
    if (isPlatformServer(this.platformId)) {
      return this.http.put<PushupRecord>(
        `${this.baseUrl()}${PUSHUPS_ENDPOINT}/${id}`,
        payload
      );
    }

    const rowRef = doc(this.requireFirestore(), PUSHUPS_COLLECTION, id);
    const patch = {
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    return from(updateDoc(rowRef, patch)).pipe(
      switchMap(() => this.listPushups({})),
      map(
        (rows) =>
          rows.find((x) => x._id === id) ?? {
            _id: id,
            timestamp: '',
            reps: 0,
            source: 'web',
          }
      )
    );
  }

  deletePushup(id: string): Observable<{ ok: true }> {
    if (isPlatformServer(this.platformId)) {
      return this.http.delete<{ ok: true }>(
        `${this.baseUrl()}${PUSHUPS_ENDPOINT}/${id}`
      );
    }

    const rowRef = doc(this.requireFirestore(), PUSHUPS_COLLECTION, id);
    return from(deleteDoc(rowRef)).pipe(map(() => ({ ok: true as const })));
  }

  private baseUrl(): string {
    if (!isPlatformServer(this.platformId)) return '';
    return buildServerApiBaseUrl(this.platformId, 'StatsApiService');
  }

  private resolveUserId(): string {
    return 'default';
  }

  private requireFirestore(): Firestore {
    if (!this.firestore) {
      throw new Error('Firestore provider missing');
    }
    return this.firestore;
  }

  private applyDateFilter(
    rows: PushupRecord[],
    filter: StatsFilter
  ): PushupRecord[] {
    return rows.filter((row) => {
      const date = row.timestamp.slice(0, 10);
      return (
        (!filter.from || date >= filter.from) &&
        (!filter.to || date <= filter.to)
      );
    });
  }

  private async resolveDailyGoal(userId: string): Promise<number> {
    try {
      const cfgRef = doc(
        this.requireFirestore(),
        USER_CONFIGS_COLLECTION,
        userId
      );
      const cfgSnapshot = await getDoc(cfgRef);
      const docData = cfgSnapshot.data() as UserConfig | undefined;
      if (docData?.dailyGoal && Number.isFinite(docData.dailyGoal)) {
        return Math.max(1, docData.dailyGoal);
      }
      return 100;
    } catch {
      return 100;
    }
  }

  private toStatsResponse(
    rows: PushupRecord[],
    filter: StatsFilter,
    dailyGoal: number
  ): StatsResponse {
    const totals = new Map<string, number>();
    for (const row of rows) {
      const day = row.timestamp.slice(0, 10);
      totals.set(day, (totals.get(day) ?? 0) + row.reps);
    }

    const sortedDays = [...totals.keys()].sort((a, b) => a.localeCompare(b));
    let cumulative = 0;
    const series = sortedDays.map((day) => {
      const total = totals.get(day) ?? 0;
      cumulative += total;
      return {
        bucket: day,
        total,
        dayIntegral: Math.round((cumulative / dailyGoal) * 100) / 100,
      };
    });

    const from = filter.from ?? sortedDays[0] ?? null;
    const to = filter.to ?? sortedDays[sortedDays.length - 1] ?? null;
    const total = rows.reduce((sum, row) => sum + row.reps, 0);

    return {
      meta: {
        from,
        to,
        entries: rows.length,
        days: sortedDays.length,
        total,
        granularity: 'daily',
      },
      series,
    };
  }
}
