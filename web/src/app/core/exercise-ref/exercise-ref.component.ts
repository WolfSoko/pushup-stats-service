import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { exerciseRefTooltip, resolveExerciseRef } from './exercise-ref.model';

/**
 * The single place every surface renders an exercise reference — free text,
 * training-plan checklists, and badge-style chips alike. Resolves name,
 * wiki link and a short description once (`resolveExerciseRef`) so the
 * whole thing acts as one clickable unit: a native `matTooltip` cannot
 * host a real, clickable link inside its own panel (it's a non-interactive
 * CDK overlay that closes on pointer-leave), so instead the tooltip shows
 * the description and the reference itself *is* the link to the wiki page.
 *
 * `resolveExerciseRef` touches the generated wiki content (sizeable across
 * every exercise/pushup type in every locale) — an eagerly-bundled caller
 * (the app shell) must render this behind an `@defer` block rather than
 * import it into its own eager template.
 */
@Component({
  selector: 'app-exercise-ref',
  imports: [RouterLink, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './exercise-ref.component.html',
  styleUrl: './exercise-ref.component.css',
})
export class ExerciseRefComponent {
  private readonly locale = inject(LOCALE_ID) as string;

  readonly exerciseId = input.required<string>();
  readonly variantId = input<string | null>(null);
  /** Overrides the resolved name, e.g. when the caller already composed one including the variant. */
  readonly label = input<string | null>(null);
  readonly showIcon = input(true);
  /** `'text'` reads as inline copy (dotted underline); `'chip'` renders a pill badge. */
  readonly variant = input<'text' | 'chip'>('text');

  protected readonly ref = computed(() =>
    resolveExerciseRef(this.exerciseId(), this.variantId(), this.locale)
  );
  protected readonly name = computed(() => this.label() ?? this.ref().name);
  protected readonly tooltip = computed(() => exerciseRefTooltip(this.ref()));
}
