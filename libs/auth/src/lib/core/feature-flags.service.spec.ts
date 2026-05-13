import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { FeatureFlagsService } from './feature-flags.service';
import { UserContextService } from './user-context.service';

describe('FeatureFlagsService', () => {
  let isAdmin: WritableSignal<boolean>;

  beforeEach(() => {
    isAdmin = signal(false);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: UserContextService,
          useValue: { isAdmin: isAdmin.asReadonly() },
        },
      ],
    });
  });

  it('given non-admin user, when reading autoExerciseCounter, then it is false', () => {
    const service = TestBed.inject(FeatureFlagsService);
    expect(service.autoExerciseCounter()).toBe(false);
  });

  it('given admin user, when reading autoExerciseCounter, then it is true', () => {
    isAdmin.set(true);
    const service = TestBed.inject(FeatureFlagsService);
    expect(service.autoExerciseCounter()).toBe(true);
  });

  it('given admin claim changes from true to false, when re-reading, then flag follows', () => {
    isAdmin.set(true);
    const service = TestBed.inject(FeatureFlagsService);
    expect(service.autoExerciseCounter()).toBe(true);

    isAdmin.set(false);
    expect(service.autoExerciseCounter()).toBe(false);
  });
});
