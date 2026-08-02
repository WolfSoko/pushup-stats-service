import { HttpAgent } from '@ag-ui/client';
import { Auth } from '@angular/fire/auth';
import { inject, Injectable } from '@angular/core';
import { AI_ASSISTANT_CONFIG, resolveAgentUrl } from './ai-assistant.config';

/**
 * Builds the AG-UI agent the chat surface talks to.
 *
 * The bearer token is attached inside a custom `fetch` rather than through
 * `HttpAgent.headers`: those are captured once at construction, while an ID
 * token expires after an hour and the agent outlives it. Resolving per request
 * also means the agent can be created before sign-in settles.
 */
@Injectable({ providedIn: 'root' })
export class AiAgentFactory {
  private readonly config = inject(AI_ASSISTANT_CONFIG);
  private readonly firebaseAuth = inject(Auth, { optional: true });

  create(): HttpAgent {
    return new HttpAgent({
      url: resolveAgentUrl(this.config),
      fetch: async (input, init) => {
        const token = await this.idToken();
        const headers = new Headers(init?.headers);
        if (token) headers.set('Authorization', `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    });
  }

  private async idToken(): Promise<string | null> {
    const user = this.firebaseAuth?.currentUser;
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch {
      // Let the request go out unauthenticated — the endpoint answers 401 and
      // the chat surfaces that, which beats swallowing the run silently.
      return null;
    }
  }
}
