import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { render } from '@testing-library/angular';
import { PushupLiveService } from './pushup-live.service';

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

describe('PushupLiveService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketOn = jest.fn();
    mockIo = jest.fn(() => ({ on: mockSocketOn }));
  });

  it('should not connect on server platform (given isPlatformBrowser false)', async () => {
    (isPlatformBrowser as jest.Mock).mockReturnValue(false);
    await render('', {
      providers: [
        PushupLiveService,
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    expect(mockIo).not.toHaveBeenCalled();
  });

  it('should connect and handle events on browser platform (given isPlatformBrowser true)', async () => {
    (isPlatformBrowser as jest.Mock).mockReturnValue(true);
    const eventHandlers: Record<string, () => void> = {};
    mockSocketOn.mockImplementation((event, cb: () => void) => {
      eventHandlers[event] = cb;
    });
    const { fixture } = await render('', {
      providers: [
        PushupLiveService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const service = fixture.debugElement.injector.get(PushupLiveService);
    // Simuliere connect
    eventHandlers['connect']();
    expect(service.connected()).toBe(true);
    expect(service.updateTick()).toBe(1);
    // Simuliere pushups:changed
    eventHandlers['pushups:changed']();
    expect(service.updateTick()).toBe(2);
    // Simuliere disconnect
    eventHandlers['disconnect']();
    expect(service.connected()).toBe(false);
  });

  it('should handle multiple connect/disconnect cycles (given repeated events)', async () => {
    (isPlatformBrowser as jest.Mock).mockReturnValue(true);
    const eventHandlers: Record<string, () => void> = {};
    mockSocketOn.mockImplementation((event, cb: () => void) => {
      eventHandlers[event] = cb;
    });
    const { fixture } = await render('', {
      providers: [
        PushupLiveService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const service = fixture.debugElement.injector.get(PushupLiveService);
    eventHandlers['connect']();
    eventHandlers['disconnect']();
    eventHandlers['connect']();
    expect(service.connected()).toBe(true);
    eventHandlers['disconnect']();
    expect(service.connected()).toBe(false);
  });
});
