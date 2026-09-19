jest.mock('@angular/fire/auth', () => ({
  Auth: jest.fn(),
}));

jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  doc: jest.fn(),
  docData: jest.fn(),
}));

import { PLATFORM_ID } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import * as firestoreFns from '@angular/fire/firestore';
import { render } from '@testing-library/angular';
import { of } from 'rxjs';
import { CheerPingApiService } from './cheer-ping-api.service';

describe('CheerPingApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should stream the latest cheer ping from Firestore when authenticated', async () => {
    // given
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u1' });
    (firestoreFns.docData as jest.Mock).mockReturnValue(
      of({ from: 'friend-1', at: '2026-09-14T12:00:00.000Z' })
    );

    const { fixture } = await render('', {
      providers: [
        CheerPingApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u1' } } },
      ],
    });
    const service = fixture.debugElement.injector.get(CheerPingApiService);

    // when
    let result: unknown;
    service.watch('u1').subscribe((r) => (result = r));
    await Promise.resolve();

    // then
    expect(result).toEqual({
      from: 'friend-1',
      at: '2026-09-14T12:00:00.000Z',
    });
  });

  it('should emit null when no ping doc exists yet', async () => {
    // given
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u1' });
    (firestoreFns.docData as jest.Mock).mockReturnValue(of(undefined));

    const { fixture } = await render('', {
      providers: [
        CheerPingApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u1' } } },
      ],
    });
    const service = fixture.debugElement.injector.get(CheerPingApiService);

    // when
    let result: unknown;
    service.watch('u1').subscribe((r) => (result = r));
    await Promise.resolve();

    // then
    expect(result).toBeNull();
  });

  it('should emit null without a Firestore provider (SSR)', async () => {
    // given
    const { fixture } = await render('', {
      providers: [
        CheerPingApiService,
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: Firestore, useValue: null },
        { provide: Auth, useValue: null },
      ],
    });
    const service = fixture.debugElement.injector.get(CheerPingApiService);

    // when
    let result: unknown;
    service.watch('u1').subscribe((r) => (result = r));
    await Promise.resolve();

    // then
    expect(result).toBeNull();
  });
});
