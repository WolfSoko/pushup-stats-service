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

  it('should start with tick 0', () => {
    expect(service.openDialogTick()).toBe(0);
  });

  it('Given requestOpenDialog() is called once, Then tick increments to 1', () => {
    service.requestOpenDialog();
    expect(service.openDialogTick()).toBe(1);
  });

  it('Given requestOpenDialog() is called multiple times, Then tick increments each time', () => {
    service.requestOpenDialog();
    service.requestOpenDialog();
    service.requestOpenDialog();
    expect(service.openDialogTick()).toBe(3);
  });
});
