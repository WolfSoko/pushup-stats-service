export interface AiAssistantConfig {
  /**
   * AG-UI runtime endpoint the CopilotKit client talks to (see
   * `docs/ai-assistant.md`). Empty keeps the assistant hidden: the app ships
   * AI-ready but without a bundled LLM backend, so no provider key and no
   * per-request cost are baked into the deployment. Point it at your own
   * AG-UI runtime (absolute URL, or a same-origin path you proxy) to enable it.
   */
  readonly runtimeUrl: string;
  /** Agent id requested from the runtime. */
  readonly agentId: string;
}

export const aiAssistantConfig: AiAssistantConfig = {
  runtimeUrl: '',
  agentId: 'default',
};
