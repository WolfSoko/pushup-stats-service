import { TestBed } from '@angular/core/testing';
import { addDoc, Firestore } from '@angular/fire/firestore';
import { FeedbackService } from './feedback.service';

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class {},
  collection: vi.fn(() => 'feedback-collection-ref'),
  addDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

describe('FeedbackService', () => {
  let service: FeedbackService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: Firestore, useValue: {} }],
    });
    service = TestBed.inject(FeedbackService);
    // Nx Cloud distributed runners resolve `inject(Firestore, {optional:true})`
    // to null because the provided-in-root service instantiates in a parent
    // injector that doesn't see the test module's Firestore override. Pin the
    // field directly so the test exercises submit() regardless of DI topology.
    Object.defineProperty(service, 'firestore', {
      value: {},
      configurable: true,
      writable: true,
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call addDoc with feedback data', async () => {
    await service.submit(
      {
        name: 'Max',
        email: 'max@test.de',
        message: 'Great app!',
        anonymous: false,
      },
      'user-123'
    );

    expect(addDoc).toHaveBeenCalledWith(
      'feedback-collection-ref',
      expect.objectContaining({
        name: 'Max',
        email: 'max@test.de',
        message: 'Great app!',
        userId: 'user-123',
        createdAt: 'SERVER_TIMESTAMP',
      })
    );
  });

  it('should omit userId for anonymous feedback', async () => {
    await service.submit(
      { name: '', email: '', message: 'Bug report', anonymous: true },
      'user-123'
    );

    expect(addDoc).toHaveBeenCalledWith(
      'feedback-collection-ref',
      expect.objectContaining({
        name: null,
        email: null,
        message: 'Bug report',
        userId: null,
      })
    );
  });
});
