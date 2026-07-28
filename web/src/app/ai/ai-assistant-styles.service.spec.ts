import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AI_ASSISTANT_STYLESHEET_HREF } from './ai-assistant.config';
import { AiAssistantStylesService } from './ai-assistant-styles.service';

function setup(platformId: 'browser' | 'server'): AiAssistantStylesService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      AiAssistantStylesService,
      { provide: PLATFORM_ID, useValue: platformId },
    ],
  });
  return TestBed.inject(AiAssistantStylesService);
}

function stylesheetLinks(): NodeListOf<HTMLLinkElement> {
  return document.head.querySelectorAll<HTMLLinkElement>(
    `link[href="${AI_ASSISTANT_STYLESHEET_HREF}"]`
  );
}

describe('AiAssistantStylesService', () => {
  afterEach(() => {
    stylesheetLinks().forEach((link) => link.remove());
  });

  it('should append the CopilotKit stylesheet in the browser', () => {
    // given
    const service = setup('browser');

    // when
    service.load();

    // then
    expect(stylesheetLinks().length).toBe(1);
    expect(stylesheetLinks()[0].rel).toBe('stylesheet');
  });

  it('should not append the stylesheet twice', () => {
    // given
    const service = setup('browser');
    service.load();

    // when
    service.load();

    // then
    expect(stylesheetLinks().length).toBe(1);
  });

  it('should do nothing during server rendering', () => {
    // given
    const service = setup('server');

    // when
    service.load();

    // then
    expect(stylesheetLinks().length).toBe(0);
  });
});
