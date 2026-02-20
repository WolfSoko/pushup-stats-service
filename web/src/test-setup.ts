import '@angular/localize/init';

// Polyfill Node.js globals for Firebase SDK in browser tests
globalThis.process = globalThis.process || ({ env: {} } as any);
