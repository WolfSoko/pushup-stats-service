import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { LiveDataStore } from './live-data.store';

// Mock Firebase modules to avoid fetch polyfill issues in Jest
jest.mock('@angular/fire/auth', () => ({
  Auth: class {},
  authState: jest.fn(),
}));
jest.mock('@angular/fire/firestore', () => ({
  Firestore: class {},
  collection: jest.fn(),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
}));

describe('LiveDataStore', () => {
  describe('SSR (server platform)', () => {
    it('does not connect on server', () => {
      TestBed.configureTestingModule({
        providers: [
          LiveDataStore,
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
      });

      const store = TestBed.inject(LiveDataStore);

      expect(store.connected()).toBe(false);
      expect(store.entries()).toEqual([]);
      expect(store.updateTick()).toBe(0);
    });
  });

  describe('initial state', () => {
    it('starts disconnected with empty entries', () => {
      TestBed.configureTestingModule({
        providers: [
          LiveDataStore,
          { provide: PLATFORM_ID, useValue: 'browser' },
        ],
      });
      const store = TestBed.inject(LiveDataStore);

      expect(store.connected()).toBe(false);
      expect(store.entries()).toEqual([]);
      expect(store.updateTick()).toBe(0);
    });

    it('starts with an empty exerciseEntries array', () => {
      TestBed.configureTestingModule({
        providers: [
          LiveDataStore,
          { provide: PLATFORM_ID, useValue: 'browser' },
        ],
      });
      const store = TestBed.inject(LiveDataStore);

      expect(store.exerciseEntries()).toEqual([]);
    });

    it('exposes exerciseEntries on server platform as well', () => {
      TestBed.configureTestingModule({
        providers: [
          LiveDataStore,
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
      });
      const store = TestBed.inject(LiveDataStore);

      // On the server the Firestore listener never fires, so the
      // exerciseEntries signal stays at its initial empty array.
      expect(store.exerciseEntries()).toEqual([]);
    });
  });
});
