import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-workout-reminders-feature-section',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './workout-reminders-feature-section.component.html',
  styleUrl: './workout-reminders-feature-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutRemindersFeatureSectionComponent {
  readonly ctaClick = output<void>();
}
