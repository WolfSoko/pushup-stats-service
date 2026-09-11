# Play Store Listing — Inhalt & Belege

Der Store-Text der Android-App (TWA-Wrapper unter
[`mobile/android-twa`](../mobile/android-twa)). Deutsch ist die Quell-Sprache,
analog zu `web/src/locale/messages.xlf`.

> **Der Text steht nicht mehr in dieser Datei.** Quelle sind die Dateien unter
> [`store/play/`](../store/play), von dort veröffentlicht das Publish-Script
> direkt in die Play Console — siehe
> [`docs/play-store-publishing.md`](play-store-publishing.md).
>
> | Feld                      | Datei                                       | Limit |
> | ------------------------- | ------------------------------------------- | ----- |
> | Titel                     | `store/play/<locale>/title.txt`             | 30    |
> | Kurzbeschreibung          | `store/play/<locale>/short-description.txt` | 80    |
> | Vollständige Beschreibung | `store/play/<locale>/full-description.txt`  | 4000  |
>
> Gepflegt: `de-DE` (Quelle) und `en-US`. Die Limits prüft
> `pnpm nx test tools` — zu langer Text scheitert in CI, nicht erst beim
> Veröffentlichen.

Diese Datei bleibt als **Beleg-Sammlung**: Der Store-Text behauptet konkrete
Zahlen und Eigenschaften, und die veralten still, wenn sie niemand an den Code
bindet.

## Feature-Drift vermeiden

Wenn du Übungen (`EXERCISE_CATALOG`), Trainingspläne (`TRAINING_PLANS`),
Liegestütz-Varianten (`PUSHUP_TYPES`) oder die Locale-Liste in
`web/project.json` änderst, gehören die Zahlen im Store-Text mit angepasst.

## Anzeigename: „Pushup Tracker"

Ein Name über alle Flächen, damit Store, Startbildschirm und Web-App nicht
drei Marken behaupten. Er steht an diesen Stellen — wer ihn ändert, ändert
sie alle:

| Fläche                  | Datei                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| Play-Titel (Präfix)     | `store/play/<locale>/title.txt`                                                                          |
| PWA                     | `web/public/manifest.webmanifest` (`name`)                                                               |
| TWA / Android-App-Label | `mobile/android-twa/twa-manifest.json`, `app/build.gradle`, `app/src/main/res/raw/web_app_manifest.json` |
| Seitentitel & Social    | `web/src/index.html`, `web/src/app/app.routes.ts` (`seoTitle`)                                           |
| Sichtbare UI            | `@@eyebrowTitle`, der Login-Titel, der Android-Test-Dialog                                               |
| Push-Benachrichtigungen | `data-store/functions/src/push/reminder-payload.ts`, `libs/sw-push/src/handlers.ts`                      |
| Blog-Autor/Publisher    | `web/src/app/blog/blog-article.component.ts`                                                             |

Nicht betroffen und absichtlich anders: die Domain `pushup-stats.com`, die
Paket-ID `com.pushupstats.app`, der Firebase-Projektname und der Repo-Name
(`pushup-stats-service`) — technische Identitäten, die Nutzer nie sehen und
deren Änderung teuer bis unmöglich ist. `short_name` / `launcherName`
bleiben `Pushups`: der Launcher schneidet längere Labels ohnehin ab.

**Warum „Tracker" und nicht „Stats":** „tracker" wird gesucht, „stats" nicht
— und die ~20 indexierten Seitentitel trugen den Namen schon.

## Belege für die Aussagen im Listing

- **42 Übungen + 9 Kategorien** — `EXERCISE_CATALOG` / `EXERCISE_CATEGORIES`
  in `libs/stats/src/lib/models/exercise.catalog.ts`. Der Katalog enthält
  `PUSHUP_DEFINITION` **plus** 41 weitere Definitionen — daher „Liegestütze
  und 41 weitere Übungen“ im Fließtext, aber „42 Übungen“ in der Aufzählung.
- **13 Liegestütz-Varianten** — `PUSHUP_TYPES` in
  `libs/stats/src/lib/models/pushup-type.models.ts`
- **10 Trainingspläne** — `TRAINING_PLANS` in
  `libs/stats/src/lib/models/training-plan.catalog.ts`
- **9 Sprachen** — `localize`-Liste in `web/project.json`:
  `de, en, fr, es, it, nl, el, no, zh`. Latein ist nicht mehr dabei und darf
  im Listing nicht mehr auftauchen.
- **Auto-Zähler** — `autoCountProfileId` (pushup, situp, squat, pullup) bzw.
  `holdTimerProfileId` (plank, hollowhold) im Übungskatalog
- **Datenbank in Frankfurt** — Firestore-Region `europe-west3`, siehe
  `docs/ci-cd.md`
- **Konto-Löschung** — `confirmDeleteFromDialog()` in
  `web/src/app/stats/shell/settings-page.component.ts` anonymisiert die
  User-Config und löscht den Auth-User; die Trainingseinträge bleiben
  anonymisiert bestehen (so sagt es auch der Dialog unter
  `@@settings.deleteDialogInfo`). Das Listing darf deshalb **keine**
  vollständige Löschung aller Einträge versprechen.
- **Sechs Schnellaktionen insgesamt** — `MAX_QUICK_ADDS = 6` in
  `libs/stats/src/lib/models/user-config.models.ts`. Die sechs Slots teilen
  sich alle Übungen, es sind keine sechs Presets _pro_ Übung.

## Was noch fehlt

- **Weitere Sprachen.** `de-DE` und `en-US` sind gepflegt. Die Store-Texte
  laufen bewusst **nicht** über die tägliche Übersetzungs-Routine (die
  arbeitet auf XLIFF und `content/`), jede weitere Sprache ist also
  dauerhafte Handarbeit. Welche sich lohnen:
  [`docs/play-store-publishing.md`](play-store-publishing.md#welche-sprachen-sich-lohnen).
- **`en-US` ist kein Übersetzungs-Klon.** Titel, Kurzbeschreibung und der
  Einstieg sind eigenständig getextet, weil englisches ASO auf andere
  Suchbegriffe zielt („push-up counter“, „workout tracker“) als das
  deutsche Original. Eine Änderung am deutschen Text ist deshalb **nicht**
  automatisch eine am englischen — beide Dateien wollen einzeln gepflegt
  werden, und die Beleg-Liste unten gilt für beide.
- **KI-Coach.** Nicht im Listing erwähnt: `aiAssistantConfig.runtimeUrl` ist
  leer, im ausgelieferten Build ist der Assistent also nicht nutzbar.
- **Grafiken.** Screenshots, Feature-Grafik und Icon pflegt weiterhin die
  Console — das Script veröffentlicht nur Text.
