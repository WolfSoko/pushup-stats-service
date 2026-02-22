import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PushupLiveService } from './pushup-live.service';

type EventHandler = () => void;

const handlers: Record<string, EventHandler> = {};
const onMock = jest.fn((event: string, cb: EventHandler) => {
  handlers[event] = cb;
});
const ioMock = jest.fn(() => ({ on: onMock }));

jest.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => ioMock(...args),
}));

describe('PushupLiveService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    jest.clearAllMocks();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
  });

  it('starts disconnected on server and does not create socket', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });

    const service = TestBed.inject(PushupLiveService);
    expect(service.updateTick()).toBe(0);
    expect(service.connected()).toBe(false);
    expect(ioMock).not.toHaveBeenCalled();
  });

  it('connect handler sets connected and increments tick', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });

    const service = TestBed.inject(PushupLiveService);

    expect(ioMock).toHaveBeenCalled();
    expect(service.connected()).toBe(false);
    expect(service.updateTick()).toBe(0);

    handlers['connect']?.();
    expect(service.connected()).toBe(true);
    expect(service.updateTick()).toBe(1);

    handlers['disconnect']?.();
    expect(service.connected()).toBe(false);

    handlers['pushups:changed']?.();
    expect(service.updateTick()).toBe(2);
  });
});
