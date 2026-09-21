import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import {
  isAutoCountFeedbackEnabled,
  setAutoCountFeedbackEnabled,
} from '../auto-count/auto-count-feedback.models';
import { SettingsFacade } from '../stats/shell/settings.facade';
import { BusyDirective } from '@pu-stats/ui';

@Component({
  selector: 'app-settings-privacy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    BusyDirective,
  ],
  templateUrl: './settings-privacy.component.html',
  styleUrl: './settings-section.scss',
})
export class SettingsPrivacyComponent {
  protected readonly facade = inject(SettingsFacade);
  /**
   * Device-local, so it is not worth a round trip through the settings
   * draft/autosave machinery — the toggle writes straight through.
   */
  protected readonly autoCountFeedback = signal(isAutoCountFeedbackEnabled());

  protected onAutoCountFeedbackChange(enabled: boolean): void {
    setAutoCountFeedbackEnabled(enabled);
    this.autoCountFeedback.set(enabled);
  }
}
