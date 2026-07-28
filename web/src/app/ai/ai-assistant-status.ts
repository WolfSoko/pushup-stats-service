export type AiAssistantStatus = 'ready' | 'connecting' | 'unavailable';

/**
 * Maps CopilotKit's runtime connection status onto the three states the page
 * renders. The status enum ships in `@copilotkit/core`, a transitive package
 * this app must not import from directly, so it arrives here as its string
 * value. Anything that is neither `connected` nor `connecting` — including the
 * terminal `error` state — is a dead runtime, not a pending handshake.
 */
export function toAiAssistantStatus(
  runtimeConnectionStatus: string
): AiAssistantStatus {
  if (runtimeConnectionStatus === 'connected') return 'ready';
  if (runtimeConnectionStatus === 'connecting') return 'connecting';
  return 'unavailable';
}
