import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  standalone: true,
  selector: 'pus-register-success',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './register-success.html',
  styleUrl: './register-success.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterSuccessComponent {
  readonly dashboard = output<void>();
  readonly trainingPlans = output<void>();
  readonly dailyGoal = output<void>();
}
