import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { SettingsFacade } from '../stats/shell/settings.facade';

@Component({
  selector: 'app-settings-display',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonToggleModule, MatCardModule, MatIconModule],
  templateUrl: './settings-display.component.html',
  styleUrl: './settings-section.scss',
})
export class SettingsDisplayComponent {
  protected readonly facade = inject(SettingsFacade);
}
