jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  doc: jest.fn(() => ({})),
  getDoc: jest.fn(() =>
    Promise.resolve({ exists: () => false, data: () => null })
  ),
}));

import { TestBed } from '@angular/core/testing';
import { Firestore, getDoc } from '@angular/fire/firestore';
import { UserStatsApiService } from './user-stats-api.service';
import { UserStats } from '@pu-stats/models';
import { firstValueFrom } from 'rxjs';

const fullMockStats: UserStats = {
  userId: 'test-uid',
  total: 500,
  totalEntries: 25,
  totalDays: 15,
  dailyReps: 30,
  dailyKey: '2026-04-05',
  weeklyReps: 200,
  weeklyKey: '2026-W14',
  monthlyReps: 500,
  monthlyKey: '2026-04',
  currentStreak: 5,
  lastEntryDate: '2026-04-05',
  heatmap: { 'Mo-08': 100 },
  bestDay: { date: '2026-03-15', total: 120 },
  bestSingleEntry: { reps: 50, timestamp: '2026-03-15T10:00:00.000Z' },
  updatedAt: '2026-04-05T12:00:00.000Z',
};

describe('UserStatsApiService', () => {
  let service: UserStatsApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: Firestore, useValue: {} }],
    });
    service = TestBed.inject(UserStatsApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('returns null when userStats document does not exist', async () => {
    const result = await firstValueFrom(service.getUserStats('no-stats-user'));
    expect(result).toBeNull();
  });

  it('returns UserStats when document exists', async () => {
    jest.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => fullMockStats,
    } as never);

    const result = await firstValueFrom(service.getUserStats('test-uid'));
    expect(result).toEqual(fullMockStats);
  });
});
