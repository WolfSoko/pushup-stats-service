# @pu-stats/ui

Framework-level UI building blocks with no dependency on any other workspace lib, so every lib and the app may import them.

- `BusyDirective` (`[puBusy]`) — inline loading state for buttons and other CTAs. While busy the host gets `aria-busy`, blocks further clicks and shows a spinner in place of its leading icon (or before its label). Styles live in `src/lib/busy/busy.scss`, which `web/src/styles.scss` pulls in globally.
- `createBusyState()` / `createKeyedBusyState()` — signal-backed busy flags that wrap a promise, for stores and components to feed the directive.
