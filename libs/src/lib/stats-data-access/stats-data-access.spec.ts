import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatsDataAccess } from './stats-data-access';

describe('StatsDataAccess', () => {
  let component: StatsDataAccess;
  let fixture: ComponentFixture<StatsDataAccess>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsDataAccess],
    }).compileComponents();

    fixture = TestBed.createComponent(StatsDataAccess);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
