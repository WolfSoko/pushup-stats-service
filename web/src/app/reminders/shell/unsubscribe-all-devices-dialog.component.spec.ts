import { TestBed } from '@angular/core/testing';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { UnsubscribeAllDevicesDialogComponent } from './unsubscribe-all-devices-dialog.component';

describe('UnsubscribeAllDevicesDialogComponent', () => {
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  function setup() {
    dialogRefSpy = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [UnsubscribeAllDevicesDialogComponent, MatDialogModule],
      providers: [{ provide: MatDialogRef, useValue: dialogRefSpy }],
    });
    const fixture = TestBed.createComponent(
      UnsubscribeAllDevicesDialogComponent
    );
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  it('closes with true when the user confirms', () => {
    const { component } = setup();
    component.confirm();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
  });
});
