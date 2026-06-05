import { StatsApiService } from './stats-api.service';
import { TestBed } from '@angular/core/testing';

describe('StatsApiService', () => {
  it('should be creatable via DI', () => {
    // given / when
    TestBed.configureTestingModule({});
    const service = TestBed.inject(StatsApiService);
    // then
    expect(service).toBeTruthy();
  });
});
