import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-profile-feature-section',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './profile-feature-section.component.html',
  styleUrl: './profile-feature-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileFeatureSectionComponent {
  readonly ctaClick = output<void>();
}
