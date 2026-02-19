import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PushupLiveDataService } from './pushup-live-data.service';

type EventHandler = (...args: unknown[]) => void;

const handlers: Record<string, EventHandler> = {};
const onMock = jest.fn((event: string, cb: EventHandler) => {
  handlers[event] = cb;
});
const ioMock = jest.fn(() => ({ on: onMock }));

jest.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => ioMock(...args),
}));

describe('PushupLiveDataService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    jest.clearAllMocks();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
  });

  it('does not create a socket on server', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });

    const service = TestBed.inject(PushupLiveDataService);
    expect(service.connected()).toBe(false);
    expect(service.entries()).toEqual([]);
    expect(ioMock).not.toHaveBeenCalled();
  });

  it('updates entries on pushups:initial and pushups:changed', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });

    const service = TestBed.inject(PushupLiveDataService);
    expect(ioMock).toHaveBeenCalled();

    handlers['connect']?.();
    expect(service.connected()).toBe(true);

    handlers['pushups:initial']?.([
      { _id: '1', timestamp: '2026-02-10T08:00:00', reps: 10 },
    ]);
    expect(service.entries().map((x) => x._id)).toEqual(['1']);

    handlers['pushups:changed']?.([
      { _id: '2', timestamp: '2026-02-11T09:00:00', reps: 20 },
    ]);
    expect(service.entries().map((x) => x._id)).toEqual(['2']);

    handlers['disconnect']?.();
    expect(service.connected()).toBe(false);
  });
});
