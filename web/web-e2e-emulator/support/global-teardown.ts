import { TARGET } from './backend';
import { cleanupStagingData } from './cleanup';

/**
 * Gives back what the run took. Only staging needs it — the emulators go
 * away with the run.
 */
export default async function globalTeardown(): Promise<void> {
  if (TARGET !== 'staging') return;
  await cleanupStagingData();
}
