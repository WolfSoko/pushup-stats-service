import {
  PushupValidationError,
  pushupValidationMessage,
} from './pushup-firestore.service';

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
