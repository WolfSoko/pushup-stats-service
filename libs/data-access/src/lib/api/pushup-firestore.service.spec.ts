import { TestBed } from '@angular/core/testing';
import {
  PushupFirestoreService,
  PushupValidationError,
  pushupValidationMessage,
} from './pushup-firestore.service';

jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
}));

describe('PushupFirestoreService', () => {
  it('should be created', () => {
    // given / when
    TestBed.configureTestingModule({ providers: [PushupFirestoreService] });
    const service = TestBed.inject(PushupFirestoreService);
    // then
    expect(service).toBeTruthy();
  });

  describe('migrateUserData', () => {
    it('should resolve without doing anything', async () => {
      // given
      TestBed.configureTestingModule({ providers: [PushupFirestoreService] });
      const service = TestBed.inject(PushupFirestoreService);
      // when / then — no-op by design; just confirm it does not throw
      await expect(
        service.migrateUserData('from-uid', 'to-uid')
      ).resolves.toBeUndefined();
    });
  });
});

describe('pushupValidationMessage', () => {
  it('Given out-of-range Then surfaces the 1..500 cap message', () => {
    expect(
      pushupValidationMessage(new PushupValidationError('reps', 'out-of-range'))
    ).toMatch(/zwischen 1.*und 500.*liegen/);
  });

  it('Given not-integer Then surfaces the integer hint', () => {
    expect(
      pushupValidationMessage(new PushupValidationError('reps', 'not-integer'))
    ).toMatch(/ganze Zahl/);
  });

  it('Given an unrelated error Then falls back to the generic message', () => {
    expect(pushupValidationMessage(new Error('boom'))).toMatch(
      /konnte nicht gespeichert/
    );
    expect(pushupValidationMessage(undefined)).toMatch(
      /konnte nicht gespeichert/
    );
  });
});
