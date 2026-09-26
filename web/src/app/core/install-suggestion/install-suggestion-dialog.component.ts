import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { BRAND_NAME } from '@pu-stats/models';
import { BusyDirective, createBusyState } from '@pu-stats/ui';
import { playStoreUrl } from '../android-platform';
import { InstallPromptService } from '../install-prompt.service';
import type {
  InstallSuggestionResult,
  InstallSuggestionVariant,
} from './install-suggestion';

export interface InstallSuggestionDialogData {
  readonly variant: InstallSuggestionVariant;
}

@Component({
  selector: 'app-install-suggestion-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, MatIconModule, BusyDirective],
  styles: `
    mat-dialog-content {
      display: grid;
      gap: 12px;
      max-width: 400px;
    }
    ul {
      margin: 0;
      padding-left: 20px;
      display: grid;
      gap: 4px;
    }
    .ios-steps mat-icon {
      vertical-align: middle;
    }
  `,
  template: `
    @switch (data.variant) {
      @case ('play-store') {
        <h2 mat-dialog-title i18n="@@installSuggestion.android.title">
          Hol dir die Android-App
        </h2>
        <mat-dialog-content>
          <p i18n="@@installSuggestion.android.body">
            {{ brandName }} gibt es kostenlos im Play Store – schneller zur Hand
            als im Browser.
          </p>
          <ul>
            <li i18n="@@installSuggestion.benefit.homescreen">
              Startet direkt vom Startbildschirm, ohne Browserleiste
            </li>
            <li i18n="@@installSuggestion.benefit.links">
              Links zu {{ brandName }} öffnen sich direkt in der App
            </li>
            <li i18n="@@installSuggestion.benefit.reminders">
              Erinnerungen kommen als App-Benachrichtigung
            </li>
          </ul>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
          <button
            type="button"
            mat-button
            data-testid="install-suggestion-dismiss"
            (click)="close('dismissed')"
            i18n="@@installSuggestion.notNow"
          >
            Nicht jetzt
          </button>
          <a
            mat-flat-button
            data-testid="install-suggestion-play-store"
            [href]="storeUrl"
            target="_blank"
            rel="noopener"
            (click)="close('installing')"
          >
            <mat-icon aria-hidden="true">shop</mat-icon>
            <span i18n="@@installSuggestion.android.cta"
              >Im Play Store öffnen</span
            >
          </a>
        </mat-dialog-actions>
      }
      @case ('pwa') {
        <h2 mat-dialog-title i18n="@@installSuggestion.pwa.title">
          Als App installieren
        </h2>
        <mat-dialog-content>
          <p i18n="@@installSuggestion.pwa.body">
            Installiere {{ brandName }} mit einem Klick – kein App-Store nötig,
            Updates kommen automatisch.
          </p>
          <ul>
            <li i18n="@@installSuggestion.benefit.window">
              Eigenes Fenster und eigenes Symbol, ohne Browserleiste
            </li>
            <li i18n="@@installSuggestion.benefit.offline">
              Einträge speichern auch ohne Verbindung
            </li>
          </ul>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
          <button
            type="button"
            mat-button
            data-testid="install-suggestion-dismiss"
            (click)="close('dismissed')"
            i18n="@@installSuggestion.notNow"
          >
            Nicht jetzt
          </button>
          <button
            type="button"
            mat-flat-button
            data-testid="install-suggestion-install"
            [puBusy]="installing.busy()"
            (click)="installPwa()"
            i18n="@@installSuggestion.pwa.cta"
          >
            Installieren
          </button>
        </mat-dialog-actions>
      }
      @case ('ios') {
        <h2 mat-dialog-title i18n="@@installSuggestion.ios.title">
          Auf den Home-Bildschirm legen
        </h2>
        <mat-dialog-content>
          <p i18n="@@installSuggestion.ios.body">
            So startest du {{ brandName }} wie eine App, ohne Safari-Leiste:
          </p>
          <ol class="ios-steps">
            <li i18n="@@installSuggestion.ios.step1">
              Tippe unten auf das Teilen-Symbol
              <mat-icon aria-hidden="true">ios_share</mat-icon>
            </li>
            <li i18n="@@installSuggestion.ios.step2">
              Wähle „Zum Home-Bildschirm“
            </li>
          </ol>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
          <button
            type="button"
            mat-flat-button
            data-testid="install-suggestion-dismiss"
            (click)="close('dismissed')"
            i18n="@@installSuggestion.ios.ok"
          >
            Verstanden
          </button>
        </mat-dialog-actions>
      }
    }
  `,
})
export class InstallSuggestionDialogComponent {
  protected readonly brandName = BRAND_NAME;
  protected readonly storeUrl = playStoreUrl('install_dialog');
  protected readonly data =
    inject<InstallSuggestionDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<InstallSuggestionDialogComponent, InstallSuggestionResult>
  );
  private readonly installPrompt = inject(InstallPromptService);

  readonly installing = createBusyState();

  async installPwa(): Promise<void> {
    const outcome = await this.installing.run(() =>
      this.installPrompt.prompt()
    );
    this.close(outcome === 'accepted' ? 'installing' : 'dismissed');
  }

  close(result: InstallSuggestionResult): void {
    this.dialogRef.close(result);
  }
}
