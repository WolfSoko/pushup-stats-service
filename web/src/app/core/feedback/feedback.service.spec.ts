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
    // Construct inside an injection context so `inject(Firestore, …)` resolves
    // against the test module's providers regardless of the service's
    // `providedIn: 'root'` — avoids CI-only null-injector when the root
    // injector is reused across test files.
    service = TestBed.runInInjectionContext(() => new FeedbackService());
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
