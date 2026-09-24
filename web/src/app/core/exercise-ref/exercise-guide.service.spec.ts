import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { ExerciseGuideDialogComponent } from './exercise-guide-dialog.component';
import { ExerciseGuideService } from './exercise-guide.service';

describe('ExerciseGuideService', () => {
  it('should open the guide dialog for the given exercise and variant', async () => {
    // given
    const dialog = { open: vitest.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: MatDialog, useValue: dialog }],
    });
    const service = TestBed.inject(ExerciseGuideService);

    // when
    await service.open('legs.squats', 'sumo');

    // then
    expect(dialog.open).toHaveBeenCalledWith(
      ExerciseGuideDialogComponent,
      expect.objectContaining({
        data: { exerciseId: 'legs.squats', variantId: 'sumo' },
      })
    );
  });
});
