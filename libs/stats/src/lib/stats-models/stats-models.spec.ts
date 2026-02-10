import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatsModels } from './stats-models';

describe('StatsModels', () => {
  let component: StatsModels;
  let fixture: ComponentFixture<StatsModels>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsModels],
    }).compileComponents();

    fixture = TestBed.createComponent(StatsModels);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
