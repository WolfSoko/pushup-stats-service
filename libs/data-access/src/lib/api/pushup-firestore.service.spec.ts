// Minimal mock for @angular/fire/firestore to avoid loading the real SDK
jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  collection: jest.fn(() => ({})),
  doc: jest.fn(() => ({ id: 'new-id' })),
  query: jest.fn((_ref, ...constraints) => ({ constraints })),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  orderBy: jest.fn((field, dir) => ({ field, dir })),
  getDocs: jest.fn(async () => ({ docs: [] })),
  setDoc: jest.fn(async () => undefined),
  updateDoc: jest.fn(async () => undefined),
  deleteDoc: jest.fn(async () => undefined),
}));

import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import * as firestoreFns from '@angular/fire/firestore';
import { PushupFirestoreService } from './pushup-firestore.service';

describe('PushupFirestoreService', () => {
  let service: PushupFirestoreService;

  beforeEach(() => {
    jest.clearAllMocks();
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
      jest.spyOn(firestoreFns, 'getDocs').mockResolvedValueOnce({
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
      jest.spyOn(firestoreFns, 'getDocs').mockResolvedValueOnce({
        docs: [],
      } as any);

      await firstValueFrom(service.listPushups('u1'));

      expect(firestoreFns.where).toHaveBeenCalledWith('userId', '==', 'u1');
      expect(firestoreFns.orderBy).toHaveBeenCalledWith('timestamp', 'asc');
    });

    it('adds a from constraint when filter.from is provided', async () => {
      jest.spyOn(firestoreFns, 'getDocs').mockResolvedValueOnce({
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
      jest.spyOn(firestoreFns, 'getDocs').mockResolvedValueOnce({
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
      jest.spyOn(firestoreFns, 'getDocs').mockResolvedValueOnce({
        docs: [],
      } as any);

      await firstValueFrom(service.listPushups('u1', {}));

      const whereCalls = (firestoreFns.where as jest.Mock).mock.calls;
      const timestampCalls = whereCalls.filter(
        ([field]) => field === 'timestamp'
      );
      expect(timestampCalls).toHaveLength(0);
    });

    it('client-side filters out records before filter.from', async () => {
      jest.spyOn(firestoreFns, 'getDocs').mockResolvedValueOnce({
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
      jest.spyOn(firestoreFns, 'getDocs').mockResolvedValueOnce({
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
      jest.spyOn(firestoreFns, 'getDocs').mockResolvedValueOnce({
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
      jest.spyOn(firestoreFns, 'doc').mockReturnValueOnce(newRef as any);
      const setDocSpy = jest
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

    it('persists sets array when provided', async () => {
      const newRef = { id: 'sets-id' };
      jest.spyOn(firestoreFns, 'doc').mockReturnValueOnce(newRef as any);
      const setDocSpy = jest
        .spyOn(firestoreFns, 'setDoc')
        .mockResolvedValueOnce(undefined as any);

      const result = await firstValueFrom(
        service.createPushup('u1', {
          timestamp: '2024-01-01T10:00:00Z',
          reps: 30,
          sets: [10, 10, 10],
          source: 'web',
        })
      );

      expect(setDocSpy).toHaveBeenCalledWith(
        newRef,
        expect.objectContaining({
          reps: 30,
          sets: [10, 10, 10],
        })
      );
      expect(result.sets).toEqual([10, 10, 10]);
    });

    it('omits sets from Firestore when not provided', async () => {
      const newRef = { id: 'no-sets-id' };
      jest.spyOn(firestoreFns, 'doc').mockReturnValueOnce(newRef as any);
      const setDocSpy = jest
        .spyOn(firestoreFns, 'setDoc')
        .mockResolvedValueOnce(undefined as any);

      await firstValueFrom(
        service.createPushup('u1', {
          timestamp: '2024-01-01T10:00:00Z',
          reps: 5,
        })
      );

      const writtenData = setDocSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(writtenData).not.toHaveProperty('sets');
    });

    it('omits sets from Firestore when empty array is provided', async () => {
      const newRef = { id: 'empty-sets-id' };
      jest.spyOn(firestoreFns, 'doc').mockReturnValueOnce(newRef as any);
      const setDocSpy = jest
        .spyOn(firestoreFns, 'setDoc')
        .mockResolvedValueOnce(undefined as any);

      await firstValueFrom(
        service.createPushup('u1', {
          timestamp: '2024-01-01T10:00:00Z',
          reps: 5,
          sets: [],
        })
      );

      const writtenData = setDocSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(writtenData).not.toHaveProperty('sets');
    });

    it('defaults source to "web" and type to "Standard" when omitted', async () => {
      const newRef = { id: 'default-id' };
      jest.spyOn(firestoreFns, 'doc').mockReturnValueOnce(newRef as any);
      jest
        .spyOn(firestoreFns, 'setDoc')
        .mockResolvedValueOnce(undefined as any);

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
      jest.spyOn(firestoreFns, 'doc').mockReturnValueOnce(rowRef as any);
      const updateDocSpy = jest
        .spyOn(firestoreFns, 'updateDoc')
        .mockResolvedValueOnce(undefined as any);

      await firstValueFrom(service.updatePushup('id1', { reps: 8 }));

      expect(firestoreFns.doc).toHaveBeenCalled();
      expect(updateDocSpy).toHaveBeenCalledWith(
        rowRef,
        expect.objectContaining({ reps: 8, updatedAt: expect.any(String) })
      );
    });

    it('strips undefined values from payload before calling updateDoc', async () => {
      const rowRef = {};
      jest.spyOn(firestoreFns, 'doc').mockReturnValueOnce(rowRef as any);
      const updateDocSpy = jest
        .spyOn(firestoreFns, 'updateDoc')
        .mockResolvedValueOnce(undefined as any);

      await firstValueFrom(
        service.updatePushup('id1', {
          reps: 8,
          source: undefined,
          sets: undefined,
        })
      );

      const payload = updateDocSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(payload).toHaveProperty('reps', 8);
      expect(payload).toHaveProperty('updatedAt');
      expect(payload).not.toHaveProperty('source');
      expect(payload).not.toHaveProperty('sets');
    });
  });

  describe('deletePushup', () => {
    it('calls deleteDoc and returns { ok: true }', async () => {
      const rowRef = {};
      jest.spyOn(firestoreFns, 'doc').mockReturnValueOnce(rowRef as any);
      const deleteDocSpy = jest
        .spyOn(firestoreFns, 'deleteDoc')
        .mockResolvedValueOnce(undefined as any);

      const result = await firstValueFrom(service.deletePushup('id1'));

      expect(deleteDocSpy).toHaveBeenCalledWith(rowRef);
      expect(result).toEqual({ ok: true });
    });
  });
});
