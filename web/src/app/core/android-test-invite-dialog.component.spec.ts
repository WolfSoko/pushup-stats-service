import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { UserConfig } from '@pu-stats/models';
import { CallableFunctionsService } from '../admin/callable-functions.service';
import { AndroidTestInviteDialogComponent } from './android-test-invite-dialog.component';
import { UserConfigStore } from './user-config.store';

describe('AndroidTestInviteDialogComponent', () => {
  let fixture: ComponentFixture<AndroidTestInviteDialogComponent>;
  let component: AndroidTestInviteDialogComponent;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let callableSpy: ReturnType<typeof vi.fn>;
  let callablesMock: { call: ReturnType<typeof vi.fn> };
  let saveSpy: ReturnType<typeof vi.fn>;
  let userConfigMock: {
    config: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  function setup(config: Partial<UserConfig> | null = null) {
    dialogRefSpy = { close: vi.fn() };
    callableSpy = vi.fn().mockResolvedValue({ data: { ok: true } });
    callablesMock = { call: vi.fn().mockReturnValue(callableSpy) };
    saveSpy = vi.fn().mockResolvedValue(undefined);
    userConfigMock = {
      config: vi.fn().mockReturnValue(config),
      save: saveSpy,
    };

    TestBed.configureTestingModule({
      imports: [AndroidTestInviteDialogComponent, MatDialogModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: CallableFunctionsService, useValue: callablesMock },
        { provide: UserConfigStore, useValue: userConfigMock },
      ],
    });

    fixture = TestBed.createComponent(AndroidTestInviteDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should start in the "ask" state', () => {
    // given / when
    setup();
    // then
    expect(component.state()).toBe('ask');
  });

  it('should call optInAndroidTest and switch to the thanks state on success', async () => {
    // given
    setup();
    // when
    await component.optIn();
    // then
    expect(callablesMock.call).toHaveBeenCalledWith('optInAndroidTest');
    expect(callableSpy).toHaveBeenCalled();
    expect(component.state()).toBe('thanks');
    expect(component.error()).toBeNull();
  });

  it('should surface an error and stay in the "ask" state when the callable fails', async () => {
    // given
    setup();
    callableSpy.mockRejectedValueOnce(new Error('boom'));
    // when
    await component.optIn();
    // then
    expect(component.state()).toBe('ask');
    expect(component.error()).toBeTruthy();
  });

  it('should merge the dismissal timestamp into the existing ui object and close the dialog', async () => {
    // given
    setup({
      userId: 'u1',
      ui: { hideFromLeaderboard: true },
    });
    // when
    await component.dismiss();
    // then
    expect(saveSpy).toHaveBeenCalledTimes(1);
    const patch = saveSpy.mock.calls[0][0];
    expect(patch.ui.hideFromLeaderboard).toBe(true);
    expect(typeof patch.ui.androidTestPopupDismissedUntil).toBe('string');
    expect(dialogRefSpy.close).toHaveBeenCalled();
  });
});
