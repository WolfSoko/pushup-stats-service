import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { UserConfigApiService } from './user-config-api.service';
import { Firestore } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';

describe('UserConfigApiService', () => {
  describe('without Firestore', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: Firestore, useValue: null },
          { provide: Auth, useValue: null },
        ],
      });
    });

    it('returns default config when firestore is missing', async () => {
      const service = TestBed.inject(UserConfigApiService);
      const config = await firstValueFrom(service.getConfig('u1'));
      expect(config).toEqual({ userId: 'u1' });
    });

    it('returns patched config for updateConfig when firestore is missing', async () => {
      const service = TestBed.inject(UserConfigApiService);
      const result = await firstValueFrom(
        service.updateConfig('u1', { colorTheme: 'dark' })
      );
      expect(result).toMatchObject({ colorTheme: 'dark' });
    });
  });

  describe('with Firestore', () => {
    const mockFirestore = {
      collection: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: Firestore, useValue: mockFirestore },
          { provide: Auth, useValue: { currentUser: null } },
        ],
      });
    });

    it('is created', () => {
      const service = TestBed.inject(UserConfigApiService);
      expect(service).toBeTruthy();
    });
  });
});
