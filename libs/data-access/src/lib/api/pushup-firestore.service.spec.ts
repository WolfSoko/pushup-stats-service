// Minimal mock for @angular/fire/firestore to avoid loading the real SDK
vi.mock('@angular/fire/firestore', () => ({
  Firestore: vi.fn(),
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({ id: 'new-id' })),
  query: vi.fn((_ref, ...constraints) => ({ constraints })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  orderBy: vi.fn((field, dir) => ({ field, dir })),
  getDocs: vi.fn(async () => ({ docs: [] })),
  setDoc: vi.fn(async () => undefined),
  updateDoc: vi.fn(async () => undefined),
  deleteDoc: vi.fn(async () => undefined),
}));

import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import * as firestoreFns from '@angular/fire/firestore';
import { PushupFirestoreService } from './pushup-firestore.service';

describe('PushupFirestoreService', () => {
  let service: PushupFirestoreService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [PushupFirestoreService, { provide: Firestore, useValue: {} }],
    });
    service = TestBed.inject(PushupFirestoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('listPushups', () => {
    it('returns mapped records without filter', async () => {
      vi.spyOn(firestoreFns, 'getDocs').mockResolvedValueOnce({
        docs: [
          {
            id: 'a1',
            data: () => ({
              timestamp: '2024-01-05T10:00:00Z',
              reps: 10,
              source: 'web',
              userId: 'u1',
            }),
          },
          {
            id: 'a2',
            data: () => ({
              timestamp: '2024-01-10T12:00:00Z',
              reps: 5,
              source: 'web',
              userId: 'u1',
            }),
          },
        ],
      } as any);

      const result = await firstValueFrom(service.listPushups('u1'));

      expect(result).toEqual([
        {
          _id: 'a1',
          timestamp: '2024-01-05T10:00:00Z',
          reps: 10,
          source: 'web',
          userId: 'u1',
        },
        {
          _id: 'a2',
          timestamp: '2024-01-10T12:00:00Z',
          reps: 5,
          source: 'web',
          userId: 'u1',
        },
      ]);
    });

    it('adds userId and orderBy constraints to query', async () => {
      vi.spyOn(firestoreFns, 'getDocs').mockResolvedValueOnce({
        docs: [],
      } as any);

      await firstValueFrom(service.listPushups('u1'));

      expect(firestoreFns.where).toHaveBeenCalledWith('userId', '==', 'u1');
      expect(firestoreFns.orderBy).toHaveBeenCalledWith('timestamp', 'asc');
    });

    it('adds a from constraint when filter.from is provided', async () => {
      vi.spyOn(firestoreFns, 'getDocs').mockResolvedValueOnce({
        docs: [],
      } as any);

      await firstValueFrom(service.listPushups('u1', { from: '2024-01-05' }));

      expect(firestoreFns.where).toHaveBeenCalledWith(
        'timestamp',
        '>=',
        '2024-01-05T00:00:00.000Z'
      );
    });

    it('adds a to constraint when filter.to is provided', async () => {
      vi.spyOn(firestoreFns, 'getDocs').mockResolvedValueOnce({
        docs: [],
      } as any);

      await firstValueFrom(service.listPushups('u1', { to: '2024-01-10' }));

      expect(firestoreFns.where).toHaveBeenCalledWith(
        'timestamp',
        '<=',
        '2024-01-10T23:59:59.999Z'
      );
    });

    it('does not add from/to constraints when filter is empty', async () => {
      vi.spyOn(firestoreFns, 'getDocs').mockResolvedValueOnce({
        docs: [],
      } as any);

      await firstValueFrom(service.listPushups('u1', {}));

      const whereCalls = vi.mocked(firestoreFns.where).mock.calls;
      const timestampCalls = whereCalls.filter(
        ([field]) => field === 'timestamp'
      );
      expect(timestampCalls).toHaveLength(0);
    });

    it('client-side filters out records before filter.from', async () => {
      vi.spyOn(firestoreFns, 'getDocs').mockResolvedValueOnce({
        docs: [
          {
            id: 'before',
            data: () => ({
              timestamp: '2024-01-04T23:59:59Z',
              reps: 1,
              source: 's',
            }),
          },
          {
            id: 'on-from',
            data: () => ({
              timestamp: '2024-01-05T00:00:00Z',
              reps: 2,
              source: 's',
            }),
          },
          {
            id: 'after',
            data: () => ({
              timestamp: '2024-01-06T00:00:00Z',
              reps: 3,
              source: 's',
            }),
          },
        ],
      } as any);

      const result = await firstValueFrom(
        service.listPushups('u1', { from: '2024-01-05' })
      );

      expect(result.map((r) => r._id)).toEqual(['on-from', 'after']);
    });

    it('client-side filters out records after filter.to', async () => {
      vi.spyOn(firestoreFns, 'getDocs').mockResolvedValueOnce({
        docs: [
          {
            id: 'before',
            data: () => ({
              timestamp: '2024-01-09T23:59:59Z',
              reps: 1,
              source: 's',
            }),
          },
          {
            id: 'on-to',
            data: () => ({
              timestamp: '2024-01-10T00:00:00Z',
              reps: 2,
              source: 's',
            }),
          },
          {
            id: 'after',
            data: () => ({
              timestamp: '2024-01-11T00:00:00Z',
              reps: 3,
              source: 's',
            }),
          },
        ],
      } as any);

      const result = await firstValueFrom(
        service.listPushups('u1', { to: '2024-01-10' })
      );

      expect(result.map((r) => r._id)).toEqual(['before', 'on-to']);
    });

    it('client-side filters using both from and to', async () => {
      vi.spyOn(firestoreFns, 'getDocs').mockResolvedValueOnce({
        docs: [
          {
            id: 'too-early',
            data: () => ({
              timestamp: '2024-01-04T00:00:00Z',
              reps: 1,
              source: 's',
            }),
          },
          {
            id: 'in-range',
            data: () => ({
              timestamp: '2024-01-07T00:00:00Z',
              reps: 2,
              source: 's',
            }),
          },
          {
            id: 'too-late',
            data: () => ({
              timestamp: '2024-01-11T00:00:00Z',
              reps: 3,
              source: 's',
            }),
          },
        ],
      } as any);

      const result = await firstValueFrom(
        service.listPushups('u1', { from: '2024-01-05', to: '2024-01-10' })
      );

      expect(result.map((r) => r._id)).toEqual(['in-range']);
    });
  });

  describe('createPushup', () => {
    it('calls setDoc and returns a PushupRecord with the new id', async () => {
      const newRef = { id: 'created-id' };
      vi.spyOn(firestoreFns, 'doc').mockReturnValueOnce(newRef as any);
      const setDocSpy = vi
        .spyOn(firestoreFns, 'setDoc')
        .mockResolvedValueOnce(undefined as any);

      const result = await firstValueFrom(
        service.createPushup('u1', {
          timestamp: '2024-01-01T10:00:00Z',
          reps: 5,
          source: 'web',
        })
      );

      expect(setDocSpy).toHaveBeenCalledWith(
        newRef,
        expect.objectContaining({
          timestamp: '2024-01-01T10:00:00Z',
          reps: 5,
          source: 'web',
          userId: 'u1',
        })
      );
      expect(result._id).toBe('created-id');
      expect(result.reps).toBe(5);
      expect(result.source).toBe('web');
    });

    it('defaults source to "web" and type to "Standard" when omitted', async () => {
      const newRef = { id: 'default-id' };
      vi.spyOn(firestoreFns, 'doc').mockReturnValueOnce(newRef as any);
      vi.spyOn(firestoreFns, 'setDoc').mockResolvedValueOnce(undefined as any);

      const result = await firstValueFrom(
        service.createPushup('u1', {
          timestamp: '2024-01-01T10:00:00Z',
          reps: 3,
        })
      );

      expect(result.source).toBe('web');
      expect(result.type).toBe('Standard');
    });
  });

  describe('updatePushup', () => {
    it('calls updateDoc with the patch and updatedAt timestamp', async () => {
      const rowRef = {};
      vi.spyOn(firestoreFns, 'doc').mockReturnValueOnce(rowRef as any);
      const updateDocSpy = vi
        .spyOn(firestoreFns, 'updateDoc')
        .mockResolvedValueOnce(undefined as any);

      await firstValueFrom(service.updatePushup('id1', { reps: 8 }));

      expect(firestoreFns.doc).toHaveBeenCalled();
      expect(updateDocSpy).toHaveBeenCalledWith(
        rowRef,
        expect.objectContaining({ reps: 8, updatedAt: expect.any(String) })
      );
    });
  });

  describe('deletePushup', () => {
    it('calls deleteDoc and returns { ok: true }', async () => {
      const rowRef = {};
      vi.spyOn(firestoreFns, 'doc').mockReturnValueOnce(rowRef as any);
      const deleteDocSpy = vi
        .spyOn(firestoreFns, 'deleteDoc')
        .mockResolvedValueOnce(undefined as any);

      const result = await firstValueFrom(service.deletePushup('id1'));

      expect(deleteDocSpy).toHaveBeenCalledWith(rowRef);
      expect(result).toEqual({ ok: true });
    });
  });
});
