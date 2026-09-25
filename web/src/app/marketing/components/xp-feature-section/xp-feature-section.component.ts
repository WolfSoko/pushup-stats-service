import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-xp-feature-section',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './xp-feature-section.component.html',
  styleUrl: './xp-feature-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class XpFeatureSectionComponent {
  readonly ctaClick = output<void>();
}
