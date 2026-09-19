import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-workouts-feature-section',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './workouts-feature-section.component.html',
  styleUrl: './workouts-feature-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutsFeatureSectionComponent {
  readonly ctaClick = output<void>();
}
