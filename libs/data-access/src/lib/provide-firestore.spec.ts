jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  getFirestore: jest.fn(),
  provideFirestore: jest.fn(),
  connectFirestoreEmulator: jest.fn(),
}));

import { withEmulator } from './provide-firestore';
import { connectFirestoreEmulator } from '@angular/fire/firestore';

describe('withEmulator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses hostname/port from a full emulator URL', () => {
    const firestore = {} as any;

    withEmulator('http://127.0.0.1:8080')(firestore);

    expect(connectFirestoreEmulator).toHaveBeenCalledWith(
      firestore,
      '127.0.0.1',
      8080
    );
  });

  it('supports host:port input without protocol', () => {
    const firestore = {} as any;

    withEmulator('localhost:9090')(firestore);

    expect(connectFirestoreEmulator).toHaveBeenCalledWith(
      firestore,
      'localhost',
      9090
    );
  });

  it('falls back to default port when no port is provided', () => {
    const firestore = {} as any;

    withEmulator('http://localhost')(firestore);

    expect(connectFirestoreEmulator).toHaveBeenCalledWith(
      firestore,
      'localhost',
      8080
    );
  });
});
