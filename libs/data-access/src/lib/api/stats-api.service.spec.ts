import { PLATFORM_ID } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { PushupRecord } from '@pu-stats/models';
import { render } from '@testing-library/angular';
import { firstValueFrom, of } from 'rxjs';
import { StatsApiService } from './stats-api.service';
import { PushupFirestoreService } from './pushup-firestore.service';
import { UserConfigFirestoreService } from './user-config-firestore.service';

jest.mock('@angular/fire/auth', () => ({
  Auth: jest.fn(),
}));

jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  collection: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  orderBy: jest.fn(() => ({})),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  getDoc: jest.fn(() => Promise.resolve({ data: () => ({}) })),
  doc: jest.fn(() => ({ id: 'new-id' })),
  setDoc: jest.fn(() => Promise.resolve()),
  updateDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
}));

const authMock = { currentUser: { uid: 'test-uid' } };
const unauthMock = { currentUser: null };

describe('StatsApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads stats from Firestore in browser', async () => {
    const firestoreFns = await import('@angular/fire/firestore');
    (firestoreFns.getDocs as jest.Mock).mockResolvedValueOnce({
      docs: [
        {
          id: '1',
          data: () => ({
            timestamp: '2024-01-01T10:00:00Z',
            reps: 10,
            source: 'web',
          }),
        },
        {
          id: '2',
          data: () => ({
            timestamp: '2024-01-01T11:00:00Z',
            reps: 5,
            source: 'web',
          }),
        },
      ],
    });
    (firestoreFns.getDoc as jest.Mock).mockResolvedValue({
      data: () => ({ userId: 'u1', dailyGoal: 100 }),
    });

    const { fixture } = await render('', {
      providers: [
        StatsApiService,
        { provide: Auth, useValue: authMock },
        { provide: Firestore, useValue: {} },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    const service = fixture.debugElement.injector.get(StatsApiService);
    const result = await firstValueFrom(
      service.load({ from: '2024-01-01', to: '2024-01-01' })
    );

    expect(result.meta.total).toBe(15);
  });

  it('returns empty stats when pushup firestore is unavailable', async () => {
    const { fixture } = await render('', {
      providers: [
        StatsApiService,
        { provide: Auth, useValue: unauthMock },
        {
          provide: PushupFirestoreService,
          useValue: {
            listPushups: jest.fn().mockReturnValue(of([])),
            createPushup: jest.fn(),
            updatePushup: jest.fn(),
            deletePushup: jest.fn(),
          },
        },
        { provide: UserConfigFirestoreService, useValue: null },
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    const service = fixture.debugElement.injector.get(StatsApiService);
    const result = await firstValueFrom(service.load());
    expect(result.meta.total).toBe(0);
    expect(result.series).toEqual([]);
  });

  it('returns empty list when unauthenticated', async () => {
    const { fixture } = await render('', {
      providers: [
        StatsApiService,
        { provide: Auth, useValue: unauthMock },
        { provide: Firestore, useValue: {} },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const service = fixture.debugElement.injector.get(StatsApiService);
    const result = await firstValueFrom(service.listPushups());
    expect(result).toEqual([]);
  });

  it('filters pushups in browser list mode by passing constraints to Firestore', async () => {
    const firestoreFns = await import('@angular/fire/firestore');
    // Simulate Firestore returning only records that match the server-side filter
    (firestoreFns.getDocs as jest.Mock).mockResolvedValue({
      docs: [
        {
          id: '2',
          data: () => ({
            timestamp: '2024-01-10T00:00:00Z',
            reps: 5,
            source: 's',
          }),
        },
      ],
    });

    const { fixture } = await render('', {
      providers: [
        StatsApiService,
        { provide: Auth, useValue: authMock },
        { provide: Firestore, useValue: {} },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const service = fixture.debugElement.injector.get(StatsApiService);
    let result: PushupRecord[] | undefined;
    service
      .listPushups({ from: '2024-01-05', to: '2024-01-15' })
      .subscribe((r) => (result = r));
    await Promise.resolve();
    expect(result).toEqual([
      { _id: '2', timestamp: '2024-01-10T00:00:00Z', reps: 5, source: 's' },
    ]);
    // Verify the timestamp filters were pushed into the Firestore query
    expect(firestoreFns.where).toHaveBeenCalledWith(
      'timestamp',
      '>=',
      '2024-01-05T00:00:00.000Z'
    );
    expect(firestoreFns.where).toHaveBeenCalledWith(
      'timestamp',
      '<=',
      '2024-01-15T23:59:59.999Z'
    );
  });

  it('uses firestore writes in browser for create/update/delete', async () => {
    const firestoreFns = await import('@angular/fire/firestore');
    (firestoreFns.doc as jest.Mock)
      .mockReturnValueOnce({ id: 'new1' })
      .mockReturnValueOnce({ id: 'new1' })
      .mockReturnValueOnce({ id: 'new1' });
    (firestoreFns.getDocs as jest.Mock).mockResolvedValue({
      docs: [
        {
          id: 'new1',
          data: () => ({
            timestamp: '2024-01-01T00:00:00Z',
            reps: 2,
            source: 'web',
          }),
        },
      ],
    });

    const { fixture } = await render('', {
      providers: [
        StatsApiService,
        { provide: Auth, useValue: authMock },
        { provide: Firestore, useValue: {} },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    const service = fixture.debugElement.injector.get(StatsApiService);
    service
      .createPushup({ timestamp: '2024-01-01T00:00:00Z', reps: 2 })
      .subscribe();
    service.updatePushup('new1', { reps: 3 }).subscribe();
    service.deletePushup('new1').subscribe();
    await Promise.resolve();

    expect(firestoreFns.setDoc).toHaveBeenCalled();
    expect(firestoreFns.updateDoc).toHaveBeenCalled();
    expect(firestoreFns.deleteDoc).toHaveBeenCalled();
  });

  it('updatePushup always uses Firestore and returns void', async () => {
    const firestoreFns = await import('@angular/fire/firestore');
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'id1' });

    const { fixture } = await render('', {
      providers: [
        StatsApiService,
        { provide: Auth, useValue: authMock },
        { provide: Firestore, useValue: {} },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    const service = fixture.debugElement.injector.get(StatsApiService);
    const result = await firstValueFrom(
      service.updatePushup('id1', { reps: 5 })
    );

    expect(result).toBeUndefined();
    expect(firestoreFns.updateDoc).toHaveBeenCalled();
  });

  it('updatePushup uses Firestore even on server (no HTTP PUT)', async () => {
    const firestoreFns = await import('@angular/fire/firestore');
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'id1' });

    const { fixture } = await render('', {
      providers: [
        StatsApiService,
        { provide: Auth, useValue: authMock },
        { provide: Firestore, useValue: {} },
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });

    const service = fixture.debugElement.injector.get(StatsApiService);
    await firstValueFrom(service.updatePushup('id1', { reps: 5 }));

    expect(firestoreFns.updateDoc).toHaveBeenCalled();
  });
});
