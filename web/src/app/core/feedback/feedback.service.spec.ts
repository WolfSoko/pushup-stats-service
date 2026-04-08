import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
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
    TestBed.configureTestingModule({
      providers: [FeedbackService, { provide: Firestore, useValue: {} }],
    });
    service = TestBed.inject(FeedbackService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call addDoc with feedback data', async () => {
    const { addDoc } = await import('@angular/fire/firestore');

    await service.submit(
      { name: 'Max', email: 'max@test.de', message: 'Great app!' },
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

  it('should send null for anonymous feedback', async () => {
    const { addDoc } = await import('@angular/fire/firestore');

    await service.submit(
      { name: '', email: '', message: 'Bug report' },
      undefined
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
