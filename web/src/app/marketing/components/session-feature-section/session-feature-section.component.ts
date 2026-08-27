import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-session-feature-section',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './session-feature-section.component.html',
  styleUrl: './session-feature-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionFeatureSectionComponent {
  readonly ctaClick = output<void>();
}
