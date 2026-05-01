jest.mock('@angular/fire/functions', () => ({
  Functions: jest.fn(),
  // Implementation is set per-test below.
  httpsCallable: jest.fn(),
}));

import { TestBed } from '@angular/core/testing';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { type PublicProfile } from '@pu-stats/models';
import { PublicProfileApiService } from './public-profile-api.service';

const sampleProfile: PublicProfile = {
  uid: 'abcdef1234567890',
  displayName: 'Wolfi',
  total: 5000,
  totalEntries: 200,
  totalDays: 90,
  currentStreak: 14,
  bestSingleEntry: 50,
  bestDayTotal: 250,
  updatedAt: '2026-04-29T08:30:00.000Z',
};

describe('PublicProfileApiService', () => {
  function setup(callableImpl: (data: unknown) => Promise<unknown>): {
    service: PublicProfileApiService;
    spy: jest.Mock;
  } {
    const spy = jest.fn(callableImpl);
    (httpsCallable as unknown as jest.Mock).mockReturnValue(spy);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PublicProfileApiService,
        { provide: Functions, useValue: {} },
      ],
    });
    return { service: TestBed.inject(PublicProfileApiService), spy };
  }

  describe('getProfile', () => {
    it('Given the callable resolves with a projection, Then returns it', async () => {
      const { service, spy } = setup(async () => ({ data: sampleProfile }));

      const result = await service.getProfile('abcdef1234567890');

      expect(result).toEqual(sampleProfile);
      expect(spy).toHaveBeenCalledWith({ uid: 'abcdef1234567890' });
    });

    it('Given the callable rejects with functions/not-found, Then returns null', async () => {
      const err = Object.assign(new Error('private'), {
        code: 'functions/not-found',
      });
      const { service } = setup(async () => {
        throw err;
      });

      const result = await service.getProfile('abcdef1234567890');

      expect(result).toBeNull();
    });

    it('Given the callable rejects with bare not-found code, Then returns null', async () => {
      // Some Firebase Functions SDK versions strip the `functions/` prefix.
      const err = Object.assign(new Error('private'), { code: 'not-found' });
      const { service } = setup(async () => {
        throw err;
      });

      const result = await service.getProfile('abcdef1234567890');

      expect(result).toBeNull();
    });

    it('Given the callable rejects with another error code, Then re-throws', async () => {
      const err = Object.assign(new Error('boom'), {
        code: 'functions/internal',
      });
      const { service } = setup(async () => {
        throw err;
      });

      await expect(service.getProfile('abcdef1234567890')).rejects.toBe(err);
    });

    it('Given the callable resolves with no data, Then returns null', async () => {
      const { service } = setup(async () => ({}));

      const result = await service.getProfile('abcdef1234567890');

      expect(result).toBeNull();
    });
  });
});
