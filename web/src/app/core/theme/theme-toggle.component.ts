import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ThemeService } from './theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <button
      mat-icon-button
      type="button"
      [attr.aria-label]="ariaLabel()"
      (click)="theme.cycleMode()"
    >
      <mat-icon>{{ icon() }}</mat-icon>
    </button>
  `,
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);

  /** Show light_mode icon when dark, dark_mode when light */
  protected readonly icon = computed(() =>
    this.theme.resolvedTheme() === 'dark' ? 'light_mode' : 'dark_mode'
  );

  /** Aria label based on current mode */
  protected readonly ariaLabel = computed(() => {
    const mode = this.theme.currentMode();
    switch (mode) {
      case 'auto':
        return $localize`:@@theme.toggle.auto:Automatisches Design aktiv. Klicken zum Wechseln`;
      case 'light':
        return $localize`:@@theme.toggle.light:Helles Design aktiv. Klicken zum Wechseln`;
      case 'dark':
        return $localize`:@@theme.toggle.dark:Dunkles Design aktiv. Klicken zum Wechseln`;
    }
  });
}
