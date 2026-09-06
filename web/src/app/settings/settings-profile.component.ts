import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { RouterLink } from '@angular/router';

import { UserContextService } from '@pu-auth/auth';

import { AvatarService } from '../core/avatar.service';
import { SettingsFacade } from '../stats/shell/settings.facade';
import { ProfilePhotoService } from './profile-photo.service';

@Component({
  selector: 'app-settings-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    RouterLink,
  ],
  templateUrl: './settings-profile.component.html',
  styleUrl: './settings-section.scss',
})
export class SettingsProfileComponent {
  protected readonly facade = inject(SettingsFacade);
  protected readonly photos = inject(ProfilePhotoService);
  private readonly user = inject(UserContextService);
  private readonly avatar = inject(AvatarService);

  protected readonly photoError = signal<string | null>(null);

  /** An uploaded photo — the only kind this page can remove. */
  protected readonly uploadedUrl = this.avatar.uploadedUrl;

  /**
   * Without an upload the profile falls back to the account picture, so
   * the preview has to show it too — otherwise the page claims there is
   * no photo while the profile is already showing one.
   */
  protected readonly photoUrl = this.avatar.avatarUrl;

  protected readonly usesAccountPhoto = computed(
    () => this.uploadedUrl() === null && this.user.accountPhotoUrl() !== null
  );

  private readonly messages: Readonly<Record<string, string>> = {
    type: $localize`:@@settings.photo.error.type:Bitte ein JPG, PNG oder WebP wählen.`,
    size: $localize`:@@settings.photo.error.size:Das Bild ist zu groß.`,
    decode: $localize`:@@settings.photo.error.decode:Das Bild konnte nicht gelesen werden.`,
    upload: $localize`:@@settings.photo.error.upload:Hochladen fehlgeschlagen. Bitte erneut versuchen.`,
  };

  protected async onPhotoPicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset immediately so picking the same file twice fires `change` again.
    input.value = '';
    if (!file) return;

    this.photoError.set(null);
    const result = await this.photos.upload(file);
    if (!result.ok) {
      this.photoError.set(
        this.messages[result.reason] ?? this.messages['upload']
      );
      return;
    }
  }

  protected async removePhoto(): Promise<void> {
    this.photoError.set(null);
    await this.photos.remove();
  }
}
