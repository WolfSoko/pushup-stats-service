import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { PushupRecord } from '@pu-stats/models';
import { render } from '@testing-library/angular';
import { PushupLiveDataService } from './pushup-live-data.service';

jest.mock('@angular/common', () => ({
  ...jest.requireActual('@angular/common'),
  isPlatformBrowser: jest.fn(),
}));

let mockSocketOn: jest.Mock;
let mockIo: jest.Mock;
jest.mock('socket.io-client', () => ({
  get io() {
    return mockIo;
  },
}));

describe('PushupLiveDataService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketOn = jest.fn();
    mockIo = jest.fn(() => ({ on: mockSocketOn }));
  });

  it('should not connect on server platform (given isPlatformBrowser false)', async () => {
    (isPlatformBrowser as jest.Mock).mockReturnValue(false);
    await render('', {
      providers: [
        PushupLiveDataService,
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    expect(mockIo).not.toHaveBeenCalled();
  });

  it('should connect and handle events on browser platform (given isPlatformBrowser true)', async () => {
    (isPlatformBrowser as jest.Mock).mockReturnValue(true);
    const eventHandlers: Record<string, () => void> = {};
    mockSocketOn.mockImplementation((event, cb) => {
      eventHandlers[event] = cb;
    });
    const { fixture } = await render('', {
      providers: [
        PushupLiveDataService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const service = fixture.debugElement.injector.get(PushupLiveDataService);
    // Simuliere connect
    eventHandlers['connect']();
    expect(service.connected()).toBe(true);
    // Simuliere disconnect
    eventHandlers['disconnect']();
    expect(service.connected()).toBe(false);
    // Simuliere pushups:initial
    const records: PushupRecord[] = [
      { _id: '1', timestamp: 't', reps: 1, source: 's' },
    ];
    eventHandlers['pushups:initial'](records);
    expect(service.entries()).toEqual(records);
    // Simuliere pushups:changed
    const records2: PushupRecord[] = [
      { _id: '2', timestamp: 't2', reps: 2, source: 's2' },
    ];
    eventHandlers['pushups:changed'](records2);
    expect(service.entries()).toEqual(records2);
    // Edge Case: null/undefined
    eventHandlers['pushups:initial'](null);
    expect(service.entries()).toEqual([]);
    eventHandlers['pushups:changed'](undefined);
    expect(service.entries()).toEqual([]);
  });
});
