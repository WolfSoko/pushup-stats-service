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

  it('uses http backend when firebase service missing', (done) => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });

    const service = TestBed.inject(UserConfigApiService);
    const httpMock = TestBed.inject(HttpTestingController);

    const mockConfig: UserConfig = { colorTheme: 'dark' };

    service.getConfig('u4').subscribe((config) => {
      expect(config).toEqual(mockConfig);
      done();
    });

    const req = httpMock.expectOne('/api/users/u4/config');
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
      expect(firebaseMock.updateConfig).toHaveBeenCalledWith('u1', {
        colorTheme: 'dark',
      });
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

  it('uses server baseUrl when platform is server', (done) => {
    const firebaseMock = {
      enabled: false,
    } as unknown as FirebaseUserConfigService;

    const previousPort = process.env.API_PORT;
    const previousHost = process.env.API_HOST;
    process.env['API_PORT'] = '9999';
    delete process.env.API_HOST;

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: FirebaseUserConfigService, useValue: firebaseMock },
      ],
    });

    const service = TestBed.inject(UserConfigApiService);
    const httpMock = TestBed.inject(HttpTestingController);

    service.getConfig('u5').subscribe(() => {
      process.env.API_PORT = previousPort;
      process.env.API_HOST = previousHost;
      done();
    });

    const req = httpMock.expectOne('http://127.0.0.1:9999/api/users/u5/config');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('respects API_HOST on the server', (done) => {
    const firebaseMock = {
      enabled: false,
    } as unknown as FirebaseUserConfigService;

    const previousPort = process.env.API_PORT;
    const previousHost = process.env.API_HOST;
    process.env['API_PORT'] = '8788';
    process.env['API_HOST'] = 'api';

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: FirebaseUserConfigService, useValue: firebaseMock },
      ],
    });

    const service = TestBed.inject(UserConfigApiService);
    const httpMock = TestBed.inject(HttpTestingController);

    service.getConfig('u6').subscribe(() => {
      process.env.API_PORT = previousPort;
      process.env.API_HOST = previousHost;
      done();
    });

    const req = httpMock.expectOne('http://api:8788/api/users/u6/config');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });
});
