import { isFirebaseConfigured } from './firebase-config';

describe('firebase-config', () => {
  it('returns false when required fields missing', () => {
    expect(
      isFirebaseConfigured({
        apiKey: '',
        authDomain: '',
        projectId: '',
        appId: '',
      })
    ).toBe(false);
  });

  it('returns true when required fields present', () => {
    expect(
      isFirebaseConfigured({
        apiKey: 'key',
        authDomain: 'domain',
        projectId: 'project',
        appId: 'app',
      })
    ).toBe(true);
  });
});
