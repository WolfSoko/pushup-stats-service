import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';

const BEEP_HZ = 880;
const BEEP_MS = 180;
const BEEP_GAP_MS = 220;
const BEEP_COUNT = 2;
const VIBRATION_PATTERN = [120, 80, 120];

/**
 * The "target reached" cue: a short double beep plus a vibration where
 * the device offers one. Every path is best-effort — audio may be blocked
 * until a user gesture, vibration is desktop-absent — and must never
 * throw into the timer that triggered it.
 */
@Injectable({ providedIn: 'root' })
export class StopwatchSignalService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private audio: AudioContext | null = null;

  play(): void {
    if (!this.isBrowser) return;
    this.vibrate();
    this.beep();
  }

  private vibrate(): void {
    try {
      navigator.vibrate?.(VIBRATION_PATTERN);
    } catch {
      // Vibration unavailable — the beep still plays.
    }
  }

  private beep(): void {
    try {
      const Ctor = globalThis.AudioContext;
      if (!Ctor) return;
      this.audio ??= new Ctor();
      const ctx = this.audio;
      const start = ctx.currentTime;
      for (let i = 0; i < BEEP_COUNT; i++) {
        const at = start + (i * (BEEP_MS + BEEP_GAP_MS)) / 1000;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = BEEP_HZ;
        gain.gain.setValueAtTime(0.2, at);
        gain.gain.exponentialRampToValueAtTime(0.001, at + BEEP_MS / 1000);
        osc.connect(gain).connect(ctx.destination);
        osc.start(at);
        osc.stop(at + BEEP_MS / 1000);
      }
      void ctx.resume?.();
    } catch {
      // No audio output — the vibration (if any) already fired.
    }
  }
}
