import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AndroidTestPageComponent } from './android-test-page.component';
import { AdminUser } from './admin-page.models';
import { CallableFunctionsService } from './callable-functions.service';
import {
  CallableRecord,
  createCallablesMock,
} from './callable-functions.testing';

const { callablesMock, setupCallables } = createCallablesMock();

function user(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    uid: 'u1',
    displayName: null,
    email: 'user@example.com',
    anonymous: false,
    entryCount: 20,
    lastEntry: null,
    createdAt: null,
    role: null,
    ...overrides,
  };
}

describe('AndroidTestPageComponent', () => {
  let fixture: ComponentFixture<AndroidTestPageComponent>;
  let component: AndroidTestPageComponent;

  async function createComponent(
    users: AdminUser[] = [],
    extraCallables: CallableRecord[] = []
  ): Promise<void> {
    setupCallables([
      { name: 'adminListUsers', impl: async () => ({ data: users }) },
      ...extraCallables,
    ]);

    await TestBed.configureTestingModule({
      imports: [AndroidTestPageComponent],
      providers: [
        { provide: CallableFunctionsService, useValue: callablesMock },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AndroidTestPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load users on init and group them by androidTest status', async () => {
    // given / when
    await createComponent([
      user({ uid: 'c1', androidTest: { status: 'candidate' } }),
      user({ uid: 'o1', androidTest: { status: 'optedIn' } }),
    ]);
    // then
    expect(callablesMock.call).toHaveBeenCalledWith('adminListUsers');
    expect(component.groups().candidates.map((u) => u.uid)).toEqual(['c1']);
    expect(component.groups().optedIn.map((u) => u.uid)).toEqual(['o1']);
  });

  it('should call adminComputeAndroidTestCandidates and refresh the list', async () => {
    // given
    await createComponent([]);
    const computeSpy = vi.fn().mockResolvedValue({ data: { found: 3 } });
    setupCallables([
      { name: 'adminListUsers', impl: async () => ({ data: [] }) },
      { name: 'adminComputeAndroidTestCandidates', impl: computeSpy },
    ]);
    // when
    await component.computeCandidates();
    // then
    expect(computeSpy).toHaveBeenCalled();
    expect(component.scanResult()).toBe(3);
  });

  it('should call adminConfirmAndroidTestCandidate with the given decision', async () => {
    // given
    await createComponent([user({ uid: 'c1' })]);
    const confirmSpy = vi.fn().mockResolvedValue({ data: { ok: true } });
    setupCallables([
      { name: 'adminListUsers', impl: async () => ({ data: [] }) },
      { name: 'adminConfirmAndroidTestCandidate', impl: confirmSpy },
    ]);
    // when
    await component.confirm('c1', true);
    // then
    expect(confirmSpy).toHaveBeenCalledWith({ uid: 'c1', confirmed: true });
  });

  it('should surface a "no push" error when markAdded reports pushSent: false', async () => {
    // given
    await createComponent([user({ uid: 'o1' })]);
    setupCallables([
      { name: 'adminListUsers', impl: async () => ({ data: [] }) },
      {
        name: 'adminMarkAndroidTesterAdded',
        impl: async () => ({ data: { ok: true, pushSent: false } }),
      },
    ]);
    // when
    await component.markAdded('o1');
    // then
    expect(component.error()).toContain('Push');
  });

  it('should copy opted-in emails to the clipboard', async () => {
    // given
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await createComponent([
      user({
        uid: 'o1',
        email: 'a@example.com',
        androidTest: { status: 'optedIn' },
      }),
    ]);
    // when
    await component.copyEmails();
    // then
    expect(writeText).toHaveBeenCalledWith('a@example.com');
  });

  it('should add a hand-picked user straight to confirmed and clear the search', async () => {
    // given
    await createComponent([user({ uid: 'pick', email: 'pick@example.com' })]);
    const confirmSpy = vi.fn().mockResolvedValue({ data: { ok: true } });
    setupCallables([
      { name: 'adminListUsers', impl: async () => ({ data: [] }) },
      { name: 'adminConfirmAndroidTestCandidate', impl: confirmSpy },
    ]);
    component.manualSearch.set('pick');
    // when
    await component.addManually('pick');
    // then
    expect(confirmSpy).toHaveBeenCalledWith({ uid: 'pick', confirmed: true });
    expect(component.manualSearch()).toBe('');
  });

  it('should keep the search term when the manual add fails', async () => {
    // given
    await createComponent([user({ uid: 'pick', email: 'pick@example.com' })]);
    setupCallables([
      { name: 'adminListUsers', impl: async () => ({ data: [] }) },
      {
        name: 'adminConfirmAndroidTestCandidate',
        impl: async () => {
          throw new Error('nicht berechtigt');
        },
      },
    ]);
    component.manualSearch.set('pick');
    // when
    await component.addManually('pick');
    // then
    expect(component.error()).toBe('nicht berechtigt');
    expect(component.manualSearch()).toBe('pick');
  });

  it('should offer only eligible users not yet in the flow as manual matches', async () => {
    // given / when
    await createComponent([
      user({ uid: 'free', email: 'match-free@example.com' }),
      user({ uid: 'anon', email: 'match-anon@example.com', anonymous: true }),
      user({
        uid: 'inFlow',
        email: 'match-inflow@example.com',
        androidTest: { status: 'optedIn' },
      }),
    ]);
    component.manualSearch.set('match-');
    // then
    expect(component.manualMatches().map((u) => u.uid)).toEqual(['free']);
  });

  it('should surface the error message when adminListUsers fails', async () => {
    // given / when
    await createComponent();
    setupCallables([
      {
        name: 'adminListUsers',
        impl: async () => {
          throw new Error('boom');
        },
      },
    ]);
    await component.loadUsers();
    // then
    expect(component.error()).toBe('boom');
  });
});
