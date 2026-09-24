jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  doc: jest.fn(() => ({})),
  collection: jest.fn(() => ({})),
  docData: jest.fn(),
  collectionData: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'server-ts'),
}));

import { TestBed } from '@angular/core/testing';
import {
  Firestore,
  collectionData,
  doc,
  docData,
  setDoc,
} from '@angular/fire/firestore';
import { firstValueFrom, of } from 'rxjs';
import { XpApiService } from './xp-api.service';

describe('XpApiService', () => {
  let service: XpApiService;

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: Firestore, useValue: {} }],
    });
    service = TestBed.inject(XpApiService);
  });

  it('should drop invalid rates when reading the config', async () => {
    // given
    jest
      .mocked(docData)
      .mockReturnValue(of({ rates: { pushup: 2, bad: -3 } }) as never);

    // when
    const config = await firstValueFrom(service.watchConfig());

    // then
    expect(config).toEqual({ rates: { pushup: 2 } });
  });

  it('should return null for a missing config doc', async () => {
    // given
    jest.mocked(docData).mockReturnValue(of(undefined) as never);

    // then
    expect(await firstValueFrom(service.watchConfig())).toBeNull();
  });

  it('should map ledger rows to XP per entry id', async () => {
    // given
    jest
      .mocked(collectionData)
      .mockReturnValue(of([{ id: 'e1', xp: 12 }, { id: 'e2' }]) as never);

    // when
    const ledger = await firstValueFrom(service.watchLedger('u1'));

    // then
    expect([...ledger]).toEqual([
      ['e1', 12],
      ['e2', 0],
    ]);
  });

  it('should write the full rate map with the admin stamp', async () => {
    // given
    jest.mocked(setDoc).mockResolvedValue(undefined);

    // when
    await service.saveConfig({ pushup: 1.5 }, 'admin-1');

    // then
    expect(doc).toHaveBeenCalledWith({}, 'xpConfig/current');
    expect(setDoc).toHaveBeenCalledWith(expect.anything(), {
      rates: { pushup: 1.5 },
      updatedBy: 'admin-1',
      updatedAt: 'server-ts',
    });
  });

  it('should emit null user XP without a uid', async () => {
    // then
    expect(await firstValueFrom(service.watchUserXp(''))).toBeNull();
  });
});
