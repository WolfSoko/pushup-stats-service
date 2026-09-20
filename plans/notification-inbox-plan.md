# Nachrichten-Inbox — Implementierungsplan

Eine persistente Nachrichtenzentrale für jeden angemeldeten Nutzer: Glocke in der
Toolbar, Eintrag im User-Menü, eigene Seite. Alle Ereignisse, die heute nur als
flüchtiger Web Push existieren oder gar nicht zugestellt werden, landen dort
garantiert.

## Warum

Heute ist Web Push der **einzige** Zustellweg für soziale Ereignisse, und er ist
unzuverlässig by design:

- `sendCheer` (`data-store/functions/src/functions-cheers.ts:84`) schickt Push
  synchron und **unbedingt** — ohne Presence-Prüfung, ohne Opt-out, ohne Quiet
  Hours. Die Reminder-Strecke prüft all das (`push/reminders.ts:35`), die
  Friend-Strecke nicht.
- Wer kein Push-Abo hat (Notification-Permission nie erteilt), bekommt **nichts**.
  `deliverPushToUser` steigt bei leerer Subscription-Liste still aus
  (`push/deliver-user.ts:46`).
- Der Live-Kanal `cheerPings/{uid}` wird bewusst nicht nachgespielt:
  `cheer-animation.store.ts:116` verwirft jeden Ping mit
  `Date.parse(ping.at) <= sessionStartAtMs`. Der Kommentar dort begründet das
  mit „der Push deckt das ab" — was genau dann nicht stimmt, wenn es keinen Push
  gibt.
- Die einzige dauerhafte Spur einer Anfeuerung ist die **anonyme Tageszahl**
  `🔥 N` auf dem Freunde-Board (`friends/cheers-read.ts:9`, gefiltert auf
  `day == today`). Kein Absender, und um Mitternacht (Berlin) weg.
- Badges werden serverseitig vergeben (`functions-achievements.ts:50`), lösen
  aber **überhaupt keine Benachrichtigung** aus.

Mit einer Inbox wird Push vom einzigen Weg zum optionalen Beschleuniger. Erst
dann darf `sendCheer` Einstellungen respektieren, ohne dass Information verloren
geht.

## Entscheidungen

| Frage            | Entscheidung                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Datenmodell      | Generische Collection `notifications/{uid}/inbox/{id}`, jede Quelle schreibt beim Auslösen hinein                                 |
| Push-Kopplung    | Inbox immer, Push nach Einstellung — inklusive Cheer, das heute alles ignoriert                                                   |
| Feature-Hinweise | **Kein** Fan-out, clientseitig aus der statischen `ANNOUNCEMENTS`-Liste gemischt                                                  |
| Launch           | Inbox und Abzeichen-Bereich werden **gemeinsam** angekündigt — ein `ANNOUNCEMENTS`-Eintrag, eine Landing-Sektion, ein Play-Absatz |

## Datenmodell

### Collection

```
notifications/{uid}/inbox/{notificationId}
```

Die Subcollection heißt `inbox`, **nicht** `items`: TTL-Policies werden pro
_collection group_ deklariert, nicht pro Pfad. Eine zweite Subcollection namens
`items` irgendwo im Schema würde stillschweigend dieselbe 30-Tage-TTL erben und
ihre Dokumente verlieren.

Subcollection pro Nutzer statt Top-Level mit `uid`-Feld: die Rules werden
trivial (`request.auth.uid == uid` aus dem Pfad), und es braucht keinen
zusammengesetzten Index für „meine ungelesenen, nach Datum".

### Dokument

```ts
// libs/stats/src/lib/models/notification.models.ts
export type NotificationType =
  | 'cheer'
  | 'friendRequest'
  | 'friendAccepted'
  | 'challenge'
  | 'challengeAccepted'
  | 'workoutShared'
  | 'achievement';
// 'goalReached' und 'motivation' kommen in Phase 7 dazu — ein Union-Mitglied,
// das niemand schreibt, wäre toter Code (CLAUDE.md).

export interface UserNotification {
  readonly type: NotificationType;
  readonly createdAt: string; // ISO, wie cheer.createdAt
  readonly readAt: string | null;
  readonly actorUid: string | null; // wer es ausgelöst hat
  readonly actorName: string | null; // denormalisiert, Snapshot zum Zeitpunkt
  readonly url: string; // Ziel ohne Locale-Präfix, z.B. '/freunde'
  readonly payload?: Record<string, string | number>;
}
```

`actorName` wird bewusst denormalisiert mitgeschrieben statt beim Lesen
nachgeschlagen: die Liste soll ohne N zusätzliche `userConfigs`-Reads
rendern, und `buildFriendPushPayload` (`friends/notifications.ts:76`) löst den
Namen ohnehin schon auf.

`url` ohne Locale-Präfix, weil der Client die aktuelle Locale kennt — der
Push-Payload macht es anders (`notifications.ts:112` baut `/${locale}/...`),
aber dort gibt es keinen Client, der das ergänzen könnte.

**Kein `title`/`body` im Dokument.** Texte werden clientseitig aus `type` +
`payload` per `$localize` gebaut. Sonst friert die Sprache zum Schreibzeitpunkt
ein und ein Sprachwechsel lässt die Inbox halb übersetzt zurück.

### Kategorien

`type` ist die Datenebene, **Kategorie die Darstellungsebene**. Nicht
gespeichert, sondern aus dem Typ abgeleitet (reine Funktion in
`notification.models.ts`):

| Kategorie     | Typen                                                                                | Darstellung                                                        |
| ------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `motivation`  | `cheer`, `goalReached`, `motivation`                                                 | Hervorgehobene Karte: großes Icon, warmer Akzent, Zitat-Typografie |
| `social`      | `friendRequest`, `friendAccepted`, `challenge`, `challengeAccepted`, `workoutShared` | Zeile mit Avatar des Absenders und Aktions-Button                  |
| `achievement` | `achievement`                                                                        | Badge-Vorschau, verlinkt in den Abzeichen-Bereich                  |
| `system`      | Feature-Hinweise (clientseitig gemischt)                                             | Dezente Zeile mit „Neu"-Marker                                     |

Der Punkt dahinter: eine Anfeuerung und ein erreichtes Tagesziel sind
dasselbe _Gefühl_ wie ein Motivationsspruch — sie gehören visuell
zusammen und nicht in eine graue Liste einsortiert. Eine Anfeuerung kann
im Motivations-Slot sogar den Spruch **ersetzen**: „Anna feuert dich an"
schlägt jedes generierte Zitat.

Daraus folgt eine Vereinfachung für `notification-text.ts`: statt einer
Funktion pro Typ eine pro Kategorie, die `payload` interpretiert.

### IDs und Dedupe

Deterministische IDs, wo Wiederholung Lärm wäre — dasselbe Muster wie
`cheerId()` (`cheer.models.ts:17`):

| Typ                                | ID                                             |
| ---------------------------------- | ---------------------------------------------- |
| `cheer`                            | `cheer__{actorUid}__{YYYY-MM-DD}` (Berlin-Tag) |
| `friendRequest` / `friendAccepted` | `{type}__{actorUid}`                           |
| `achievement`                      | `achievement__{achievementId}`                 |
| `goalReached`                      | `goalReached__{YYYY-MM-DD}`                    |
| übrige                             | Auto-ID                                        |

Bei den deterministischen Typen `set` statt `create`: eine zweite Anfeuerung am
selben Tag wird strukturell schon in `functions-cheers.ts:58` abgewiesen, aber
eine erneut gestellte Freundschaftsanfrage soll den alten Eintrag ersetzen, nicht
danebenlegen.

### Retention

`expiresAt: Timestamp` + TTL-Policy, 30 Tage. Eintrag in
`data-store/firestore.indexes.json` neben dem bestehenden `cheers`-TTL
(`firestore.indexes.json:118`), als `collectionGroup: "inbox"`. Ablauf ist laut
`docs/cloud-functions.md:32` bis zu 24 h ungenau — für eine Inbox irrelevant.

### Rules

```
match /notifications/{userId}/inbox/{itemId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow create, delete: if false;
  allow update: if request.auth != null
                && request.auth.uid == userId
                && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['readAt']);
}
```

Schreiben serverseitig (Admin SDK, wie `userAchievements`,
`firestore.rules:507`) — nur `readAt` darf der Besitzer selbst setzen. Das
spart eine Callable für „gelesen" und hält den Realtime-Listener als einzigen
Datenpfad. Die Feldbeschränkung folgt dem `diff().affectedKeys()`-Muster, das
`userConfigs` schon nutzt (`firestore.rules:98`).

## Backend

### Zentraler Schreib-Helper

Neu: `data-store/functions/src/notifications/write.ts`

```ts
export async function writeNotification(
  uid: string,
  id: string | null,
  notification: UserNotification
): Promise<void>;
```

Setzt `expiresAt` aus `NOTIFICATION_RETENTION_MS`, schreibt in die
Subcollection, loggt Fehler und **wirft nicht weiter** — eine kaputte Inbox darf
`sendCheer` nicht scheitern lassen. Dazu `notifications/logic.ts` mit den reinen
Teilen (ID-Bau, Retention-Berechnung), testbar ohne Firestore, wie
`friends/notifications.ts` es vormacht.

### Schreibstellen

Reihenfolge überall: **erst Inbox, dann Push.** Die Inbox ist die Garantie, Push
der Bonus.

| Datei                                 | Stelle                                             | Typ                               |
| ------------------------------------- | -------------------------------------------------- | --------------------------------- |
| `functions-cheers.ts:62`              | in den bestehenden `db.batch()` aufnehmen          | `cheer`                           |
| `functions-friends-notify.ts:38`      | vor `deliverPushToUser`                            | `friendRequest`, `friendAccepted` |
| `functions-challenges.ts:108`, `:171` | vor `deliverPushToUser`                            | `challenge`, `challengeAccepted`  |
| `functions-workouts.ts:76`            | vor `deliverPushToUser`                            | `workoutShared`                   |
| `functions-achievements.ts`           | bei `newlyEarned(...)` — **neue** Benachrichtigung | `achievement`                     |

Der Cheer-Fall ist besonders sauber: `functions-cheers.ts:62` committet bereits
atomar zwei Dokumente, das Inbox-Item wird das dritte im selben Batch. Damit ist
„Cheer existiert, Inbox-Eintrag fehlt" strukturell ausgeschlossen.

`functions-achievements.ts` schreibt heute in einer Transaktion. Der
Inbox-Write gehört **nach** den Commit, nicht hinein — ein Retry der Transaktion
würde sonst Duplikate erzeugen (die deterministische ID fängt das zwar ab, aber
ein Write pro Retry bleibt Verschwendung).

### Push-Gating

Neu in `UserConfig` (`libs/stats/src/lib/models/user-config.models.ts:275`,
neben `reminder`):

```ts
notificationPrefs?: Partial<Record<NotificationType, boolean>>;
```

Opt-out-Semantik wie `cheerAnimationEnabled` (`user-config.models.ts:255`):
`undefined` ⇒ an. Dazu eine reine Funktion in `@pu-stats/models`:

```ts
export function shouldPushNotification(
  config: Pick<UserConfig, 'notificationPrefs' | 'reminder'> | undefined,
  type: NotificationType,
  now: Date
): boolean;
```

Prüft `notificationPrefs[type] !== false` **und** wiederverwendet
`isInQuietHours(config.reminder?.quietHours, config.reminder?.timezone, now)`
aus `reminder-config.models.ts`. Quiet Hours gelten damit für alle Pushes, nicht
nur Reminder — genau das, was heute fehlt und ohne Inbox nicht ginge, weil eine
unterdrückte Anfeuerung sonst spurlos verschwände.

Eingesetzt an allen fünf Friend-Push-Stellen. `readPushRecipients`
(`push/deliver-user.ts`) liest die Configs bereits, der Prefs-Check kostet also
keinen zusätzlichen Read.

**Damit ändert sich Verhalten in Produktion:** `sendCheer` sendet nicht mehr
unbedingt. Der Kommentar bei `cheerAnimationEnabled`
(`user-config.models.ts:255`), der genau diese Unbedingtheit als Begründung
nennt, muss mit.

## Frontend

### Datenzugriff

`libs/data-access/src/lib/api/notifications-api.service.ts` — zustandslos, nach
dem Muster von `cheer-ping-api.service.ts:31`:

```ts
watch(uid: string): Observable<UserNotificationWithId[]>  // collectionData, orderBy createdAt desc, limit 50
markRead(uid: string, ids: string[]): Promise<void>       // writeBatch, nur readAt
```

Export in `libs/data-access/src/index.ts`.

### Store

`web/src/app/notifications/notification.store.ts` — root-provided
`signalStore`, `rxResource` mit `params: () => ({ userId: user.userIdSafe() })`,
exakt die Form von `cheer-animation.store.ts:48`.

- `items()` — Liste
- `unreadCount()` — `computed`, gedeckelt angezeigt („9+")
- `markRead(ids)` / `markAllRead()` — optimistisch, dann Batch-Write
- Browser-Guard über `isPlatformBrowser`, sonst startet SSR einen Listener

Feature-Hinweise werden **hier** eingemischt, nicht aus Firestore: die
statische `ANNOUNCEMENTS`-Liste aus `core/feature-announcement.service.ts:31`
gegen `ui.seenAnnouncements` gefiltert und als synthetische Items mit stabiler
ID vorangestellt. Ein Fan-out-Write pro Nutzer und Release wäre bei jedem neuen
Feature ein Write über die gesamte Nutzerbasis — für Information, die schon im
Client-Bundle steht.

### Komponenten

Jeweils klein halten (CLAUDE.md: ≤ 250 LOC prod):

- `notification-bell.component.ts` — Icon-Button plus Zähler-Badge. Vorlage für
  den Button: `ai/ai-assistant-nav-button.component.ts`; für das Badge:
  `friends/friend-request-badge.component.ts` (handgerolltes Span mit
  `var(--mat-sys-error)`, `MatBadge` ist im Repo nirgends im Einsatz).
- `notification-panel.component.ts` — Dropdown über CDK connected overlay, wie
  die Tagesziel-Pille in `app.html:55-114`. Letzte ~10 Einträge, „Alle
  anzeigen" ans Seitenende.
- `notification-item.component.ts` — wählt je Kategorie die Darstellung:
  `social` und `system` als schlichte Zeile, `motivation` als hervorgehobene
  Karte, `achievement` mit Badge-Vorschau.
- `notification-text.ts` — reine Funktion `type + payload → { icon, text }` mit
  `$localize`. Trennt Übersetzung von Darstellung und ist ohne TestBed testbar.
- `notifications-page.component.ts` — Vollansicht unter `/nachrichten`, lazy
  `loadComponent` in `app.routes.ts` mit `authGuard` und `seoTitle`.

### Einhängen

- Toolbar: `web/src/app/app.html` zwischen Zeile 129
  (`app-ai-assistant-nav-button`) und 140 (`pus-user-menu`), Import in das
  `imports`-Array bei `app.ts:79`.
- User-Menü: `libs/auth/src/lib/ui/user-menu/user-menu.component.html`, neuer
  `<button mat-menu-item>` über „Mein Profil" (`:28`). Die Einträge sind dort
  hartcodiert, also eine reine Template-Ergänzung plus Navigations-Methode in
  `.ts`.

  **Wichtig:** `libs/auth` darf nicht auf den Notification-Store zugreifen —
  das wäre eine Abhängigkeit von der Lib auf die App. Der Zähler kommt als
  `input<number>()` von `app.html` herein, so wie `avatarUrl` heute
  (`user-menu.component.ts:42`).

- Hauptnavigation: falls die Seite dort auftauchen soll, Eintrag in
  `core/nav/main-nav-items.ts` — nie nur in einem Menü (CLAUDE.md). Der
  `badge?: Type<unknown>`-Slot (`main-nav-items.ts:12`) nimmt die
  Badge-Komponente direkt auf.

### i18n

Deutsche Quelltexte mit `i18n="@@notifications.*"` bzw.
`` $localize`:@@notifications.x:…` ``. Für den Zähler die
`${count}:count:`-Platzhalterform, wie in
`friend-request-badge.component.ts:90`. Danach:

```bash
pnpm nx run web:extract-i18n && node tools/src/sync-xliff-locales.mjs
```

Die acht Nicht-DE-Locales **nicht** von Hand übersetzen — das erledigt die
tägliche Routine.

## Motivations-Slot auf dem Dashboard

Es gibt bereits einen Platz für motivierende Nachrichten: `<p
class="motivational-quote">` in `web/src/app/stats/shell/stats-dashboard.component.html:358`,
gespeist aus `dashboard.store.ts:272` (`store._motivation.todayQuote`, geladen
bei `:319`).

Dieser Slot wird zur **Anzeigefläche für die Kategorie `motivation`**. Statt
immer das generierte Tageszitat zu zeigen, wählt eine reine Funktion:

```ts
// web/src/app/stats/motivation-slot.ts
export function pickMotivationSlot(
  notifications: ReadonlyArray<UserNotificationWithId>,
  todayQuote: string | null,
  nowMs: number
): MotivationSlot;
```

Rangfolge — das Persönliche schlägt das Generierte:

1. frische ungelesene Anfeuerung („Anna feuert dich an 🔥")
2. heute erreichtes Ziel („Tagesziel geschafft — 120 von 100")
3. Tageszitat aus `MotivationStore` (heutiges Verhalten)

Damit bekommt eine Anfeuerung eine zweite, ruhigere Bühne neben dem Feuerwerk:
Wer die Animation verpasst hat, weil er offline war, sieht sie beim nächsten
Dashboard-Besuch als Text. Das ist der eigentliche Ersatz für den
nicht-nachgespielten `cheerPing`.

`dashboard.store.ts` ist bereits groß — die Auswahl gehört in die separate reine
Datei, nicht in den Store (CLAUDE.md: ≤ 250 LOC).

## Abzeichen-Bereich

**Heute gibt es keinen Ort, an dem man seine eigenen Abzeichen sieht.** Sie
erscheinen nur

- im Einmal-Dialog direkt nach dem Verdienen
  (`achievements/achievement-celebration.service.ts`), und
- auf dem **öffentlichen** Profil `/u/:uid`
  (`public-profile/achievement-badge.ts`).

Der eigene Bestand, die noch offenen Abzeichen und der Fortschritt zum nächsten
sind nirgends sichtbar. Das ist die größere Lücke von beiden — ein Abzeichen,
das man nicht wiederfindet, motiviert genau einmal.

### Seite

Neue Route `/abzeichen`, lazy, `authGuard`, Eintrag in
`core/nav/main-nav-items.ts` (damit Sidenav und Arc-Nav ihn gemeinsam bekommen).
Ziel jedes `achievement`-Inbox-Eintrags.

### Datenlage — alles schon vorhanden

Kein neuer Backend-Code nötig:

- `userAchievements/{uid}` ist besitzerlesbar (`firestore.rules:507`) und
  enthält neben `earned` bereits `planDayTotal`, `currentPlanId`,
  `currentPlanDays`, `completedPlanIds` (`functions-achievements.ts:readProgress`).
  Damit ist der **Fortschritt zum nächsten Meilenstein direkt ableitbar**.
- Der Katalog ist reine Daten: `PLAN_DAY_ACHIEVEMENTS`, `INVITE_ACHIEVEMENTS`
  und die `plan-completed`-Definitionen in `achievement.models.ts`. Die
  **offenen** Abzeichen sind also einfach Katalog minus `earned`.
- `libs/data-access/src/lib/api/user-achievements-api.service.ts` liest das
  Dokument bereits.

### Darstellung

Drei Gruppen nach `AchievementKind` — Plantage, abgeschlossene Pläne,
Einladungen:

- **Verdient:** volle Farbe, Material-Icon aus `definition.icon`
  (`workspace_premium`, `military_tech`, `emoji_events`, `groups`,
  `person_add`), Datum aus `EarnedAchievement.awardedAt`.
- **Offen:** dasselbe Icon entsättigt/umrandet statt versteckt. Ein sichtbares
  leeres Feld zieht stärker als ein unbekanntes.
- **Als Nächstes:** das nächste erreichbare Abzeichen hervorgehoben, mit
  Fortschritt (`planDayTotal` gegen `threshold`) als `mat-progress-bar` und
  Resttext („noch 4 Plantage bis Silber").
- Kopfzeile mit Gesamtstand („7 von 14").

Animationen als CSS, `@angular/animations` ist kein Dependency (CLAUDE.md).

### Bessere Labels als auf dem öffentlichen Profil

`resolveAchievementBadge` hält Labels bewusst generisch („Trainingsplan
abgeschlossen" statt des Plannamens), weil `TRAINING_PLANS` über 2000 Zeilen in
die öffentliche Route ziehen würde, die anonyme Besucher laden — der Grund steht
im Dateikommentar.

**Für die eigene Seite gilt das nicht:** sie ist lazy und hinter `authGuard`,
und wer eingeloggt ist, hat den Plan-Katalog für `/training-plans` ohnehin
geladen. Also hier echte Plannamen („Ganzkörper 6 Wochen abgeschlossen").

Konsequenz für den Code: eine zweite Label-Auflösung in
`web/src/app/achievements/achievement-label.ts` statt einer Erweiterung von
`public-profile/achievement-badge.ts`. Die Trennung ist der Punkt, nicht
Duplikation — beide dürfen sich unterschiedlich entwickeln, und der Kommentar
dort erklärt, warum.

### Wiederverwendung

Die Badge-Kachel wird eine eigene Komponente
(`achievements/achievement-tile.component.ts`) und ersetzt auf Sicht auch die
Darstellung im Feier-Dialog (`achievement-dialog.component.ts`) und die
Vorschau im Inbox-Eintrag. Drei Orte, eine Kachel.

## Tests

| Ebene                     | Was                                                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@pu-stats/models` (Jest) | ID-Bau, Retention, `shouldPushNotification` inkl. Quiet-Hours-Grenzfällen                                                                                                                                                                        |
| Cloud Functions (Jest)    | pro Schreibstelle: Inbox-Item entsteht; Push unterbleibt bei `prefs[type] === false`; Inbox-Item entsteht **trotzdem**; `writeNotification`-Fehler lässt `sendCheer` grün                                                                        |
| Rules                     | `readAt`-Update erlaubt, jedes andere Feld abgelehnt, fremde `uid` abgelehnt, `create` vom Client abgelehnt                                                                                                                                      |
| Web (Vitest)              | Store: Listener-Lebenszyklus, `unreadCount`, optimistisches Markieren mit Rollback, Announcement-Merge; `notification-text` und `pickMotivationSlot` als reine Funktionen (inkl. Rangfolge und leerem Zustand); Bell mit `PLATFORM_ID: 'server'` |
| Web (Vitest), Abzeichen   | Katalog-minus-`earned`-Ableitung, „nächstes Abzeichen" an der Meilenstein-Grenze (`planDayTotal` exakt auf `threshold`), unbekannte ID aus altem Katalog wird übersprungen                                                                       |
| E2E (`web-e2e-emulator`)  | Freundschaftsanfrage stellen → Empfänger sieht Badge und Eintrag nach Reload, ohne Push-Permission                                                                                                                                               |

Der letzte Punkt ist der eigentliche Regressionstest für das Problem: der
Empfänger hat kein Push-Abo und sieht es trotzdem.

## Feature-Launch (CLAUDE.md)

Inbox und Abzeichen-Bereich werden **als ein Feature angekündigt**, nicht als
zwei. Aus Nutzersicht sind sie dasselbe Versprechen — „nichts geht mehr
verloren, und du siehst, was du erreicht hast" — und zwei Walkthrough-Dialoge
kurz nacheinander wären eine Zumutung.

Die Ankündigung gehört in den PR, der die letzte der beiden Hälften sichtbar
macht (Phase 3 oder 4, je nachdem, welche zuerst fertig ist), nicht in beide.

- **Ein** `ANNOUNCEMENTS`-Eintrag in `core/feature-announcement.service.ts:31`
  mit frischer ID, Stepped-Dialog mit zwei Schritten (Nachrichten, Abzeichen)
  und einem Button pro Ziel. Nette Rekursion: der erste Inbox-Eintrag, den ein
  Nutzer sieht, ist die Ankündigung der Inbox.
- **Eine** Landing-Page-Sektion unter `web/src/app/marketing/components/`,
  eingebettet in `landing-page.component.html`, als „Neu" markiert — beide
  Hälften unter einer Überschrift.
- **Ein** Absatz je `store/play/<locale>/full-description.txt`, alle neun
  Locales. `pnpm nx test tools` erzwingt das 4000-Zeichen-Limit, also bei Bedarf
  an anderer Stelle kürzen.

## Stand (2026-09-20)

Phasen 1–6 sind auf `main` und damit in Produktion:

| Commit     | Inhalt                                       |
| ---------- | -------------------------------------------- |
| `072df405` | Collection, Rules, TTL, sechs Schreibstellen |
| `cb1069cf` | Abzeichen-Bereich `/abzeichen`               |
| `69d5476f` | Glocke, Panel, `/nachrichten`, User-Menü     |
| `1aeb1e26` | Gemeinsame Ankündigung, Landing-Sektion      |
| `3c9c756a` | Motivations-Slot auf dem Dashboard           |
| `32277884` | `notificationPrefs` und Push-Gating          |

Offen: Phase 7 (`goalReached`, `motivation`) und die Play-Store-Texte.

## Phasen

1. **Fundament** — Modelle in `@pu-stats/models`, `notifications/write.ts`,
   Rules, TTL-Index. Keine sichtbare Änderung, vollständig getestet.
2. **Schreibstellen** — die fünf Friend-Pfade plus Achievements. Ab hier füllt
   sich die Collection, noch ohne UI.
3. **UI** — API-Service, Store, Glocke, Panel, Seite, User-Menü, i18n. Ab hier
   sichtbar.
4. **Abzeichen-Bereich** — Seite `/abzeichen`, Kachel-Komponente,
   Label-Auflösung, Nav-Eintrag. Hängt nur an Phase 1 (dem `achievement`-Typ als
   Sprungziel), sonst an nichts — **kann parallel zu 2 und 3 laufen** und ist
   für sich allein schon ein sichtbarer Gewinn.
5. **Motivations-Slot** — `pickMotivationSlot`, Einbau im Dashboard. Braucht
   Phase 3 (den Store).
6. **Gating** — `notificationPrefs`, `shouldPushNotification`, Einstellungs-UI
   unter `web/src/app/reminders/shell/`. Erst jetzt darf Push unterdrückt
   werden, weil die Inbox vorher auffängt.
7. **Neue Quellen** — `goalReached` (braucht einen Trigger auf `userStats` oder
   `exerciseEntries`; heute ist `goal-reached-notification.service.ts` rein
   clientseitig) und `motivation` (braucht einen Auslöser, `generateMotivationQuotes`
   ist ein On-Demand-Callable).

Phasen 1–3 sind je ein eigener Trunk-Push, 4–7 je ein Issue. Phase 4 ist der
naheliegende Einstieg, wenn früh etwas Vorzeigbares gebraucht wird: reine
Frontend-Arbeit auf Daten, die schon in Firestore liegen.

## Reihenfolge-Zwang: Abzeichen vor Inbox-UI

Der `achievement`-Eintrag speichert `url: '/abzeichen'`. Diese Route entsteht
erst in Phase 4. Solange keine UI die Einträge rendert (vor Phase 3), ist das
folgenlos — **Phase 4 muss aber vor Phase 3 in Produktion sein**, sonst führt
der erste Klick auf einen Badge-Eintrag ins Leere.

Das war in der ursprünglichen Phasenliste nicht sichtbar und ist beim Bauen
aufgefallen.

## Offene Punkte

- **Gehören Reminder in die Inbox?** Ein Posteingang voller „Zeit für
  Liegestütze" ist Lärm. Vorschlag: nein — Reminder bleiben rein push-basiert,
  weil sie zeitgebunden sind und ein nachgelesener Reminder wertlos ist. Der Typ
  fehlt deshalb in der Liste oben.
- **`cheerPings` retten oder abschaffen?** Die Feuerwerk-Animation könnte
  stattdessen am Notification-Listener hängen (frisches ungelesenes
  `cheer`-Item seit Sessionstart). Das spart eine Collection und eine
  Rules-Sektion, berührt aber die Session-Start-Logik in
  `cheer-animation.store.ts:116`. Nach Phase 5 wird das deutlich attraktiver:
  der Motivations-Slot fängt die verpasste Anfeuerung dann ohnehin auf, die
  Animation muss nichts mehr garantieren. Eigener Aufräum-PR, nicht vermischen.
- **Abzeichen auch im eigenen Profil?** Unter `/settings/profil` liegt heute
  die Selbstansicht. Ein Auszug der letzten drei Abzeichen mit Link auf
  `/abzeichen` wäre naheliegend — aber erst, wenn die Seite selbst steht.
- **Zähler-Obergrenze.** `limit(50)` im Listener bedeutet, dass
  `unreadCount()` bei mehr als 50 Ungelesenen falsch wird. Für „9+" in der
  Anzeige irrelevant — falls je eine exakte Zahl gebraucht wird, ist ein
  Zählerfeld auf `notifications/{uid}` die Antwort, kein größeres Limit.
