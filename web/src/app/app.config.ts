import {
  ApplicationConfig,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection, isDevMode,
} from '@angular/core';
import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import localeDe from '@angular/common/locales/de';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { provideClientHydration, withEventReplay, withI18nSupport, withIncrementalHydration } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { appRoutes } from './app.routes';

registerLocaleData(localeDe);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    provideRouter(appRoutes),
    provideClientHydration(withIncrementalHydration(), withEventReplay(), withI18nSupport()),
    provideZonelessChangeDetection(),
    provideNativeDateAdapter(),
    provideCharts(withDefaultRegisterables(), {
      // Register matrix controller/element + datalabels plugin.
      registerables: [MatrixController, MatrixElement, ChartDataLabels as any],
    }),
    { provide: LOCALE_ID, useValue: 'de-DE' },
    { provide: MAT_DATE_LOCALE, useValue: 'de-DE' }, provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
  ],
};
