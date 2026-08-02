import { Auth } from '@angular/fire/auth';
import { TestBed } from '@angular/core/testing';
import { AI_ASSISTANT_CONFIG } from './ai-assistant.config';
import { AiAgentFactory } from './ai-agent.factory';

const AGENT_URL = 'https://agent.example.com/agUiAgent';

function setup(auth: Partial<Auth> | null): AiAgentFactory {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AI_ASSISTANT_CONFIG,
        useValue: { agentUrl: `  ${AGENT_URL}  `, agentId: 'default' },
      },
      { provide: Auth, useValue: auth },
    ],
  });
  return TestBed.inject(AiAgentFactory);
}

function authWithToken(getIdToken: () => Promise<string>): Partial<Auth> {
  return { currentUser: { getIdToken } } as unknown as Partial<Auth>;
}

describe('AiAgentFactory', () => {
  it('should point the agent at the trimmed endpoint', () => {
    // given
    const factory = setup(authWithToken(async () => 'token'));

    // when
    const agent = factory.create();

    // then
    expect(agent.url).toBe(AGENT_URL);
  });

  it('should sign each request with a freshly resolved ID token', async () => {
    // given — a token is minted per request, not captured once, because it
    // expires while the agent lives on.
    const getIdToken = vitest
      .fn()
      .mockResolvedValueOnce('token-1')
      .mockResolvedValueOnce('token-2');
    const factory = setup(authWithToken(getIdToken));
    const agent = factory.create();
    const fetchSpy = vitest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(''));

    // when
    await agent.fetch(AGENT_URL, { method: 'POST' });
    await agent.fetch(AGENT_URL, { method: 'POST' });

    // then
    const sent = fetchSpy.mock.calls.map(([, init]) =>
      new Headers(init?.headers).get('Authorization')
    );
    expect(sent).toEqual(['Bearer token-1', 'Bearer token-2']);
    fetchSpy.mockRestore();
  });

  it('should send the request unauthenticated when nobody is signed in', async () => {
    // given
    const factory = setup({ currentUser: null } as Partial<Auth>);
    const agent = factory.create();
    const fetchSpy = vitest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(''));

    // when
    await agent.fetch(AGENT_URL, { method: 'POST' });

    // then — the endpoint answers 401 and the chat surfaces it
    const [, init] = fetchSpy.mock.calls[0];
    expect(new Headers(init?.headers).get('Authorization')).toBeNull();
    fetchSpy.mockRestore();
  });

  it('should not fail the request when minting the token throws', async () => {
    // given
    const factory = setup(
      authWithToken(async () => {
        throw new Error('token refresh failed');
      })
    );
    const agent = factory.create();
    const fetchSpy = vitest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(''));

    // when
    await agent.fetch(AGENT_URL, { method: 'POST' });

    // then
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });
});
