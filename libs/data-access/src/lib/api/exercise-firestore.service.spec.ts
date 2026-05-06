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
import {
  ExerciseFirestoreService,
  ExerciseValidationError,
} from './exercise-firestore.service';

describe('ExerciseFirestoreService', () => {
  let service: ExerciseFirestoreService;

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        ExerciseFirestoreService,
        { provide: Firestore, useValue: {} },
      ],
    });
    service = TestBed.inject(ExerciseFirestoreService);
  });

  describe('Given the service is constructed', () => {
    it('is created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('listEntries', () => {
    it('returns mapped entries from Firestore', async () => {
      jest.spyOn(firestoreFns, 'getDocs').mockResolvedValueOnce({
        docs: [
          {
            id: 's1',
            data: () => ({
              userId: 'u1',
              exerciseId: 'abs.situps',
              timestamp: '2026-04-01T10:00:00Z',
              reps: 30,
              source: 'web',
            }),
          },
          {
            id: 's2',
            data: () => ({
              userId: 'u1',
              exerciseId: 'legs.squats',
              timestamp: '2026-04-02T12:00:00Z',
              reps: 50,
              source: 'web',
            }),
          },
        ],
      } as never);

      const result = await firstValueFrom(service.listEntries('u1'));

      expect(result.map((e) => e._id)).toEqual(['s1', 's2']);
      expect(result[0].exerciseId).toBe('abs.situps');
      expect(result[1].reps).toBe(50);
    });

    it('forwards exerciseId as a query constraint', async () => {
      const whereSpy = jest.spyOn(firestoreFns, 'where');

      await firstValueFrom(
        service.listEntries('u1', { exerciseId: 'legs.squats' })
      );

      const exerciseFilter = whereSpy.mock.calls.find(
        ([field]) => field === 'exerciseId'
      );
      expect(exerciseFilter).toBeDefined();
      expect(exerciseFilter?.[2]).toBe('legs.squats');
    });
  });

  describe('createEntry', () => {
    it('writes a new sit-ups entry to exerciseEntries', async () => {
      const setDocSpy = jest.spyOn(firestoreFns, 'setDoc');

      const result = await firstValueFrom(
        service.createEntry('u1', {
          exerciseId: 'abs.situps',
          timestamp: '2026-04-15T08:00:00Z',
          reps: 25,
          source: 'web',
        })
      );

      expect(result.exerciseId).toBe('abs.situps');
      expect(result.reps).toBe(25);
      expect(setDocSpy).toHaveBeenCalledTimes(1);
      const data = setDocSpy.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(data['exerciseId']).toBe('abs.situps');
      expect(data['reps']).toBe(25);
      expect(data['userId']).toBe('u1');
      expect(data['source']).toBe('web');
    });

    it('errors when the exercise id is unknown', async () => {
      await expect(
        firstValueFrom(
          service.createEntry('u1', {
            exerciseId: 'unknown.exercise',
            timestamp: '2026-04-15T08:00:00Z',
            reps: 10,
          })
        )
      ).rejects.toBeInstanceOf(ExerciseValidationError);
    });

    it('errors when reps is out of range', async () => {
      await expect(
        firstValueFrom(
          service.createEntry('u1', {
            exerciseId: 'legs.squats',
            timestamp: '2026-04-15T08:00:00Z',
            reps: 9999,
          })
        )
      ).rejects.toThrow(/out-of-range/);
    });

    it('errors when reps is missing for a reps-measured exercise', async () => {
      await expect(
        firstValueFrom(
          service.createEntry('u1', {
            exerciseId: 'legs.squats',
            timestamp: '2026-04-15T08:00:00Z',
          })
        )
      ).rejects.toThrow(/measurement-value-missing/);
    });

    it('errors when a non-reps measurement field is also set', async () => {
      await expect(
        firstValueFrom(
          service.createEntry('u1', {
            exerciseId: 'abs.situps',
            timestamp: '2026-04-15T08:00:00Z',
            reps: 10,
            durationSec: 30,
          })
        )
      ).rejects.toThrow(/wrong-measurement-field/);
    });

    it('omits empty sets array from the Firestore payload', async () => {
      const setDocSpy = jest.spyOn(firestoreFns, 'setDoc');
      await firstValueFrom(
        service.createEntry('u1', {
          exerciseId: 'abs.situps',
          timestamp: '2026-04-15T08:00:00Z',
          reps: 10,
          sets: [],
        })
      );
      const data = setDocSpy.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(data['sets']).toBeUndefined();
    });

    it('preserves a non-empty sets array on the Firestore payload', async () => {
      const setDocSpy = jest.spyOn(firestoreFns, 'setDoc');
      await firstValueFrom(
        service.createEntry('u1', {
          exerciseId: 'legs.squats',
          timestamp: '2026-04-15T08:00:00Z',
          reps: 30,
          sets: [10, 10, 10],
        })
      );
      const data = setDocSpy.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(data['sets']).toEqual([10, 10, 10]);
    });

    it('defaults source to "web" when not provided', async () => {
      const setDocSpy = jest.spyOn(firestoreFns, 'setDoc');
      await firstValueFrom(
        service.createEntry('u1', {
          exerciseId: 'abs.situps',
          timestamp: '2026-04-15T08:00:00Z',
          reps: 10,
        })
      );
      const data = setDocSpy.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(data['source']).toBe('web');
    });
  });

  describe('updateEntry', () => {
    it('skips validation when no measurement field is being changed', async () => {
      const updateSpy = jest.spyOn(firestoreFns, 'updateDoc');
      await firstValueFrom(
        service.updateEntry('s1', 'abs.situps', { source: 'mobile' })
      );
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });

    it('errors when the new reps value is out of range', async () => {
      await expect(
        firstValueFrom(
          service.updateEntry('s1', 'abs.situps', { reps: 9999 })
        )
      ).rejects.toThrow(/out-of-range/);
    });

    it('rejects payloads that try to change the exerciseId', async () => {
      await expect(
        firstValueFrom(
          service.updateEntry('s1', 'abs.situps', {
            exerciseId: 'legs.squats',
          })
        )
      ).rejects.toBeInstanceOf(ExerciseValidationError);
    });

    it('strips a pass-through exerciseId that matches the stored value', async () => {
      const updateSpy = jest.spyOn(firestoreFns, 'updateDoc');
      await firstValueFrom(
        service.updateEntry('s1', 'abs.situps', {
          exerciseId: 'abs.situps',
          source: 'mobile',
        })
      );
      const patch = updateSpy.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(patch['exerciseId']).toBeUndefined();
      expect(patch['source']).toBe('mobile');
    });

    it('uses partial validation so a variantId-only update is allowed', async () => {
      // The exercise definition for sit-ups currently has no variants,
      // so an unknown variantId still fails — but an empty string (the
      // sentinel for "no variant") must pass without requiring a reps
      // value in the patch.
      const updateSpy = jest.spyOn(firestoreFns, 'updateDoc');
      await firstValueFrom(
        service.updateEntry('s1', 'abs.situps', { variantId: '' })
      );
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteEntry', () => {
    it('returns ok when delete succeeds', async () => {
      const result = await firstValueFrom(service.deleteEntry('s1'));
      expect(result).toEqual({ ok: true });
    });
  });
});
