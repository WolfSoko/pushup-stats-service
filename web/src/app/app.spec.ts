import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { App } from './app';
import { UserContextService } from './user-context.service';

describe('App', () => {
  it('should create app shell', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: BreakpointObserver,
          useValue: {
            observe: () =>
              of<BreakpointState>({ matches: false, breakpoints: {} }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders sidenav navigation links', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: BreakpointObserver,
          useValue: {
            observe: () =>
              of<BreakpointState>({ matches: false, breakpoints: {} }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;

    // Sidenav links
    expect(root.textContent).toContain('Dashboard');
    expect(root.textContent).toContain('Daten');
    expect(root.textContent).toContain('Analyse');
    expect(root.textContent).toContain('Einstellungen');

    // Language switch
    expect(root.textContent).toContain('Sprache');
    expect(root.textContent).toContain('Deutsch');
    expect(root.textContent).toContain('English');
  });

  describe('HTML title', () => {
    const userIdSignal = signal('default');

    beforeEach(async () => {
      userIdSignal.set('default');

      await TestBed.configureTestingModule({
        imports: [App],
        providers: [
          provideRouter([]),
          {
            provide: BreakpointObserver,
            useValue: {
              observe: () =>
                of<BreakpointState>({ matches: false, breakpoints: {} }),
            },
          },
          {
            provide: UserContextService,
            useValue: { userIdSafe: userIdSignal.asReadonly() },
          },
        ],
      }).compileComponents();
    });

    it('shows fallback text in title when user is default', () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();

      const title = TestBed.inject(Title);
      expect(title.getTitle()).toBe('Pushup Tracker – Dein Name 💪');
    });

    it('shows username in title when user is set', () => {
      userIdSignal.set('wolf');
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();

      const title = TestBed.inject(Title);
      expect(title.getTitle()).toBe('Pushup Tracker – wolf');
    });

    it('updates title reactively when user changes', async () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();

      const title = TestBed.inject(Title);
      expect(title.getTitle()).toBe('Pushup Tracker – Dein Name 💪');

      userIdSignal.set('anna');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(title.getTitle()).toBe('Pushup Tracker – anna');
    });
  });
});
