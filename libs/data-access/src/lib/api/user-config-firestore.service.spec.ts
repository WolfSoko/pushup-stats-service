// Minimal mock for @angular/fire/firestore to avoid loading the real SDK
jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  collection: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  getDoc: jest.fn(async () => ({ exists: () => false, data: () => undefined })),
  setDoc: jest.fn(() => Promise.resolve()),
  updateDoc: jest.fn(() => Promise.resolve()),
  DocumentReference: jest.fn(),
}));

import { TestBed } from '@angular/core/testing';
import { UserConfigFirestoreService } from './user-config-firestore.service';
import { Firestore } from '@angular/fire/firestore';
import { UserConfig, UserConfigUpdate } from '@pu-stats/models';
import { firstValueFrom } from 'rxjs';
import * as firestoreFns from '@angular/fire/firestore';

describe('UserConfigFirestoreService', () => {
  let service: UserConfigFirestoreService;

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        UserConfigFirestoreService,
        { provide: Firestore, useValue: {} },
      ],
    });
    service = TestBed.inject(UserConfigFirestoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call getDoc with correct ref in getConfig', async () => {
    const userId = 'test-user';
    const ref = {};
    jest.spyOn(firestoreFns, 'doc').mockReturnValue(ref as any);
    const getDocSpy = jest
      .spyOn(firestoreFns, 'getDoc')
      .mockResolvedValue({
        exists: () => true,
        data: () => ({ displayName: 'Test', dailyGoal: 10 }),
      } as any);

    const value = await firstValueFrom(service.getConfig(userId));

    expect(firestoreFns.doc).toHaveBeenCalled();
    expect(getDocSpy).toHaveBeenCalledWith(ref);
    expect(value).toEqual({ displayName: 'Test', dailyGoal: 10 });
  });

  it('should call setDoc with merge=true in updateConfig', async () => {
    const userId = 'test-user';
    const patch: UserConfigUpdate = { displayName: 'New', dailyGoal: 20 };
    const ref = {};
    jest.spyOn(firestoreFns, 'doc').mockReturnValue(ref as any);
    const setDocSpy = jest
      .spyOn(firestoreFns, 'setDoc')
      .mockResolvedValue(undefined as any);
    await service.updateConfig(userId, patch);
    expect(firestoreFns.doc).toHaveBeenCalled();
    expect(setDocSpy).toHaveBeenCalledWith(ref, patch, { merge: true });
  });

  it('should call setDoc with correct ref and config in setConfig', async () => {
    const userId = 'test-user';
    const config: UserConfig = { displayName: 'Set', dailyGoal: 30 } as any;
    const ref = {};
    jest.spyOn(firestoreFns, 'doc').mockReturnValue(ref as any);
    const setDocSpy = jest
      .spyOn(firestoreFns, 'setDoc')
      .mockResolvedValue(undefined as any);
    await service.setConfig(userId, config);
    expect(firestoreFns.doc).toHaveBeenCalled();
    expect(setDocSpy).toHaveBeenCalledWith(ref, config);
  });
});
