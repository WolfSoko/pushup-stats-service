import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { FeedbackService } from './feedback.service';

describe('FeedbackService', () => {
  let service: FeedbackService;
  let mockCollection: ReturnType<typeof vi.fn>;
  let mockAddDoc: ReturnType<typeof vi.fn>;
  let mockServerTimestamp: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCollection = vi.fn().mockReturnValue('feedback-collection-ref');
    mockAddDoc = vi.fn().mockResolvedValue(undefined);
    mockServerTimestamp = vi.fn().mockReturnValue('SERVER_TIMESTAMP');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: Firestore, useValue: {} }],
    });
    service = TestBed.inject(FeedbackService);
    // Pin Firestore and Firebase functions directly on the instance to bypass
    // DI topology issues on Nx Cloud runners and avoid unreliable vi.mock
    // module interception (Angular's esbuild resolves imports at compile time).
    Object.defineProperty(service, 'firestore', {
      value: {},
      configurable: true,
      writable: true,
    });
    Object.defineProperty(service, 'collectionFn', {
      value: mockCollection,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(service, 'addDocFn', {
      value: mockAddDoc,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(service, 'serverTimestampFn', {
      value: mockServerTimestamp,
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

    expect(mockAddDoc).toHaveBeenCalledWith(
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

    expect(mockAddDoc).toHaveBeenCalledWith(
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
