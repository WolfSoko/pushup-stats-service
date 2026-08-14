import '@angular/localize/init';
import 'whatwg-fetch';
import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';

setupZonelessTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});

// jsdom ships no `structuredClone`, which IndexedDB uses to snapshot every
// stored value — without it the intent-store specs fail inside fake-indexeddb
// rather than in our code. Intents are plain JSON, so a JSON round-trip is a
// faithful stand-in.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = <T>(value: T): T =>
    value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
