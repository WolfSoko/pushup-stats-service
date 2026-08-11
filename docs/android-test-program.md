# Android-App: Tester für den geschlossenen Test rekrutieren

Wie ausgewählte Web-Nutzer:innen für den geschlossenen Android-App-Test
(Play Console) gewonnen werden — vom automatischen Kandidaten-Scan bis zur
Installations-Benachrichtigung.

## Der Status-Automat

`UserConfig.androidTest` (`libs/stats/src/lib/models/user-config.models.ts`)
trägt einen Status pro Nutzer:in. Wie `leaderboardExcluded` ist das Feld
server-only — Schreibzugriff läuft ausschließlich über die vier Callables in
`data-store/functions/src/functions-android-test.ts`, Client-Writes sind in
`data-store/firestore.rules` blockiert.

```
candidate  →  confirmed / declined  →  optedIn  →  notified
(Scan)         (Admin)                 (Nutzer)    (Admin, nach Play-Console-Schritt)
```

| Übergang                             | Wer                                        | Callable                            |
| ------------------------------------ | ------------------------------------------ | ----------------------------------- |
| → `candidate`                        | Scan (Admin-Button)                        | `adminComputeAndroidTestCandidates` |
| `candidate` → `confirmed`/`declined` | Admin                                      | `adminConfirmAndroidTestCandidate`  |
| `confirmed` → `optedIn`              | Nutzer:in (Invite-Popup)                   | `optInAndroidTest`                  |
| `optedIn` → `notified`               | Admin, nach manuellem Play-Console-Schritt | `adminMarkAndroidTesterAdded`       |

Die Admin-Oberfläche dafür ist `/admin/android-test`
(`web/src/app/admin/android-test-page.component.ts`).

## Kandidaten-Heuristik

`isAndroidTestCandidate()` (`data-store/functions/src/android-test/logic.ts`)
markiert Nutzer:innen mit mindestens `ANDROID_TEST_MIN_ENTRIES` (15)
Einträgen und einem letzten Eintrag innerhalb von
`ANDROID_TEST_ACTIVE_WITHIN_DAYS` (30) Tagen als Kandidat. Der Scan ist
idempotent — bereits durchlaufene Docs (jeder Status außer "kein Feld")
werden nie erneut überschrieben. Kein Cron: das ist ein einmaliger
Recruiting-Lauf, kein wiederkehrender Job, daher wird per Admin-Button
manuell ausgelöst (gleiches Muster wie
`adminBulkDeleteInactiveAnonymous`).

## Das Invite-Popup

`AndroidTestInviteOrchestrationService`
(`web/src/app/core/android-test-invite-orchestration.service.ts`) öffnet
`AndroidTestInviteDialogComponent` einmal pro Session, wenn:

- `androidTest.status === 'confirmed'`,
- das Gerät Android ist (`isAndroidDevice(navigator.userAgent)`),
- die Seite **nicht** schon innerhalb der installierten TWA läuft
  (`isRunningInTwa(document.referrer)` — Bubblewrap setzt
  `document.referrer` auf `android-app://<package>`),
- und die letzte "Nicht jetzt"-Ablehnung
  (`ui.androidTestPopupDismissedUntil`) nicht mehr aktiv ist (14 Tage
  Snooze).

## Der manuelle Schritt: Tester in der Play Console eintragen

**Die Google Play Developer API kann Closed-Test-Tester nur über Google
Groups verwalten, nicht über einzelne E-Mail-Adressen** — bestätigt gegen
die offizielle [`edits.testers`-Ressource](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.testers).
Individuelle E-Mail-Listen lassen sich ausschließlich über die Play-Console-UI
pflegen. Deshalb bleibt dieser Schritt bewusst Handarbeit:

1. Admin-Seite `/admin/android-test` öffnen, Abschnitt "Angemeldet".
2. "Alle E-Mails kopieren" — kopiert die opted-in E-Mails
   zeilenweise in die Zwischenablage.
3. In der [Play Console](https://play.google.com/console/) → App →
   **Testen und veröffentlichen → Tests → Geschlossener Test** → die
   E-Mail-Liste einfügen (oder als CSV hochladen).
4. Zurück in `/admin/android-test`: pro Nutzer:in "Als Tester hinzugefügt
   (benachrichtigen)" klicken. Das setzt `status: 'notified'` **und**
   verschickt in einem Schritt die Web-Push-Benachrichtigung mit
   Install-Link (`adminMarkAndroidTesterAdded`, wiederverwendet denselben
   `webpush.sendNotification`-Call wie `dispatchPushReminders`). Hat die
   Person kein aktives Push-Abo, bleibt der Status trotzdem auf
   `notified`, aber die UI zeigt "Kein aktives Push-Abo — bitte manuell
   informieren".

## Install-Link

`ANDROID_TEST_OPT_IN_URL` (`android-test/logic.ts`) ist aktuell hartcodiert
auf `https://play.google.com/apps/testing/com.pushupstats.app` — das
Standard-Opt-in-Link-Schema für den Package-Namen
(`mobile/android-twa/twa-manifest.json` → `applicationId`). **Sobald der
geschlossene Test tatsächlich veröffentlicht ist, den Link gegen den von
der Play Console im Tab "Tester" des Tracks angezeigten Link prüfen** —
Play zeigt dort manchmal einen projekt-spezifischen Link statt des
generischen Musters.
