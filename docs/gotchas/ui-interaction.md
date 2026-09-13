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
