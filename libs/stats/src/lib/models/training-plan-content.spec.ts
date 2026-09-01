import { localizeTrainingPlanContent } from './training-plan-content';
import { TRAINING_PLAN_CONTENT } from './training-plan-content.generated';

describe('localizeTrainingPlanContent', () => {
  const slugWithContent = Object.keys(TRAINING_PLAN_CONTENT)[0];

  it('should return the locale variant when it exists', () => {
    // given a slug that ships de content
    // when the German locale is requested
    const html = localizeTrainingPlanContent(slugWithContent, 'de');
    // then the German HTML body is returned
    expect(html).toBe(TRAINING_PLAN_CONTENT[slugWithContent]['de']);
  });

  it('should strip the region suffix before the lookup', () => {
    // given a regional locale id like Angular provides
    // when de-DE is requested
    const html = localizeTrainingPlanContent(slugWithContent, 'de-DE');
    // then it resolves to the de variant
    expect(html).toBe(TRAINING_PLAN_CONTENT[slugWithContent]['de']);
  });

  it('should fall back en → de for an untranslated locale', () => {
    // given a locale no plan ships content for
    // when it is requested
    const html = localizeTrainingPlanContent(slugWithContent, 'zh');
    // then the English (canonical) variant is served
    expect(html).toBe(TRAINING_PLAN_CONTENT[slugWithContent]['en']);
  });

  it('should return null for a plan without editorial content', () => {
    // given a slug with no markdown files yet
    // when any locale is requested
    const html = localizeTrainingPlanContent('no-such-plan', 'de');
    // then the detail page can simply omit the section
    expect(html).toBeNull();
  });
});
