import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BusyDirective } from '@pu-stats/ui';

import { CheerStore } from './cheer.store';
import { friendRejectionMessage } from './friends-messages';

/**
 * "Keep going" for one friend, wherever that friend shows up outside the
 * friends board. `cheered` is what the surface read with its data; the
 * store adds what was sent since. A refusal is explained in a snackbar —
 * these surfaces have no error area of their own.
 */
@Component({
  selector: 'app-cheer-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BusyDirective, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    @if (labeled()) {
      <button
        mat-stroked-button
        type="button"
        class="cheer-button"
        data-testid="cheer-button"
        [class.is-cheered]="isCheered()"
        [disabled]="isCheered()"
        [puBusy]="busy()"
        (click)="cheer()"
      >
        <mat-icon>{{ icon() }}</mat-icon>
        <span>{{ label() }}</span>
      </button>
    } @else {
      <button
        mat-icon-button
        type="button"
        class="cheer-button"
        data-testid="cheer-button"
        [class.is-cheered]="isCheered()"
        [disabled]="isCheered()"
        [puBusy]="busy()"
        [attr.aria-label]="ariaLabel()"
        [matTooltip]="ariaLabel()"
        (click)="cheer()"
      >
        <mat-icon>{{ icon() }}</mat-icon>
      </button>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .cheer-button.is-cheered,
    .cheer-button.pu-busy {
      color: var(--mat-sys-tertiary, #ff7043);
    }
  `,
})
export class CheerButtonComponent {
  private readonly store = inject(CheerStore);
  private readonly snackBar = inject(MatSnackBar);

  readonly uid = input.required<string>();
  /** Already cheered today, as the surface read it. */
  readonly cheered = input(false);
  /** Name of the friend, for the icon button's label. */
  readonly name = input<string | null>(null);
  /** A text button for a page about one friend; an icon in a list. */
  readonly labeled = input(false);

  protected readonly isCheered = computed(
    () => this.cheered() || this.store.hasCheered(this.uid())
  );
  protected readonly busy = computed(() => this.store.isCheering(this.uid()));
  protected readonly icon = computed(() =>
    this.isCheered() ? 'local_fire_department' : 'whatshot'
  );

  protected readonly label = computed(() =>
    this.isCheered()
      ? $localize`:@@friends.cheer.done:Heute angefeuert`
      : $localize`:@@friends.board.cheer:Anfeuern`
  );

  protected readonly ariaLabel = computed(() => {
    if (this.busy()) {
      return $localize`:@@friends.board.cheering:Anfeuerung wird gesendet`;
    }
    const name = this.name();
    if (this.isCheered()) {
      return name
        ? $localize`:@@friends.cheer.doneFor:${name}:name: heute schon angefeuert`
        : $localize`:@@friends.board.cheered:Heute schon angefeuert`;
    }
    return name
      ? $localize`:@@friends.cheer.for:${name}:name: anfeuern`
      : $localize`:@@friends.board.cheer:Anfeuern`;
  });

  protected async cheer(): Promise<void> {
    if (await this.store.cheer(this.uid())) return;
    const message = friendRejectionMessage(this.store.lastRejection());
    if (message) this.snackBar.open(message, undefined, { duration: 4000 });
  }
}
