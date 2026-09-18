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

## Die Arc-Nav parkt auf jedem Viewport unter dem Rand

Die Leiste schiebt sich bis auf einen 10px-Streifen aus dem Bild, sobald sie eine
Weile in Ruhe war — auf dem Desktop wie auf dem Telefon. Wer sie zurückholt, steht
in `web/src/app/core/nav/arc-nav-reveal.ts`:

- **Nach dem Start bleibt sie 5 Sekunden stehen** (`AUTO_HIDE_DELAY_MS`), damit die
  Navigation wenigstens einmal gesehen wird. Derselbe Timer läuft nach jeder
  Interaktion mit der Leiste neu an — sonst fährt sie mitten in einer Geste weg.
- **Die Lasche gehört in den Host, nicht in die Leiste.** `.arc-nav` clippt auf
  seine eigene gebogene Kontur (`overflow: hidden`), damit an den Ecken nichts
  heraussteht — ein Griff, der oben herausragen soll, wird dort abgeschnitten.
  Er sitzt deshalb als Geschwister der Leiste im Host und wird über
  `bottom: 100%` auf deren Oberkante gestellt.
- **Der Ausgangszustand ist „eingefahren", nicht „geparkt".** Die Park-Transform
  hängt an keiner Media-Query mehr, also stünde die einzige Navigation der App im
  server-gerenderten HTML zu 90% außerhalb des Bildes — und dauerhaft, wo kein
  Skript läuft. Der Countdown startet erst in `start()`, also im Browser.
- **Maus:** kommt der Zeiger in die unteren 110px (`REVEAL_ZONE_PX`), fährt sie ein;
  verlässt er die Zone, parkt sie sofort wieder. Der `pointermove`-Listener filtert
  auf `pointerType === 'mouse'`, denn ein liegender Finger hätte nichts, was ihn
  wieder wegnimmt, und würde die Leiste dauerhaft offen halten.
- **Touch:** dort gibt es kein Hover, also holt ein Zug nach oben aus den unteren
  48px (`EDGE_SWIPE_ZONE_PX`, ab 24px Weg) die Leiste zurück. Ein Zug, der weiter
  oben beginnt, gehört dem Inhalt und lässt sie stehen.
- **`:focus-within` ist kein Schmuck.** Hineintabben ist der einzige Weg der
  Tastatur, die geparkte Leiste zu holen.
- **`.app-content`/`.app-footer` reservieren `--arc-nav-height` plus 20px unten**
  (die Leiste plus die Lasche, die auf ihr steht), obwohl die Leiste dort
  meist nicht steht. Sie kommt zurück, sobald jemand an den unteren Rand greift —
  also auch dann, wenn dort ein Footer-Link liegt. Ohne die Reserve würde sie ihn
  verdecken.
- **E2E-Tests dürfen die Leiste nicht als sichtbar voraussetzen.** Wer gegen ihre
  Lage misst, misst nach ein paar Sekunden gegen die geparkte Lage und bekommt ein
  Ergebnis geschenkt; gegen ihre `height` zu messen (`landscape-layout.spec.ts`)
  bleibt unabhängig davon. Wer sie anklicken will, holt sie vorher zurück.

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
