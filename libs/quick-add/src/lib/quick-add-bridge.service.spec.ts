import { TestBed } from '@angular/core/testing';
import { QuickAddBridgeService } from './quick-add-bridge.service';

describe('QuickAddBridgeService', () => {
  let service: QuickAddBridgeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QuickAddBridgeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('Given a subscriber, When requestOpenDialog() is called once, Then emits exactly one value', () => {
    let count = 0;
    service.openDialog$.subscribe(() => count++);
    service.requestOpenDialog();
    expect(count).toBe(1);
  });

  it('Given a subscriber, When requestOpenDialog() is called multiple times, Then emits once per call', () => {
    let count = 0;
    service.openDialog$.subscribe(() => count++);
    service.requestOpenDialog();
    service.requestOpenDialog();
    service.requestOpenDialog();
    expect(count).toBe(3);
  });

  it('Given no prior emissions, When a new subscriber subscribes, Then does not receive any replayed value', () => {
    service.requestOpenDialog();
    let received = false;
    service.openDialog$.subscribe(() => (received = true));
    expect(received).toBe(false);
  });

  it('Given a completed subscription, When requestOpenDialog() is called, Then does not cause memory leaks (subscription cleanup works)', () => {
    let count = 0;
    const sub = service.openDialog$.subscribe(() => count++);
    service.requestOpenDialog();
    sub.unsubscribe();
    service.requestOpenDialog();
    expect(count).toBe(1);
  });
});
