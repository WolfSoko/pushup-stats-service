import { patchState, type WritableStateSource } from '@ngrx/signals';

/**
 * One server action on a friends-side store: clear the last refusal,
 * call, keep the refusal reason for the page, re-read on success. Shared
 * by the friends and challenges stores, which otherwise differ only in
 * what they re-read afterwards.
 */
export async function runStoreAction<Reason>(
  store: WritableStateSource<{ lastRejection: Reason | 'failed' | undefined }>,
  action: () => Promise<{ ok: boolean; reason?: Reason }>,
  refresh: () => Promise<void>
): Promise<boolean> {
  patchState(store, { lastRejection: undefined });
  try {
    const result = await action();
    if (!result.ok) {
      patchState(store, { lastRejection: result.reason ?? 'failed' });
      return false;
    }
    await refresh();
    return true;
  } catch {
    patchState(store, { lastRejection: 'failed' });
    return false;
  }
}
