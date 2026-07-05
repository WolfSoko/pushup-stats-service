import { TestBed } from '@angular/core/testing';
import { Functions } from '@angular/fire/functions';
import { CallableFunctionsService } from './callable-functions.service';

describe('CallableFunctionsService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: Functions, useValue: {} }],
    });
  });

  it('should be injectable with the Functions token provided via DI', () => {
    // given / when
    const service = TestBed.inject(CallableFunctionsService);

    // then
    expect(service).toBeInstanceOf(CallableFunctionsService);
  });

  it('should create an invocable callable for a function name', () => {
    // given
    const service = TestBed.inject(CallableFunctionsService);

    // when
    const fn = service.call('adminListUsers');

    // then
    expect(typeof fn).toBe('function');
  });
});
