/// <reference types="@angular/localize" />
import { mergeApplicationConfig } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { appBrowserConfig } from './app/app.browser.config';

bootstrapApplication(
  App,
  mergeApplicationConfig(appConfig, appBrowserConfig)
).catch((err) => console.error(err));
