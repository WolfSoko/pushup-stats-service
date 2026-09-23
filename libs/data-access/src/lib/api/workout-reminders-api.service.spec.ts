import { Auth } from '@angular/fire/auth';
import * as firestoreFns from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';

import { WorkoutRemindersApiService } from './workout-reminders-api.service';
import { PendingRequestsService } from '../pending-requests.service';

jest.mock('@angular/fire/auth', () => ({
  Auth: jest.fn(),
}));

jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  collection: jest.fn(() => ({ path: 'workoutReminders' })),
  collectionData: jest.fn(),
  doc: jest.fn((_fs: unknown, ...segments: string[]) => ({
    path: segments.join('/'),
  })),
  query: jest.fn((_ref: unknown, ...constraints: unknown[]) => ({
    constraints,
  })),
  where: jest.fn((field: string, op: string, value: unknown) => ({
    field,
    op,
    value,
  })),
  setDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
}));

const STORED = {
  ownerId: 'u1',
  workoutId: 'w1',
  enabled: true,
  time: '15:00',
  repeat: { kind: 'interval', everyDays: 2, startDate: '2026-09-23' },
  timezone: 'Europe/Berlin',
  nextAt: '2026-09-23T13:00:00.000Z',
  updatedAt: '2026-09-23T10:00:00.000Z',
};

function setup(uid: string | null = 'u1'): {
  service: WorkoutRemindersApiService;
  track: jest.Mock;
} {
  const track = jest.fn((p: Promise<unknown>) => p);
  TestBed.configureTestingModule({
    providers: [
      WorkoutRemindersApiService,
      { provide: Firestore, useValue: {} },
      { provide: Auth, useValue: { currentUser: uid ? { uid } : null } },
      { provide: PendingRequestsService, useValue: { track } },
    ],
  });
  return { service: TestBed.inject(WorkoutRemindersApiService), track };
}

describe('WorkoutRemindersApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('listReminders', () => {
    it('should query the signed-in user’s reminders and drop invalid ones', async () => {
      // given
      (firestoreFns.collectionData as jest.Mock).mockReturnValue(
        of([
          { id: 'w1', ...STORED },
          { id: 'w2', ...STORED, time: 'later' },
        ])
      );
      const { service } = setup();

      // when
      const reminders = await firstValueFrom(service.listReminders('ignored'));

      // then
      expect(firestoreFns.where).toHaveBeenCalledWith('ownerId', '==', 'u1');
      expect(reminders.map((r) => r.workoutId)).toEqual(['w1']);
    });

    it('should stream an empty list without a user', async () => {
      // given
      const { service } = setup(null);

      // when
      const reminders = await firstValueFrom(service.listReminders(''));

      // then
      expect(reminders).toEqual([]);
      expect(firestoreFns.collectionData).not.toHaveBeenCalled();
    });
  });

  describe('saveReminder', () => {
    it('should replace the document keyed by the workout id with nextAt resolved', async () => {
      // given
      jest.useFakeTimers({ now: new Date('2026-09-23T10:00:00.000Z') });
      const { service, track } = setup();

      // when
      await service.saveReminder('ignored', 'w1', {
        enabled: true,
        time: '15:00',
        repeat: { kind: 'interval', everyDays: 2, startDate: '2026-09-23' },
        timezone: 'Europe/Berlin',
      });

      // then
      expect(firestoreFns.setDoc).toHaveBeenCalledWith(
        { path: 'workoutReminders/w1' },
        {
          ownerId: 'u1',
          workoutId: 'w1',
          enabled: true,
          time: '15:00',
          repeat: { kind: 'interval', everyDays: 2, startDate: '2026-09-23' },
          timezone: 'Europe/Berlin',
          nextAt: '2026-09-23T13:00:00.000Z',
          updatedAt: '2026-09-23T10:00:00.000Z',
        }
      );
      expect(track).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteReminder', () => {
    it('should delete the workout’s reminder document', async () => {
      // given
      const { service, track } = setup();

      // when
      await service.deleteReminder('u1', 'w1');

      // then
      expect(firestoreFns.deleteDoc).toHaveBeenCalledWith({
        path: 'workoutReminders/w1',
      });
      expect(track).toHaveBeenCalledTimes(1);
    });

    it('should do nothing without a workout id', async () => {
      // given
      const { service } = setup();

      // when
      await service.deleteReminder('u1', '');

      // then
      expect(firestoreFns.deleteDoc).not.toHaveBeenCalled();
    });
  });
});
