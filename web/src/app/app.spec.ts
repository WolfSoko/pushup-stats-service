import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { App } from './app';

describe('App', () => {
  it('should create app shell', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: BreakpointObserver,
          useValue: {
            observe: () => of<BreakpointState>({ matches: false, breakpoints: {} }),
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
            observe: () => of<BreakpointState>({ matches: false, breakpoints: {} }),
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
});
