import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PushupLiveService } from './pushup-live.service';

const onMock = jest.fn();
const ioMock = jest.fn(() => ({ on: onMock }));

jest.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => ioMock(...args),
}));

describe('PushupLiveService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    jest.clearAllMocks();
  });

  it('starts with 0 on server and does not create socket', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });

    const service = TestBed.inject(PushupLiveService);
    expect(service.updateTick()).toBe(0);
    expect(ioMock).not.toHaveBeenCalled();
  });

  it('subscribes to websocket event and increments signal on browser', () => {
    let handler: (() => void) | undefined;
    onMock.mockImplementation((event: string, cb: () => void) => {
      if (event === 'pushups:changed') handler = cb;
    });

    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });

    const service = TestBed.inject(PushupLiveService);
    expect(ioMock).toHaveBeenCalledWith('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });
    expect(service.updateTick()).toBe(0);

    handler?.();
    expect(service.updateTick()).toBe(1);
  });
});
