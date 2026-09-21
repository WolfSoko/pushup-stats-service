jest.mock('@angular/fire/auth', () => ({ Auth: jest.fn() }));
jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  collection: jest.fn((_db: unknown, path: string) => ({ path })),
  collectionData: jest.fn(),
  doc: jest.fn((_db: unknown, path: string) => ({ path })),
  limit: jest.fn((n: number) => ({ limit: n })),
  orderBy: jest.fn((field: string, dir: string) => ({ field, dir })),
  query: jest.fn((ref: unknown, ...constraints: unknown[]) => ({
    ref,
    constraints,
  })),
  writeBatch: jest.fn(),
}));

import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import * as firestoreFns from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { firstValueFrom, of } from 'rxjs';
import { PendingRequestsService } from '../pending-requests.service';
import {
  INBOX_LIMIT,
  NotificationsApiService,
} from './notifications-api.service';

function setup(uid: string | null = 'u1'): NotificationsApiService {
  TestBed.configureTestingModule({
    providers: [
      NotificationsApiService,
      { provide: Firestore, useValue: {} },
      { provide: Auth, useValue: { currentUser: uid ? { uid } : null } },
    ],
  });
  return TestBed.inject(NotificationsApiService);
}

function mockBatch(): {
  delete: jest.Mock;
  update: jest.Mock;
  commit: jest.Mock;
} {
  const batch = {
    delete: jest.fn(),
    update: jest.fn(),
    commit: jest.fn(() => Promise.resolve()),
  };
  (firestoreFns.writeBatch as jest.Mock).mockReturnValue(batch);
  return batch;
}

describe('NotificationsApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('watch', () => {
    it('should stream the newest inbox entries with their ids', async () => {
      // given
      (firestoreFns.collectionData as jest.Mock).mockReturnValue(
        of([{ id: 'n1', kind: 'cheer' }])
      );
      const service = setup();

      // when
      const result = await firstValueFrom(service.watch('ignored'));

      // then
      expect(result).toEqual([{ id: 'n1', kind: 'cheer' }]);
      expect(firestoreFns.collection).toHaveBeenCalledWith(
        {},
        'notifications/u1/inbox'
      );
      expect(firestoreFns.limit).toHaveBeenCalledWith(INBOX_LIMIT);
      expect(firestoreFns.collectionData).toHaveBeenCalledWith(
        expect.anything(),
        { idField: 'id' }
      );
    });

    it('should stream an empty inbox without a signed-in user', async () => {
      // given
      const service = setup(null);

      // when
      const result = await firstValueFrom(service.watch(''));

      // then
      expect(result).toEqual([]);
      expect(firestoreFns.collectionData).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete every id in one batch and track the commit', async () => {
      // given
      const batch = mockBatch();
      const service = setup();
      const track = jest.spyOn(TestBed.inject(PendingRequestsService), 'track');

      // when
      await service.remove('u1', ['n1', 'n2']);

      // then
      expect(batch.delete).toHaveBeenCalledTimes(2);
      expect(firestoreFns.doc).toHaveBeenCalledWith(
        {},
        'notifications/u1/inbox/n2'
      );
      expect(batch.commit).toHaveBeenCalledTimes(1);
      expect(track).toHaveBeenCalledTimes(1);
    });

    it('should skip the batch for an empty id list', async () => {
      // given
      const batch = mockBatch();
      const service = setup();

      // when
      await service.remove('u1', []);

      // then
      expect(batch.commit).not.toHaveBeenCalled();
    });
  });

  describe('markRead', () => {
    it('should stamp readAt on every id in one batch and track the commit', async () => {
      // given
      const batch = mockBatch();
      const service = setup();
      const track = jest.spyOn(TestBed.inject(PendingRequestsService), 'track');

      // when
      await service.markRead('u1', ['n1']);

      // then
      expect(batch.update).toHaveBeenCalledWith(
        { path: 'notifications/u1/inbox/n1' },
        { readAt: expect.any(String) }
      );
      expect(batch.commit).toHaveBeenCalledTimes(1);
      expect(track).toHaveBeenCalledTimes(1);
    });

    it('should skip the batch without a signed-in user', async () => {
      // given
      const batch = mockBatch();
      const service = setup(null);

      // when
      await service.markRead('', ['n1']);

      // then
      expect(batch.commit).not.toHaveBeenCalled();
    });
  });
});
