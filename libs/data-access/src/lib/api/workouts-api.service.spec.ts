import { Auth } from '@angular/fire/auth';
import * as firestoreFns from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';

import { WorkoutsApiService } from './workouts-api.service';

jest.mock('@angular/fire/auth', () => ({
  Auth: jest.fn(),
}));

jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  collection: jest.fn(() => ({ path: 'workouts' })),
  collectionData: jest.fn(),
  doc: jest.fn(),
  query: jest.fn((_ref: unknown, ...constraints: unknown[]) => ({
    constraints,
  })),
  where: jest.fn((field: string, op: string, value: unknown) => ({
    field,
    op,
    value,
  })),
  orderBy: jest.fn((field: string, dir: string) => ({ field, dir })),
  setDoc: jest.fn(() => Promise.resolve()),
  updateDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
}));

const VALID_DOC = {
  ownerId: 'u1',
  title: 'Kurz und knackig',
  description: '',
  exercises: [{ exerciseId: 'pushup', target: 20 }],
  onProfile: false,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

function setup(uid: string | null = 'u1'): WorkoutsApiService {
  TestBed.configureTestingModule({
    providers: [
      WorkoutsApiService,
      { provide: Firestore, useValue: {} },
      { provide: Auth, useValue: { currentUser: uid ? { uid } : null } },
    ],
  });
  return TestBed.inject(WorkoutsApiService);
}

describe('WorkoutsApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.resetTestingModule();
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'new-id' });
  });

  describe('listWorkouts', () => {
    it('should query the owner’s workouts newest first and drop invalid documents', async () => {
      // given — one valid document and one a client wrote by hand
      (firestoreFns.collectionData as jest.Mock).mockReturnValue(
        of([
          { id: 'w1', ...VALID_DOC },
          { id: 'w2', ...VALID_DOC, exercises: [] },
        ])
      );
      const service = setup();

      // when
      const workouts = await firstValueFrom(service.listWorkouts('ignored'));

      // then
      expect(firestoreFns.where).toHaveBeenCalledWith('ownerId', '==', 'u1');
      expect(firestoreFns.orderBy).toHaveBeenCalledWith('updatedAt', 'desc');
      expect(workouts.map((w) => w.id)).toEqual(['w1']);
      expect(workouts[0].ownerId).toBe('u1');
    });

    it('should stream an empty list without a signed-in user', async () => {
      const service = setup(null);
      expect(await firstValueFrom(service.listWorkouts(''))).toEqual([]);
      expect(firestoreFns.collectionData).not.toHaveBeenCalled();
    });
  });

  describe('createWorkout', () => {
    it('should write a fresh document owned by the signed-in user', async () => {
      // given
      const service = setup();

      // when
      const id = await service.createWorkout(
        'u1',
        {
          title: '  Beine  ',
          description: 'Hart',
          exercises: [
            { exerciseId: 'legs.squats', target: 30, sets: [15, 15] },
            { exerciseId: 'plank.standard', target: 60, variantId: undefined },
          ],
          onProfile: true,
        },
        { uid: 'friend', workoutId: 'src', displayName: 'Anna' }
      );

      // then — trimmed title, no `undefined` fields, source kept
      expect(id).toBe('new-id');
      const [, payload] = (firestoreFns.setDoc as jest.Mock).mock.calls[0];
      expect(payload).toMatchObject({
        ownerId: 'u1',
        title: 'Beine',
        description: 'Hart',
        onProfile: true,
        sharedBy: { uid: 'friend', workoutId: 'src', displayName: 'Anna' },
      });
      expect(payload.exercises).toEqual([
        { exerciseId: 'legs.squats', target: 30, sets: [15, 15] },
        { exerciseId: 'plank.standard', target: 60 },
      ]);
      expect(payload.exercises[1]).not.toHaveProperty('variantId');
      expect(typeof payload.createdAt).toBe('string');
      expect(payload.updatedAt).toBe(payload.createdAt);
    });

    it('should not write without a signed-in user', async () => {
      const service = setup(null);
      const id = await service.createWorkout('', {
        title: 'x',
        description: '',
        exercises: [],
        onProfile: false,
      });
      expect(id).toBe('');
      expect(firestoreFns.setDoc).not.toHaveBeenCalled();
    });
  });

  describe('updateWorkout', () => {
    it('should patch the editable fields and stamp updatedAt', async () => {
      // given
      const service = setup();

      // when
      await service.updateWorkout('u1', 'w1', {
        title: 'Neu',
        description: '',
        exercises: [{ exerciseId: 'pushup', target: 10 }],
        onProfile: false,
      });

      // then
      expect(firestoreFns.doc).toHaveBeenCalledWith({}, 'workouts', 'w1');
      const [, patch] = (firestoreFns.updateDoc as jest.Mock).mock.calls[0];
      expect(patch).toMatchObject({ title: 'Neu', onProfile: false });
      expect(patch).not.toHaveProperty('ownerId');
      expect(typeof patch.updatedAt).toBe('string');
    });
  });

  describe('setOnProfile', () => {
    it('should flip only the profile flag', async () => {
      const service = setup();
      await service.setOnProfile('u1', 'w1', true);
      const [, patch] = (firestoreFns.updateDoc as jest.Mock).mock.calls[0];
      expect(Object.keys(patch).sort()).toEqual(['onProfile', 'updatedAt']);
      expect(patch.onProfile).toBe(true);
    });
  });

  describe('deleteWorkout', () => {
    it('should delete the document', async () => {
      const service = setup();
      await service.deleteWorkout('u1', 'w1');
      expect(firestoreFns.deleteDoc).toHaveBeenCalledTimes(1);
    });

    it('should ignore an empty id', async () => {
      const service = setup();
      await service.deleteWorkout('u1', '');
      expect(firestoreFns.deleteDoc).not.toHaveBeenCalled();
    });
  });
});
