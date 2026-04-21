import { TestBed } from '@angular/core/testing';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { LogoutAllDevicesDialogComponent } from './logout-all-devices-dialog.component';

describe('LogoutAllDevicesDialogComponent', () => {
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  function setup() {
    dialogRefSpy = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [LogoutAllDevicesDialogComponent, MatDialogModule],
      providers: [{ provide: MatDialogRef, useValue: dialogRefSpy }],
    });
    const fixture = TestBed.createComponent(LogoutAllDevicesDialogComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  it('closes with true when the user confirms', () => {
    const { component } = setup();
    component.confirm();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
  });
});
