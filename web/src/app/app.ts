import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatSnackBarModule,
    MatSidenavModule,
    MatIconModule,
    MatListModule,
    MatDividerModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  setLanguage(lang: 'de' | 'en', ev?: Event): void {
    ev?.preventDefault();

    // Pin the language choice client-side. This avoids issues with service worker
    // navigation caching swallowing Set-Cookie headers.
    const maxAge = 180 * 24 * 60 * 60; // 180 days
    document.cookie = `lang=${encodeURIComponent(lang)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;

    // No /de prefix in URL → DE is root.
    const target = lang === 'en' ? '/en/' : '/de';
    window.location.replace(target);
  }

  /** Whether the sidenav is open (same behavior on all screen sizes). */
  readonly navOpen = signal(false);

  constructor() {
    if (!this.swUpdate?.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(
        filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        const ref = this.snackBar.open($localize`Neue Version verfügbar`, $localize`Neu laden`, {
          duration: 20_000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        });

        ref.onAction().subscribe(() => {
          window.location.reload();
        });
      });
  }
}
