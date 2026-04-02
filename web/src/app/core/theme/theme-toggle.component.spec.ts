import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ThemeToggleComponent } from './theme-toggle.component';
import { ThemeService, ThemeMode, ResolvedTheme } from './theme.service';

describe('ThemeToggleComponent', () => {
  let fixture: ComponentFixture<ThemeToggleComponent>;
  let mockCurrentMode: ReturnType<typeof signal<ThemeMode>>;
  let mockResolvedTheme: ReturnType<typeof signal<ResolvedTheme>>;
  let cycleModespy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockCurrentMode = signal<ThemeMode>('auto');
    mockResolvedTheme = signal<ResolvedTheme>('dark');
    cycleModespy = vi.fn(() => {
      const current = mockCurrentMode();
      const next: ThemeMode =
        current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
      mockCurrentMode.set(next);
    });

    const mockThemeService = {
      currentMode: mockCurrentMode,
      resolvedTheme: mockResolvedTheme,
      cycleMode: cycleModespy,
    };

    await TestBed.configureTestingModule({
      imports: [ThemeToggleComponent],
      providers: [{ provide: ThemeService, useValue: mockThemeService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ThemeToggleComponent);
    fixture.detectChanges();
  });

  describe('icon per mode', () => {
    it('shows brightness_auto icon in auto mode', () => {
      mockCurrentMode.set('auto');
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('brightness_auto');
    });

    it('shows light_mode icon in light mode', () => {
      mockCurrentMode.set('light');
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('light_mode');
    });

    it('shows dark_mode icon in dark mode', () => {
      mockCurrentMode.set('dark');
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('mat-icon');
      expect(icon.textContent.trim()).toBe('dark_mode');
    });
  });

  describe('aria-label per mode', () => {
    it('has appropriate aria-label in auto mode', () => {
      mockCurrentMode.set('auto');
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button.getAttribute('aria-label')).toContain('Automatisches');
    });

    it('has appropriate aria-label in light mode', () => {
      mockCurrentMode.set('light');
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button.getAttribute('aria-label')).toContain('Helles');
    });

    it('has appropriate aria-label in dark mode', () => {
      mockCurrentMode.set('dark');
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button.getAttribute('aria-label')).toContain('Dunkles');
    });
  });

  describe('click cycling behavior', () => {
    it('calls cycleMode when button is clicked', () => {
      const button = fixture.nativeElement.querySelector('button');
      button.click();

      expect(cycleModespy).toHaveBeenCalledTimes(1);
    });

    it('cycles through modes on consecutive clicks', () => {
      mockCurrentMode.set('auto');
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');

      // Click 1: auto -> light
      button.click();
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('mat-icon').textContent.trim()
      ).toBe('light_mode');

      // Click 2: light -> dark
      button.click();
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('mat-icon').textContent.trim()
      ).toBe('dark_mode');

      // Click 3: dark -> auto
      button.click();
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('mat-icon').textContent.trim()
      ).toBe('brightness_auto');
    });
  });
});
