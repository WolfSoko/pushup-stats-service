import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Route,
  UrlSegment,
  type PartialMatchRouteSnapshot,
} from '@angular/router';
import { AI_ASSISTANT_CONFIG } from './ai-assistant.config';
import { aiAssistantEnabledGuard } from './ai-assistant.guard';

function matchGuard(runtimeUrl: string): boolean {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AI_ASSISTANT_CONFIG,
        useValue: { runtimeUrl, agentId: 'default' },
      },
    ],
  });

  const route: Route = { path: 'assistant' };
  const segments: UrlSegment[] = [new UrlSegment('assistant', {})];
  const snapshot = {} as PartialMatchRouteSnapshot;

  return TestBed.runInInjectionContext(
    () => aiAssistantEnabledGuard(route, segments, snapshot) as boolean
  );
}

describe('aiAssistantEnabledGuard', () => {
  it('should not match while no runtime URL is configured', () => {
    // given / when
    const matched = matchGuard('');

    // then
    expect(matched).toBe(false);
  });

  it('should match once a runtime URL is configured', () => {
    // given / when
    const matched = matchGuard('https://agent.example.com/api/copilotkit');

    // then
    expect(matched).toBe(true);
  });
});
