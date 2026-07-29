# AI Assistant (AG-UI / CopilotKit + Gemini)

The in-app assistant is an [`@copilotkit/angular`](https://www.npmjs.com/package/@copilotkit/angular) chat surface talking to the `agUiAgent` Cloud Function over the open **AG-UI** protocol. The function runs Gemini and answers with the run as an SSE event stream.

```text
CopilotChat ── HttpAgent (@ag-ui/client) ──POST──▶ agUiAgent (europe-west3)
     ▲                                                    │
     └────────────── SSE: AG-UI events ◀──────────────────┘ Gemini
```

## Setup

The endpoint needs a Gemini API key in Secret Manager. **Without it the function fails to deploy** — `defineSecret` requires the secret to exist:

```bash
echo -n '<key>' | gcloud secrets create GEMINI_API_KEY --data-file=- --project=pushup-stats
./infra/setup-prod-secrets.sh   # grants the runtime SA access
```

Same for the staging project. `web/src/env/ai.config.ts` derives the endpoint from `fireConfig.projectId`, so the staging `fireConfig` replacement carries the assistant with it and the emulator gets `127.0.0.1:5001` automatically. Set `agentUrl` to an empty string to ship with the assistant switched off — the toolbar button and landing CTA disappear and `aiAssistantEnabledGuard` keeps the router from requesting the CopilotKit chunk.

## Server: `agUiAgent`

`data-store/functions/src/functions-ai-agent.ts`, an `onRequest` handler (the protocol needs streaming HTTP; a callable can't do SSE).

- **Auth:** Firebase ID token as `Authorization: Bearer …`, verified with `verifyIdToken`. Answered as 401 _before_ the stream opens, so the client sees a status rather than an empty run.
- **Model:** `gemini-2.0-flash-lite`, same as the motivation-quote generator.
- **Prompt:** `ai/agent-prompt.ts`. System turns and the client's agent context are folded into `systemInstruction`; the transcript is capped at the newest 40 turns.

Two mapping details in `ai/gemini-mapping.ts` carry the protocol edge cases:

1. **Tool results need a function name.** AG-UI identifies a result by `toolCallId`; Gemini wants `functionResponse.name`. The name is resolved from the assistant turn that opened the call.
2. **Gemini rejects standard JSON Schema keywords.** `zod-to-json-schema` emits `$schema` and `additionalProperties`, and Gemini answers the _whole_ request with a 400 when it sees them — one stray keyword takes down every tool. `toGeminiSchema` strips them, preserves string arrays like `required`/`enum`, and gives an empty object schema a `properties: {}`.

`ai/ag-ui-events.ts` serialises the run. The client verifies ordering, so the emitter closes an open text block before starting a tool call and never terminates a run twice. The event names are pinned against `@ag-ui/core`'s `EventType` by a drift guard, since the enum itself is deliberately not bundled.

**Tool calls are answered, not executed.** The browser owns the handlers: a call ends the run, the client runs the tool and starts the next run with the result appended.

## Client

`provideCopilotKit` is _not_ used — `COPILOT_KIT_CONFIG` is provided directly in `ai-assistant.routes.ts` so the agent can come out of DI. `AiAgentFactory` builds an `HttpAgent` whose custom `fetch` mints an ID token per request; `HttpAgent.headers` is captured once at construction and would expire after an hour.

### Why everything is behind a lazy route

`@copilotkit/angular` does not tree-shake. Importing a single symbol — even just the `COPILOT_KIT_CONFIG` token — pulls the whole 3.5 MB FESM plus `katex`, `highlight.js`, `marked`, `zod` and the AG-UI client: ~5 MB raw, against an initial payload of ~250 kB.

- `CopilotKit` and `CopilotkitAgentFactory` are `providedIn: 'root'` but read `COPILOT_KIT_CONFIG`, which has no root default, so both are re-declared in the route's `providers`. Injecting either from outside the assistant route throws `NullInjectorError` — that is intentional.
- The 76 kB stylesheet ships as an asset and is linked at runtime by `AiAssistantStylesService`: as a component style it breaks the 16 kB `anyComponentStyle` budget, as a global style it lands on the critical path.

The route is `RenderMode.Client` and sits behind `authGuard`; the tools read and write the signed-in user's data, so it is an auth-only route with matching `Disallow` entries in `robots.txt`.

## What the agent can do

`registerAiAssistantTools()` runs in the page component's injection context, so registrations die with the injector.

| Tool                 | Effect                                                                               |
| -------------------- | ------------------------------------------------------------------------------------ |
| `logExerciseEntry`   | Writes a set through `QuickAddOrchestrationService` — same path as the quick-add FAB |
| `getTrainingSummary` | Reads daily goal, today's progress and the per-exercise goal breakdown               |
| `navigateTo`         | Routes the browser to a known app page                                               |

`connectAgentContext` publishes the rep-based catalog exercises (with `min`/`max`) and the current goal summary, so the agent knows which `exerciseId` values are valid without a round-trip.

Handler bodies live in `ai-assistant-tool-handlers.ts`, free of CopilotKit imports so they unit-test without loading the library. Tool names, descriptions and context payloads are **prompt material, not UI** — they stay English and out of the XLIFF catalog.

### Adding a tool

1. Add the handler and its validation to `ai-assistant-tool-handlers.ts`, covered in the matching spec.
2. Register it in `ai-assistant.tools.ts` with a `zod` schema for `parameters`.
3. Keep write tools narrow: validate against `EXERCISE_CATALOG` bounds before touching Firestore and return a structured `{ ok, error }` the agent can reason about.

## Cost and abuse

Every run is an LLM call billed to the project. The endpoint requires a signed-in Firebase user, which bounds exposure but does not rate-limit — a determined authenticated user can still loop. If usage needs a ceiling, add a per-uid quota in the handler before the Gemini call.
