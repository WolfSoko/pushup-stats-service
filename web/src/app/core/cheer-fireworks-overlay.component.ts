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
 * only the message chip is tappable, to dismiss early.
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
        <button
          type="button"
          class="cheer-message"
          (click)="store.dismiss()"
          i18n="@@cheer.overlay.message"
        >
          🔥 Ein Freund feuert dich an!
        </button>
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
    @keyframes cheer-rocket-launch {
      to {
        bottom: 80%;
        transform: translateY(0) rotate(-8deg);
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
    .cheer-message {
      position: absolute;
      left: 50%;
      top: 12%;
      transform: translateX(-50%);
      pointer-events: auto;
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
}
