import { TestBed } from '@angular/core/testing';
import { FeatureFlagsService } from './feature-flags.service';

describe('FeatureFlagsService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FeatureFlagsService] });
  });

  it('autoExerciseCounter is enabled for every user', () => {
    const service = TestBed.inject(FeatureFlagsService);
    expect(service.autoExerciseCounter()).toBe(true);
  });
});
