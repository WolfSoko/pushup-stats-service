import { isPlatformBrowser } from '@angular/common';
import { effect, inject, PLATFORM_ID, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { UserContextService } from '@pu-auth/auth';
import { CheerPingApiService } from '@pu-stats/data-access';
import { isFreshCheerPing } from '@pu-stats/models';
import { of } from 'rxjs';
import { UserConfigStore } from './user-config.store';

/** How long the fireworks overlay stays on screen once triggered. */
export const CHEER_ANIMATION_DURATION_MS = 3200;

/**
 * App-wide trigger for the cheer fireworks overlay.
 *
 * Listens to `cheerPings/{uid}` (a live Firestore doc `sendCheer` rewrites
 * on every cheer) so a dashboard that's open right now reacts immediately,
 * without polling the `cheers` ledger. A ping written before this store
 * started watching — the recipient was offline — is ignored here; the push
 * notification `sendCheer` also sends already covers that case.
 *
 * `play()` is exposed directly so the admin "UI-Features testen" page can
 * preview the animation on demand, bypassing both the live listener and the
 * user's `cheerAnimationEnabled` setting — that's the point of a preview.
 */
export const CheerAnimationStore = signalStore(
  { providedIn: 'root' },
  withProps(() => ({
    _api: inject(CheerPingApiService),
    _user: inject(UserContextService),
    _userConfig: inject(UserConfigStore),
    _platformId: inject(PLATFORM_ID),
  })),
  withProps((store) => ({
    pingResource: rxResource({
      params: () => ({ userId: store._user.userIdSafe() }),
      stream: ({ params }) =>
        params.userId ? store._api.watch(params.userId) : of(null),
    }),
  })),
  withState({ activeCheerFrom: null as string | null }),
  withMethods((store) => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    return {
      play(from: string): void {
        clearTimeout(hideTimer);
        patchState(store, { activeCheerFrom: from });
        hideTimer = setTimeout(() => {
          patchState(store, { activeCheerFrom: null });
        }, CHEER_ANIMATION_DURATION_MS);
      },
      dismiss(): void {
        clearTimeout(hideTimer);
        patchState(store, { activeCheerFrom: null });
      },
    };
  }),
  withHooks({
    onInit(store) {
      if (!isPlatformBrowser(store._platformId)) return;
      // Closure vars, not state: a doc rewritten with the same values (e.g.
      // a client re-emitting its cached snapshot) must not replay the
      // animation a second time. Rebased whenever the signed-in uid
      // changes — otherwise a switch to a different account mid-session
      // would judge that account's ping against the *previous* account's
      // session start, and a cheer sent before the switch could replay.
      let currentUid: string | null = null;
      let sessionStartAtMs = Date.now();
      let lastSeenAt: string | null = null;
      effect(() => {
        const uid = store._user.userIdSafe();
        const ping = store.pingResource.value();
        if (uid !== currentUid) {
          currentUid = uid;
          sessionStartAtMs = Date.now();
          lastSeenAt = null;
        }
        if (!ping || ping.at === lastSeenAt) return;
        // Mark the ping seen regardless of the enabled setting: toggling
        // the setting back on later must not replay a cheer that arrived
        // while it was off.
        const fresh = isFreshCheerPing(ping, sessionStartAtMs);
        lastSeenAt = ping.at;
        if (!fresh || !store._userConfig.cheerAnimationEnabled()) return;
        untracked(() => store.play(ping.from));
      });
    },
  })
);
