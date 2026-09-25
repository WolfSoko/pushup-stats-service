import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import type { XpGainedDialogData } from './xp-gained.models';
import { prefersReducedMotion } from '../reduced-motion';

export const XP_COUNT_UP_MS = 900;
export const XP_LEVEL_UP_DELAY_MS = 1100;

const SPARK_COUNT = 16;

@Component({
  selector: 'app-xp-gained-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatButtonModule, MatIconModule],
  templateUrl: './xp-gained-dialog.component.html',
  styleUrl: './xp-gained-dialog.component.scss',
})
export class XpGainedDialogComponent {
  protected readonly data = inject<XpGainedDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<XpGainedDialogComponent>);

  protected readonly levelUp = this.data.after.level > this.data.before.level;
  protected readonly displayXp = signal(0);
  protected readonly phase = signal<'fill' | 'levelup'>('fill');

  protected readonly sparks = Array.from({ length: SPARK_COUNT }, (_, i) => ({
    angle: (360 / SPARK_COUNT) * i + (i % 2 ? 8 : -4),
    distance: 70 + ((i * 37) % 45),
    delay: (i % 4) * 40,
  }));

  /** What the bar shows: the old level filling up, then the new one. */
  protected readonly bar = computed(() => {
    const { before, after } = this.data;
    if (!this.levelUp) {
      return { level: after.level, from: before.fraction, to: after.fraction };
    }
    return this.phase() === 'levelup'
      ? { level: after.level, from: 0, to: after.fraction }
      : { level: before.level, from: before.fraction, to: 1 };
  });

  constructor() {
    const reduced = prefersReducedMotion();
    if (reduced) {
      this.displayXp.set(this.data.xp);
      if (this.levelUp) this.phase.set('levelup');
      return;
    }
    this.countUp();
    if (this.levelUp) {
      const timer = setTimeout(
        () => this.phase.set('levelup'),
        XP_LEVEL_UP_DELAY_MS
      );
      inject(DestroyRef).onDestroy(() => clearTimeout(timer));
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }

  private countUp(): void {
    const target = this.data.xp;
    const raf = globalThis.requestAnimationFrame;
    if (!raf) {
      this.displayXp.set(target);
      return;
    }
    let handle = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / XP_COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      this.displayXp.set(Math.round(target * eased));
      if (t < 1) handle = raf(step);
    };
    handle = raf(step);
    inject(DestroyRef).onDestroy(() =>
      globalThis.cancelAnimationFrame?.(handle)
    );
  }
}
