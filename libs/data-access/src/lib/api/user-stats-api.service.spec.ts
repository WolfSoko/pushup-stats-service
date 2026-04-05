jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  doc: jest.fn(() => ({})),
  getDoc: jest.fn(() =>
    Promise.resolve({ exists: () => false, data: () => null })
  ),
}));

import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { UserStatsApiService } from './user-stats-api.service';
import { firstValueFrom } from 'rxjs';

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
    const { getDoc } = jest.requireMock('@angular/fire/firestore');
    const mockStats = {
      userId: 'test-uid',
      total: 500,
      totalEntries: 25,
      dailyReps: 30,
      dailyKey: '2026-04-05',
    };
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => mockStats,
    });

    const result = await firstValueFrom(service.getUserStats('test-uid'));
    expect(result).toEqual(mockStats);
  });
});
