import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DEFAULT_ANDROID_TEST_THRESHOLDS } from '@pu-stats/models';
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

  it('should render skeleton rows instead of the empty text while the candidates load', async () => {
    // given
    await createComponent([]);
    let resolve: (value: { data: AdminUser[] }) => void = () => undefined;
    const pending = new Promise<{ data: AdminUser[] }>((r) => {
      resolve = r;
    });
    setupCallables([{ name: 'adminListUsers', impl: () => pending }]);
    const host = fixture.nativeElement as HTMLElement;

    // when
    const load = component.loadUsers();
    fixture.detectChanges();

    // then
    const skeleton = host.querySelector(
      '[data-testid="android-test-skeleton"]'
    );
    expect(skeleton?.getAttribute('aria-busy')).toBe('true');
    expect(skeleton?.querySelectorAll('.user-row')).toHaveLength(4);
    expect(skeleton?.querySelectorAll('pu-skeleton')).toHaveLength(12);
    expect(host.querySelector('mat-spinner')).toBeNull();
    expect(host.textContent).not.toContain('Keine offenen Kandidaten.');

    // when
    resolve({ data: [] });
    await load;
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(host.querySelector('pu-skeleton')).toBeNull();
    expect(host.textContent).toContain('Keine offenen Kandidaten.');
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

  it('should seed the threshold inputs with the shared defaults', async () => {
    // given / when
    await createComponent([]);
    // then
    expect(component.minEntries()).toBe(
      DEFAULT_ANDROID_TEST_THRESHOLDS.minEntries
    );
    expect(component.activeWithinDays()).toBe(
      DEFAULT_ANDROID_TEST_THRESHOLDS.activeWithinDays
    );
  });

  it('should send the edited thresholds to the scan callable', async () => {
    // given
    await createComponent([]);
    const computeSpy = vi
      .fn()
      .mockResolvedValue({ data: { found: 0, cleaned: 0 } });
    setupCallables([
      { name: 'adminListUsers', impl: async () => ({ data: [] }) },
      { name: 'adminComputeAndroidTestCandidates', impl: computeSpy },
    ]);
    component.minEntries.set(5);
    component.activeWithinDays.set(90);
    // when
    await component.computeCandidates();
    // then
    expect(computeSpy).toHaveBeenCalledWith({
      minEntries: 5,
      activeWithinDays: 90,
    });
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
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
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

  it('should mark only the pressed row action busy while its callable is pending', async () => {
    // given
    await createComponent([user({ uid: 'c1' })]);
    let resolveConfirm!: () => void;
    setupCallables([
      { name: 'adminListUsers', impl: async () => ({ data: [] }) },
      {
        name: 'adminConfirmAndroidTestCandidate',
        impl: () =>
          new Promise<{ data: unknown }>((resolve) => {
            resolveConfirm = () => resolve({ data: { ok: true } });
          }),
      },
    ]);

    // when
    const run = component.confirm('c1', true);

    // then
    expect(component.busyUser.isBusy('c1:confirm')).toBe(true);
    expect(component.busyUser.isBusy('c1:decline')).toBe(false);
    expect(component.busyUser.isBusy('c1:added')).toBe(false);
    expect(component.otherActionBusy('c1', 'decline')).toBe(true);
    expect(component.otherActionBusy('c1', 'confirm')).toBe(false);
    expect(component.otherActionBusy('c2', 'confirm')).toBe(false);

    // when
    resolveConfirm();
    await run;

    // then
    expect(component.busyUser.busy()).toBe(false);
  });
});
