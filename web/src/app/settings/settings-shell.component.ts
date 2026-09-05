import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { PageHeaderComponent } from '../core/page-header/page-header.component';
import { SettingsFacade } from '../stats/shell/settings.facade';

/**
 * Frame around the settings section: page header, the shared save-status
 * indicator, and the tab strip.
 *
 * The facade is provided on the route rather than here, so one instance
 * spans every tab — switching from Profil to Darstellung must not restart
 * the autosave debounce or drop an in-flight write.
 */
@Component({
  selector: 'app-settings-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './settings-shell.component.html',
  styleUrl: './settings-shell.component.scss',
})
export class SettingsShellComponent {
  protected readonly facade = inject(SettingsFacade);
}
