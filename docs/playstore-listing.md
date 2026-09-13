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
> Gepflegt: alle neun Play-Locales, `de-DE` ist die Quelle. Die Limits prüft
> `pnpm nx test tools` — zu langer Text scheitert in CI, nicht erst beim
> Veröffentlichen.

Diese Datei bleibt als **Beleg-Sammlung**: Der Store-Text behauptet konkrete
Zahlen und Eigenschaften, und die veralten still, wenn sie niemand an den Code
bindet.

## Feature-Drift vermeiden

Wenn du Übungen (`EXERCISE_CATALOG`), Trainingspläne (`TRAINING_PLANS`),
Liegestütz-Varianten (`PUSHUP_TYPES`) oder die Locale-Liste in
`web/project.json` änderst, gehören die Zahlen im Store-Text mit angepasst.
Dasselbe gilt für Eigenschaften ohne Zahl: Der Text beschreibt inzwischen
auch Freunde, die Sichtbarkeitsstufen des Profils und die Skalierung der
Pläne auf den Maximaltest — wer daran etwas ändert, prüft die Belege unten.

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
- **Freunde-Board, Anfeuern per Push, gemeinsame Challenges** — `getFriendsLeaderboard`,
  `sendCheer` und `createChallenge` in `data-store/functions/src/`; das
  Beispiel „500 Liegestütze in 7 Tagen“ liegt innerhalb von
  `MIN_CHALLENGE_TARGET`/`MAX_CHALLENGE_TARGET` und `CHALLENGE_DURATIONS_DAYS`
  (`libs/stats/src/lib/models/challenge.models.ts`).
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
- **Fünf Pläne rechnen auf den Maximaltest um** — `baselineMax` in
  `training-plan.catalog.ts` (30-Tage-Challenge, Liegestütze ab 40, Daily 100,
  Full Body Strong, Core Foundations), angewandt von `scaleTrainingPlan()` in
  `training-plan-scaling.ts`. Ohne absolvierten Test bleibt der Plan, wie er
  veröffentlicht ist, und jeder Faktor ist auf 0,5–2× begrenzt
  (`MIN_PLAN_SCALE` / `MAX_PLAN_SCALE`) — das Listing darf also weder eine
  Anpassung ohne Test noch eine unbegrenzte versprechen. Nur gemessene
  Übungen skalieren.
- **Drei Sichtbarkeitsstufen pro Profil-Element** — `ProfileSectionVisibility`
  (`off` | `friends` | `public`) über die 13 Elemente in
  `PROFILE_SECTIONS`. Einen Hauptschalter gibt es nicht mehr:
  `isProfilePublic()` leitet sich aus den Stufen ab. Ein Listing-Satz wie
  „öffentliches Profil aktivieren" beschreibt die App nicht mehr.
- **Profil-Vorschau als Freund und als Fremder** — `ProfileAudienceView` in
  `web/src/app/public-profile/profile-audience.view.ts`.
- **Letzte 10 Workouts im Profil** — `readRecentEntries()` in
  `data-store/functions/src/functions-public-profile.ts` (`limit(10)`), nur
  wenn die Stufe des Elements den Betrachter einschließt.
- **Aktiver Plan im Profil, Plan als Link teilen** — `readActivePlan()` ebenda
  und `buildSharePlanPayload()` in
  `web/src/app/training-plans/plan-share.ts`.
- **Vier Zeiträume im Freundes-Board, kein Übungsfilter** —
  `FriendsBoardPeriod` (`daily` | `week` | `month` | `allTime`) in
  `web/src/app/friends/friends-api.service.ts`; die UI bietet genau diese
  vier als Chips in `friends-board.component.ts` und **keinen**
  Übungsfilter, obwohl die API einen `exerciseId` kennt — das Listing darf
  also keinen versprechen.
- **„Miss dich mit anderen oder bleib privat"** — `hideFromLeaderboard` in der
  User-Config; das ist der Schalter, den der Satz meint, nicht die
  Profil-Stufen.

## Was noch fehlt

- **Neun Sprachen, neun Dateien.** Alle Play-Locales des Mappings haben ein
  Listing. Die Store-Texte laufen bewusst **nicht** über die tägliche
  Übersetzungs-Routine (die arbeitet auf XLIFF und `content/`) — eine
  inhaltliche Änderung ist also neunfache Handarbeit, und was das kostet
  steht in
  [`docs/play-store-publishing.md`](play-store-publishing.md#was-die-neun-sprachen-kosten).
- **Kein Listing ist ein Übersetzungs-Klon.** Titel, Kurzbeschreibung und
  Einstieg sind pro Sprache eigenständig getextet, weil ASO je Markt auf
  andere Suchbegriffe zielt („push-up counter" und „workout tracker" im
  Englischen, „pompes", „flexiones", „flessioni", „armhevninger"). Eine
  Änderung am deutschen Text ist deshalb **nicht** automatisch eine an den
  anderen acht — die Beleg-Liste oben gilt aber für alle.
- **Das Vokabular kommt aus der App, nicht aus dem Bauch.** Plan-Titel und
  Kategorienamen in den Listings sind aus `web/src/locale/messages.<lang>.xlf`
  übernommen, damit Store-Eintrag und App dieselben Namen benutzen. Eine
  Ausnahme ist bewusst: `it-IT` wirbt mit „flessioni" (der gesuchte Begriff),
  behält in den Plan-Titeln aber „Piegamenti", weil die App sie so anzeigt —
  deshalb nennt der italienische Einstieg beide Wörter.
- **KI-Coach.** Nicht im Listing erwähnt: `aiAssistantConfig.runtimeUrl` ist
  leer, im ausgelieferten Build ist der Assistent also nicht nutzbar.
- **Grafiken.** Screenshots, Feature-Grafik und Icon pflegt weiterhin die
  Console — das Script veröffentlicht nur Text.
