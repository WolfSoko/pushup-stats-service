import '@angular/localize/init';

// Polyfill Node.js globals für Firebase SDK in Browser-Tests
globalThis.process = globalThis.process || ({ env: {} } as { env: Record<string, unknown> });
// Ersetze 'any' durch einen spezifischeren Typ für bessere Lint-Konformität
