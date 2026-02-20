import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { UserConfigApiService } from './user-config-api.service';
import { FirebaseUserConfigService } from './firebase-user-config.service';
import { of } from 'rxjs';

describe('UserConfigApiService', () => {
  it('delegates to firebase when enabled', (done) => {
    const firebaseMock = {
      enabled: true,
      getConfig: jest.fn(() => of({})),
    } as unknown as FirebaseUserConfigService;

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: FirebaseUserConfigService, useValue: firebaseMock },
      ],
    });

    const service = TestBed.inject(UserConfigApiService);
    const httpMock = TestBed.inject(HttpTestingController);

    service.getConfig('u1').subscribe(() => {
      expect(firebaseMock.getConfig).toHaveBeenCalledWith('u1');
      httpMock.expectNone(/\/api\/users\/u1\/config/);
      done();
    });
  });
});
