import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { AI_ASSISTANT_CONFIG, AI_ASSISTANT_ROUTE } from './ai-assistant.config';
import { aiAssistantEnabledGuard } from './ai-assistant.guard';

@Component({ template: 'assistant' })
class AssistantStubComponent {}

@Component({ template: 'fallback' })
class FallbackStubComponent {}

interface Harness {
  readonly router: Router;
  /** Counts how often the lazy chunk would have been requested. */
  readonly loadCount: () => number;
}

function setup(runtimeUrl: string): Harness {
  let loads = 0;

  const routes: Routes = [
    { path: '', component: FallbackStubComponent },
    {
      path: AI_ASSISTANT_ROUTE,
      canMatch: [aiAssistantEnabledGuard],
      loadChildren: () => {
        loads += 1;
        return Promise.resolve([
          { path: '', component: AssistantStubComponent },
        ] satisfies Routes);
      },
    },
    { path: '**', redirectTo: '' },
  ];

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      {
        provide: AI_ASSISTANT_CONFIG,
        useValue: { runtimeUrl, agentId: 'default' },
      },
    ],
  });

  return { router: TestBed.inject(Router), loadCount: () => loads };
}

describe('aiAssistantEnabledGuard', () => {
  it('should fall through to the wildcard route while no runtime is configured', async () => {
    // given
    const { router, loadCount } = setup('');

    // when
    await router.navigateByUrl(`/${AI_ASSISTANT_ROUTE}`);

    // then
    expect(router.url).toBe('/');
    expect(loadCount()).toBe(0);
  });

  it('should activate the assistant route once a runtime is configured', async () => {
    // given
    const { router, loadCount } = setup(
      'https://agent.example.com/api/copilotkit'
    );

    // when
    await router.navigateByUrl(`/${AI_ASSISTANT_ROUTE}`);

    // then
    expect(router.url).toBe(`/${AI_ASSISTANT_ROUTE}`);
    expect(loadCount()).toBe(1);
  });
});
