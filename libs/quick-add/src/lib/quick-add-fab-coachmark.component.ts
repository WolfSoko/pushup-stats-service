import { Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * One-time tutorial bubble that points at the speed-dial FAB after a user
 * finishes onboarding. Presentation-only — like {@link QuickAddFabComponent}
 * it carries no "should I show?" logic; the host (`App`) decides visibility
 * from onboarding state + a localStorage seen-flag and listens for `dismiss`.
 */
@Component({
  selector: 'lib-quick-add-fab-coachmark',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './quick-add-fab-coachmark.component.html',
  styleUrl: './quick-add-fab-coachmark.component.scss',
})
export class QuickAddFabCoachmarkComponent {
  readonly dismiss = output<void>();

  protected readonly title = $localize`:@@quickAdd.coachmark.title:Schnellerfassung`;
  protected readonly body = $localize`:@@quickAdd.coachmark.body:Über diesen +‑Button erfasst du Wiederholungen blitzschnell – von jeder Seite aus.`;
  protected readonly dismissLabel = $localize`:@@quickAdd.coachmark.dismiss:Verstanden`;
  protected readonly closeAriaLabel = $localize`:@@quickAdd.coachmark.closeAria:Tutorial schließen`;
}
