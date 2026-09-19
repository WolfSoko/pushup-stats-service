import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CheerAnimationStore } from './cheer-animation.store';

/**
 * Full-screen celebration shown to the recipient of a friend's cheer:
 * emoji rockets launching into a firework burst, pure CSS (no
 * `@angular/animations`). Mounted once at the app root so it fires
 * regardless of which page is open — driven entirely by
 * {@link CheerAnimationStore}, which also backs the admin preview button.
 *
 * `pointer-events: none` on the overlay keeps the app usable underneath;
 * only the message chip (dismiss) and the cheer-back button are tappable.
 */
@Component({
  selector: 'app-cheer-fireworks-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.activeCheerFrom()) {
      <div class="cheer-overlay" data-testid="cheer-overlay">
        @for (rocket of rockets; track rocket) {
          <span class="rocket" aria-hidden="true" [style.--i]="rocket">🚀</span>
        }
        @for (burst of bursts; track burst) {
          <span class="burst" aria-hidden="true" [style.--i]="burst">{{
            burstEmoji(burst)
          }}</span>
        }
        <div class="cheer-panel">
          <button
            type="button"
            class="cheer-message"
            (click)="store.dismiss()"
            i18n="@@cheer.overlay.message"
          >
            🔥 Ein Freund feuert dich an!
          </button>
          <button
            type="button"
            class="cheer-back-button"
            data-testid="cheer-back-button"
            [disabled]="cheerBackDisabled()"
            [attr.aria-label]="cheerBackLabel()"
            (click)="store.cheerBack()"
          >
            <span
              class="cheer-back-icon"
              [class.is-sending]="store.cheerBackStatus() === 'sending'"
              >🔥</span
            >
            {{ cheerBackLabel() }}
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .cheer-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000;
      overflow: hidden;
      pointer-events: none;
    }
    .rocket,
    .burst {
      position: absolute;
      left: calc(10% + var(--i) * 20%);
      font-size: 2.4rem;
    }
    .rocket {
      bottom: -10%;
      transform: rotate(-45deg);
      animation: cheer-rocket-launch 1400ms ease-out forwards;
      animation-delay: calc(var(--i) * 220ms);
    }
    .burst {
      top: 18%;
      opacity: 0;
      font-size: 3rem;
      animation: cheer-burst 900ms ease-out forwards;
      animation-delay: calc(1200ms + var(--i) * 220ms);
    }
    /* Rotated -45deg so the emoji's default up-right heading points
       straight up; the translateX zig-zag is layered on top of that
       fixed rotation so the rocket still stands vertical while it
       weaves on the way up. */
    @keyframes cheer-rocket-launch {
      0% {
        bottom: -10%;
        transform: translateX(0) rotate(-45deg);
        opacity: 1;
      }
      20% {
        transform: translateX(-14px) rotate(-45deg);
      }
      40% {
        transform: translateX(12px) rotate(-45deg);
      }
      60% {
        transform: translateX(-10px) rotate(-45deg);
      }
      80% {
        bottom: 70%;
        transform: translateX(8px) rotate(-45deg);
      }
      100% {
        bottom: 80%;
        transform: translateX(0) rotate(-45deg);
        opacity: 0;
      }
    }
    @keyframes cheer-burst {
      0% {
        opacity: 0;
        transform: scale(0.4);
      }
      40% {
        opacity: 1;
        transform: scale(1.2);
      }
      100% {
        opacity: 0;
        transform: scale(1);
      }
    }
    .cheer-panel {
      position: absolute;
      left: 50%;
      top: 12%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      pointer-events: auto;
    }
    .cheer-message,
    .cheer-back-button {
      cursor: pointer;
      border: none;
      border-radius: 999px;
      padding: 8px 18px;
      font-size: 1rem;
      font-weight: 600;
      color: #fff;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(2px);
    }
    .cheer-back-button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.9rem;
      background: rgba(255, 112, 67, 0.85);
    }
    .cheer-back-button:disabled {
      cursor: default;
      opacity: 0.7;
    }
    /* The flame spins while the cheer-back is in flight — same idea as
       the friends board's cheer button (cheer-spin), a different
       component so the animation is duplicated rather than shared. */
    .cheer-back-icon.is-sending {
      display: inline-block;
      animation: cheer-spin 900ms linear infinite;
    }
    @keyframes cheer-spin {
      to {
        transform: rotate(1turn);
      }
    }
    /* Fireworks without the fire: a still emoji row says the same thing
       without the motion, matching the cheer-spin precedent on the
       friends board. */
    @media (prefers-reduced-motion: reduce) {
      .rocket {
        display: none;
      }
      .burst {
        animation: none;
        opacity: 1;
        bottom: unset;
      }
      .cheer-back-icon.is-sending {
        animation: none;
        opacity: 0.6;
      }
    }
  `,
})
export class CheerFireworksOverlayComponent {
  protected readonly store = inject(CheerAnimationStore);

  protected readonly rockets = [0, 1, 2] as const;
  protected readonly bursts = [0, 1, 2] as const;
  private static readonly BURST_EMOJIS = ['🎆', '✨', '🎇'] as const;

  protected burstEmoji(index: number): string {
    return CheerFireworksOverlayComponent.BURST_EMOJIS[index];
  }

  private readonly cheerBackIdleLabel = $localize`:@@cheer.overlay.cheerBack.idle:Zurück anfeuern`;
  private readonly cheerBackSendingLabel = $localize`:@@cheer.overlay.cheerBack.sending:Anfeuerung wird gesendet`;
  private readonly cheerBackSentLabel = $localize`:@@cheer.overlay.cheerBack.sent:Zurückgefeuert!`;
  private readonly cheerBackAlreadyLabel = $localize`:@@cheer.overlay.cheerBack.already:Heute schon angefeuert`;
  private readonly cheerBackErrorLabel = $localize`:@@cheer.overlay.cheerBack.error:Fehlgeschlagen – nochmal?`;

  /** Only one attempt at a time, and no point retrying once it landed. */
  protected cheerBackDisabled(): boolean {
    const status = this.store.cheerBackStatus();
    return status === 'sending' || status === 'sent' || status === 'already';
  }

  protected cheerBackLabel(): string {
    switch (this.store.cheerBackStatus()) {
      case 'sending':
        return this.cheerBackSendingLabel;
      case 'sent':
        return this.cheerBackSentLabel;
      case 'already':
        return this.cheerBackAlreadyLabel;
      case 'error':
        return this.cheerBackErrorLabel;
      default:
        return this.cheerBackIdleLabel;
    }
  }
}
