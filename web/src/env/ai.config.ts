import { fireConfig } from './fire.config';
import { firebaseRuntime } from './firebase-runtime';

export interface AiAssistantConfig {
  /**
   * AG-UI agent endpoint the assistant talks to — the `agUiAgent` Cloud
   * Function. Derived from the active Firebase project so the staging
   * `fire.config` replacement carries the assistant with it. Set it to an empty
   * string to ship the app with the assistant switched off.
   */
  readonly agentUrl: string;
  /** Agent id the chat surface binds to. */
  readonly agentId: string;
}

const AGENT_FUNCTION = 'agUiAgent';
const FUNCTIONS_REGION = 'europe-west3';

function agentUrl(): string {
  if (firebaseRuntime.useEmulators) {
    return `http://127.0.0.1:5001/${fireConfig.projectId}/${FUNCTIONS_REGION}/${AGENT_FUNCTION}`;
  }
  return `https://${FUNCTIONS_REGION}-${fireConfig.projectId}.cloudfunctions.net/${AGENT_FUNCTION}`;
}

export const aiAssistantConfig: AiAssistantConfig = {
  agentUrl: agentUrl(),
  agentId: 'default',
};
