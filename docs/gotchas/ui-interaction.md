# Gotchas: UI interaction (scrolling, pointer events)

## Mandatory scroll-snap cancels small programmatic scrolls

With `scroll-snap-type: x mandatory`, the browser re-snaps to the nearest snap point after every scripted write to `scrollLeft`. Two consequences seen in the arc nav (`web/src/app/core/nav/arc-nav.component.ts`):

- **A mouse drag that writes `scrollLeft` per `pointermove` jumps back** to the item it started on. Switch snapping off for the duration of the drag (a `.dragging` class with `scroll-snap-type: none`) and back on at release, which then snaps to the nearest item.
- **Wheel deltas smaller than half an item do nothing** because the re-snap undoes them. Accumulate the delta and move by whole items (`scrollTo` on the neighbour's centre) instead of nudging `scrollLeft`.

Touch swipes are unaffected: the browser owns the gesture and snaps only when it ends. jsdom implements no snapping at all, so unit tests cannot catch either symptom — check in a real browser.

## Swallowing the click that ends a drag needs the capture phase

`RouterLink` handles `click` on the `<a>` itself. A bubbling `(click)` handler on the scroll container runs **after** it, so `preventDefault()` there is too late and the navigation has already happened. Register the guard with `addEventListener('click', handler, { capture: true })` on the container (in `afterNextRender`, removed via `DestroyRef`) so it runs before any link handler.

## Seed layout-derived state for the server render

State that only exists after measuring the DOM (item offsets, scroll position) is empty during SSR and on the first client paint, so every item renders with the fallback value and the layout pops once `afterNextRender` measures. Derive a plausible seed from data that is available on the server (index distance to the active route, in the arc nav) and only replace it with the measured value.

## Wrapping strip: three copies and a silent jump

The arc nav wraps by rendering its entries three times and keeping the scroll position inside the middle copy; the scroll handler jumps by exactly one copy width when the position drifts into an outer copy (`wrapShift` in `arc-nav.geometry.ts`). Things that follow from that:

- The outer copies are `aria-hidden` with `tabindex="-1"`, so screen readers and the tab order only see one set of links; `aria-current` goes on the middle copy, the `.active` class on all three.
- Everything that scrolls to an item must address the middle copy (`count + index`), and a mouse drag's start position must be shifted by the same amount as the jump, or the strip leaps under the pointer.
- An item rests centred at `scrollLeft = renderedIndex × itemWidth` (the strip's inline padding makes the centre term cancel), so the middle copy spans `[copyWidth, 2·copyWidth − itemWidth]`. Put the jump thresholds half an item outside that range — a window centred on `copyWidth` looks plausible and is off by half a copy.
- Writing `scrollLeft` cuts a smooth `scrollTo` or a touch fling short, so the jump waits until scroll events have been quiet for a moment (`SETTLE_MS`). A mouse drag is the exception: its writes are our own, so it wraps immediately.
- Track the `@for` by index, not by route: the same path appears three times.

## Edge-to-Edge und Safe-Area-Insets

Die Play-Store-App ist eine TWA — Chrome rendert die Website, und ab targetSdk 35
zeichnet Android hinter Status- und Navigationsleiste. Der Web-Teil davon:

- **`env(safe-area-inset-*)` ist ohne `viewport-fit=cover` immer `0px`.** Genau das war
  der Fehler: `arc-nav.component.scss` und der Quick-Add-FAB rechneten seit jeher mit
  den Insets, das Viewport-Meta in `web/src/index.html` gab sie aber nie frei — die
  Arc-Nav saß unter der Gestenleiste. Neue fixierte Elemente an einer Bildschirmkante
  brauchen den passenden Inset im Padding, nicht nur einen festen Abstand.
- **Links und rechts zählen auch.** Im Querformat liegt der Displayausschnitt seitlich;
  `safe-area-inset-left`/`-right` gehören in das Inline-Padding von `.top-nav` und
  `.app-content` (`web/src/app/app.scss`).
- **`100vh` ist im Querformat falsch.** Mit eingeblendeter URL-Leiste überschießt `vh`
  den sichtbaren Viewport und schiebt die Aktionszeile eines Vollbild-Dialogs unter den
  Rand. `100dvh` nehmen — siehe `AUTO_COUNT_DIALOG_CONFIG` in
  `web/src/app/core/quick-add-orchestration.models.ts`.
- **Breakpoints auf die Breite taugen nicht für die Arc-Nav.** Sie ist auf jedem
  Viewport fixiert; ein Querformat-Telefon ist breit genug, um an `max-width: 767px`
  vorbeizulaufen, und trotzdem so flach, dass die Leiste ein Viertel des Schirms
  einnimmt. Der Snackbar-Abstand in `web/src/styles.scss` hing an so einer Regel und
  ließ den Toast im Querformat unter der Leiste landen.

Keine dieser Kanten ist in jsdom sichtbar — die Regressionstests dafür stehen in
`web/web-e2e/landscape-layout.spec.ts`. Der Android-Teil steht in
[`../android-twa-wrapper.md`](../android-twa-wrapper.md).
