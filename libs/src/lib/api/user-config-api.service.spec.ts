import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { UserConfigApiService } from './user-config-api.service';
import { FirebaseUserConfigService } from './firebase-user-config.service';
import { of } from 'rxjs';
import { UserConfig } from '@pu-stats/models';

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

  it('uses http backend when firebase disabled', (done) => {
    const firebaseMock = {
      enabled: false,
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

    const mockConfig: UserConfig = { colorTheme: 'light' };

    service.getConfig('u2').subscribe((config) => {
      expect(config).toEqual(mockConfig);
      done();
    });

    const req = httpMock.expectOne('/api/users/u2/config');
    expect(req.request.method).toBe('GET');
    req.flush(mockConfig);
  });

  it('delegates updateConfig to firebase when enabled', (done) => {
    const firebaseMock = {
      enabled: true,
      updateConfig: jest.fn(() => of({ colorTheme: 'dark' })),
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

    service.updateConfig('u1', { colorTheme: 'dark' }).subscribe(() => {
      expect(firebaseMock.updateConfig).toHaveBeenCalledWith('u1', { colorTheme: 'dark' });
      httpMock.expectNone(/\/api\/users\/u1\/config/);
      done();
    });
  });

  it('uses http backend for updateConfig when firebase disabled', (done) => {
    const firebaseMock = {
      enabled: false,
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

    const mockConfig: UserConfig = { colorTheme: 'dark' };

    service.updateConfig('u3', { colorTheme: 'dark' }).subscribe((config) => {
      expect(config).toEqual(mockConfig);
      done();
    });

    const req = httpMock.expectOne('/api/users/u3/config');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ colorTheme: 'dark' });
    req.flush(mockConfig);
  });
});
