import { TestBed } from '@angular/core/testing';
import {
  AnalysisTeaserSkeletonComponent,
  RecentExercisesSkeletonComponent,
} from './dashboard-skeletons.component';

describe('dashboard skeletons', () => {
  it('should mirror the analysis teaser card with a title, subtitle and chart block', async () => {
    // given
    await TestBed.configureTestingModule({
      imports: [AnalysisTeaserSkeletonComponent],
    }).compileComponents();
    // when
    const fixture = TestBed.createComponent(AnalysisTeaserSkeletonComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    // then
    expect(host.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('mat-card.teaser-card')).toBeTruthy();
    expect(host.querySelectorAll('pu-skeleton')).toHaveLength(3);
    expect(host.querySelector('pu-skeleton.pu-skeleton--rect')).toBeTruthy();
  });

  it('should reserve three recent-exercise tiles', async () => {
    // given
    await TestBed.configureTestingModule({
      imports: [RecentExercisesSkeletonComponent],
    }).compileComponents();
    // when
    const fixture = TestBed.createComponent(RecentExercisesSkeletonComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    // then
    expect(host.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelectorAll('mat-card')).toHaveLength(3);
    expect(host.querySelectorAll('pu-skeleton')).toHaveLength(9);
  });
});
