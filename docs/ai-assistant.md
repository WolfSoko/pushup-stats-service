# AI Assistant (AG-UI / CopilotKit)

The app ships an **AG-UI client** built on [`@copilotkit/angular`](https://www.npmjs.com/package/@copilotkit/angular). It is "AI ready" rather than "AI included": the UI, the tool surface and the routing are in place, but no LLM backend and no provider key are part of the deployment. Point it at an AG-UI runtime and the assistant comes to life.

## Enabling it

`web/src/env/ai.config.ts` is the only switch:

```ts
export const aiAssistantConfig: AiAssistantConfig = {
  runtimeUrl: 'https://your-agent.example.com/api/copilotkit',
  agentId: 'default',
};
```

An empty `runtimeUrl` disables everything: the toolbar button and the landing-page CTA stay hidden, and `aiAssistantEnabledGuard` (a `canMatch` guard) keeps the router from even requesting the CopilotKit chunk. Use an absolute URL, or a same-origin path you proxy — the client and the SSR server run on different origins.

Per-environment overrides go through `fileReplacements` in `web/project.json`, the same way `firebase-runtime.ts` is swapped for staging.

## Why everything is behind a lazy route

`@copilotkit/angular` does not tree-shake. Importing a single symbol — even just the `COPILOT_KIT_CONFIG` token — pulls the whole 3.5 MB FESM plus `katex`, `highlight.js`, `marked`, `zod` and the AG-UI client: ~5 MB raw. The app's entire initial payload is ~250 kB, so nothing CopilotKit-related may be reachable from `app.config.ts` or any eagerly loaded component.

Two consequences shape the code:

1. **`provideCopilotKit` lives in `ai-assistant.routes.ts`**, not in `app.config.ts`. Because `CopilotKit` and `CopilotkitAgentFactory` are `providedIn: 'root'` while `COPILOT_KIT_CONFIG` has no root default, both classes are re-declared in the route's `providers` so they resolve against the route injector. Injecting either one from outside the assistant route throws `NullInjectorError` — that is intentional.
2. **The stylesheet is an asset, not a `styleUrl`.** `@copilotkit/angular/styles.css` is 76 kB; as a component style it breaks the 16 kB `anyComponentStyle` budget, and as a global style it lands on the critical path. `web/project.json` copies it to `assets/copilotkit/styles.css` and `AiAssistantStylesService` appends the `<link>` when the page mounts.

The route is registered `RenderMode.Client` in `app.routes.server.ts` — there is nothing to server-render for a chat that talks to an external runtime. It also sits behind `authGuard`: the tools read and write the signed-in user's data, so it is an auth-only route and carries the matching `Disallow` entries in `robots.txt`.

## What the agent can do

`registerAiAssistantTools()` (called from the page component's constructor, i.e. an injection context, so registrations die with the injector) wires three frontend tools plus agent context:

| Tool                 | Effect                                                                               |
| -------------------- | ------------------------------------------------------------------------------------ |
| `logExerciseEntry`   | Writes a set through `QuickAddOrchestrationService` — same path as the quick-add FAB |
| `getTrainingSummary` | Reads daily goal, today's progress and the per-exercise goal breakdown               |
| `navigateTo`         | Routes the browser to a known app page                                               |

`connectAgentContext` continuously publishes the rep-based catalog exercises (with their `min`/`max` bounds) and the current goal summary, so the agent knows which `exerciseId` values are valid without a round-trip.

Handler bodies live in `ai-assistant-tool-handlers.ts`, deliberately free of CopilotKit imports so they can be unit-tested without loading the library.

Tool names, descriptions and context payloads are **prompt material, not UI** — they stay English and out of the XLIFF catalog. Only the page chrome and the landing-page section are translated.

## Adding a tool

1. Add the handler (and its validation) to `ai-assistant-tool-handlers.ts` and cover it in `ai-assistant-tool-handlers.spec.ts`.
2. Register it in `ai-assistant.tools.ts` with a `zod` schema for `parameters`.
3. Keep write tools narrow: validate against `EXERCISE_CATALOG` bounds before touching Firestore, and return a structured `{ ok, error }` result the agent can reason about.

## Runtime backend

No runtime is bundled. `@copilotkit/runtime` would add an LLM provider key plus ~40 transitive server dependencies, and a public unauthenticated LLM proxy on a free app is a cost-abuse vector. If you host one, put an auth check in front of it and pass credentials via `provideCopilotKit({ headers })` in `ai-assistant.routes.ts` — never bake a key into `ai.config.ts`, which is compiled into the browser bundle.
