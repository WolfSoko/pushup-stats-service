import { firstValueFrom } from 'rxjs';

import type { CelebrationQueueService } from './celebration-queue.service';

/**
 * Test double that opens each celebration at once (synchronously, like a
 * direct `dialog.open`) and settles when it closes — no waiting on other
 * dialogs, so specs keep asserting `open` right after the trigger.
 */
export function immediateCelebrationQueue(): Pick<
  CelebrationQueueService,
  'enqueue'
> {
  return {
    enqueue: async (open) => {
      const ref = await open();
      if (ref) await firstValueFrom(ref.afterClosed(), { defaultValue: null });
    },
  };
}
