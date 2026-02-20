import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { FirebaseUserConfigService } from './firebase-user-config.service';
import { of } from 'rxjs';

describe('FirebaseUserConfigService', () => {
  it('is disabled when not in browser', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    const service = TestBed.inject(FirebaseUserConfigService);
    expect(service.enabled).toBe(false);
  });

  it('is disabled when firebase config not available', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });
    const service = TestBed.inject(FirebaseUserConfigService);
    expect(service.enabled).toBe(false);
  });

  it('returns empty config when disabled', (done) => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    const service = TestBed.inject(FirebaseUserConfigService);
    service.getConfig('user123').subscribe((config) => {
      expect(config).toEqual({});
      done();
    });
  });

  it('returns empty config from updateConfig when disabled', (done) => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    const service = TestBed.inject(FirebaseUserConfigService);
    service.updateConfig('user123', { colorTheme: 'dark' }).subscribe((config) => {
      expect(config).toEqual({});
      done();
    });
  });
});