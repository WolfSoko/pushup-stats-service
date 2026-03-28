import '@angular/localize/init';
import '@testing-library/jest-dom';
import 'whatwg-fetch';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';

const ANGULAR_TESTBED_SETUP = Symbol.for('@angular/cli/testbed-setup');
if (!(globalThis as Record<symbol, unknown>)[ANGULAR_TESTBED_SETUP]) {
  (globalThis as Record<symbol, unknown>)[ANGULAR_TESTBED_SETUP] = true;
  getTestBed().initTestEnvironment(
    BrowserTestingModule,
    platformBrowserTesting(),
    { errorOnUnknownElements: true, errorOnUnknownProperties: true }
  );
}
