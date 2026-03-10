import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone: true,
  selector: 'pus-register-success',
  imports: [MatButtonModule],
  templateUrl: './register-success.html',
  styleUrl: './register-success.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterSuccessComponent {
  readonly dashboard = output<void>();
}
