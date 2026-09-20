import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-inbox-feature-section',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './inbox-feature-section.component.html',
  styleUrl: './inbox-feature-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxFeatureSectionComponent {
  readonly ctaClick = output<void>();
}
