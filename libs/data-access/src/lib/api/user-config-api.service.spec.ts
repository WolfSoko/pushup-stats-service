import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { UserConfigApiService } from './user-config-api.service';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';

vi.mock('@angular/fire/firestore', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@angular/fire/firestore')>();
  return {
    ...actual,
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
  };
});

describe('UserConfigApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: null } },
      ],
    });
  });

  it('returns default config when firestore is missing', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: null },
        { provide: Auth, useValue: null },
      ],
    });
    const service = TestBed.inject(UserConfigApiService);
    const config = await firstValueFrom(service.getConfig('u1'));
    expect(config).toEqual({ userId: 'u1' });
  });

  it('fetches config from firestore when available', async () => {
    const mockConfig = { userId: 'u2', colorTheme: 'light' as const };
    vi.mocked(doc).mockReturnValue({} as ReturnType<typeof doc>);
    vi.mocked(getDoc).mockResolvedValue({
      data: () => mockConfig,
    } as ReturnType<typeof getDoc>);

    const service = TestBed.inject(UserConfigApiService);
    const config = await firstValueFrom(service.getConfig('u2'));
    expect(config).toEqual(mockConfig);
  });

  it('updates config in firestore', async () => {
    vi.mocked(doc).mockReturnValue({} as ReturnType<typeof doc>);
    vi.mocked(setDoc).mockResolvedValue(undefined);

    const service = TestBed.inject(UserConfigApiService);
    const result = await firstValueFrom(
      service.updateConfig('u3', { colorTheme: 'dark' })
    );
    expect(result).toMatchObject({ colorTheme: 'dark' });
    expect(setDoc).toHaveBeenCalled();
  });
});
