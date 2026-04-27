# Architektur-Verbesserungsplan: Pushup Stats Service

## Status-Übersicht

| Phase | Beschreibung                                    | Status           |
| ----- | ----------------------------------------------- | ---------------- |
| 1     | Models aufteilen                                | Done             |
| 2     | Auth von Data-Access entkoppeln (PostAuthHooks) | Done             |
| 3     | App Root entschlacken                           | Done             |
| 4     | Reminder Draft-State vereinfachen               | Done             |
| 5     | Motivation von Auth entkoppeln                  | Done             |
| 6.1   | QuickAddBridge auf Signals migrieren            | Done             |
| 6.2   | State-Pattern-Konventionen dokumentieren        | Done (CLAUDE.md) |
| 7     | Nx Module Boundary Rules konfigurieren          | Done             |
| 8     | Reminders von Auth entkoppeln                   | Done             |
| 9     | App Root: handleQuickAdd extrahieren            | Done             |
| 10    | Barrel-Exports aufräumen                        | Done             |
| 11    | Testing-Lib Mocks auf Ports umstellen           | Done             |

---

## Phase 8: Reminders von Auth entkoppeln (Mittel)

### Problem

`ReminderService` importiert `AuthStore` direkt aus `@pu-auth/auth` (Zeile 5):

```typescript
import { AuthStore } from '@pu-auth/auth';
```

Wird nur verwendet um `user().displayName` für Motivation-Quotes zu bekommen (Zeile 119-120).

### Lösung

- `getNextQuote()` bekommt `displayName` als Parameter von außen
- `ReminderOrchestrationService` (web/app-level) übergibt den displayName beim Start
- Alternativ: `displayName` als Signal im ReminderStore speichern (beim `loadConfig`)

### Dateien

- `libs/reminders/src/lib/reminder.service.ts` — AuthStore Import entfernen
- `web/src/app/core/reminder-orchestration.service.ts` — displayName durchreichen
- `eslint.config.mjs` — `scope:reminders` constraint verschärfen (auth entfernen)

### Akzeptanzkriterien

- `@pu-reminders/reminders` hat 0 Imports von `@pu-auth/auth`
- Lint-Rule `scope:reminders` erlaubt nur `scope:models`, `scope:data-access`, `scope:motivation`
- Alle Reminder-Tests bestehen

---

## Phase 9: App Root handleQuickAdd extrahieren (Klein)

### Problem

`handleQuickAdd()` in `app.ts` (Zeilen 168-198) enthält:

- Timestamp-Formatierung
- API-Call via `statsApi.createPushup()`
- SnackBar-Feedback
- Resource-Reload via `appData.reloadAfterMutation()`

Das ist Business-Logik die nicht in die Root-Komponente gehört.

### Lösung

- `QuickAddOrchestrationService` erstellen in `web/src/app/core/`
- `handleQuickAdd(reps)` und `handleOpenDialog()` dorthin verschieben
- App Root ruft nur noch `quickAddOrchestration.add(reps)` auf

### Dateien

- `web/src/app/core/quick-add-orchestration.service.ts` — neu
- `web/src/app/app.ts` — delegieren statt implementieren

### Akzeptanzkriterien

- App Root hat keine `statsApi.createPushup()` Calls mehr
- QuickAdd-Logik ist unit-testbar
- Build + bestehende Tests bestehen

---

## Phase 10: Barrel-Exports aufräumen (Klein)

### Problem

Einige Barrel-Files exportieren mehr als nötig. Interne Implementierungsdetails
wie `_authService` im AuthStore sind über die Public API sichtbar.

### Lösung

- Alle `src/index.ts` Barrel-Files durchgehen
- Nur bewusst öffentliche API exportieren
- Interne Services/Stores die nur modulintern genutzt werden ausschließen

### Zu prüfende Dateien

- `libs/auth/src/index.ts` — exportiert 17 Symbole, evtl. zu viel
- `libs/data-access/src/index.ts` — `demo-user.token` nur für SSR
- `libs/reminders/src/index.ts` — `isInQuietHours` utility nötig?

### Akzeptanzkriterien

- Kein Consumer außerhalb des Moduls nutzt interne APIs
- Build + Tests bestehen nach Reduktion

---

## Phase 11: Testing-Lib Mocks auf Ports umstellen (Klein)

### Problem

`libs/testing/src/lib/data-access-mocks.ts` erstellt Mocks direkt für
`UserConfigApiService`, `PushupFirestoreService` etc. Jetzt wo Auth über
Ports entkoppelt ist, sollten Auth-Tests die Port-Interfaces mocken.

### Lösung

- `makeUserProfilePortMock()` Factory in Testing-Lib hinzufügen
- `makePostAuthHookMock()` Factory hinzufügen
- Bestehende Mocks beibehalten (werden von data-access Tests noch gebraucht)

### Dateien

- `libs/testing/src/lib/auth-mocks.ts` — Port-Mocks hinzufügen
- `libs/testing/src/index.ts` — neue Exports

### Akzeptanzkriterien

- Auth-Tests können `@pu-stats/testing` Port-Mocks nutzen statt inline Mocks
- Bestehende data-access Mocks bleiben unverändert

---

## Dependency Graph: Aktuell vs. Ziel

```
AKTUELL (nach Phase 1-7):                 ZIEL (nach Phase 8-11):

models ←── data-access                    models ←── data-access
  ↑            ↑                            ↑
  ├── auth (isoliert!)                      ├── auth (isoliert!)
  ├── motivation (isoliert!)                ├── motivation (isoliert!)
  ├── reminders ─┬─ data-access             ├── reminders ── data-access + motivation
  │              ├─ auth  ← NOCH DA         │    (auth entfernt!)
  │              └─ motivation              │
  └── quick-add                             └── quick-add

  reminders → auth: NOCH GEKOPPELT         reminders → auth: ENTKOPPELT
```

---

## Priorisierung

| Phase                       | Aufwand      | Impact | Empfehlung   |
| --------------------------- | ------------ | ------ | ------------ |
| **8: Reminders entkoppeln** | Klein-Mittel | Hoch   | Als nächstes |
| **9: QuickAdd extrahieren** | Klein        | Mittel | Danach       |
| **10: Barrel-Exports**      | Klein        | Mittel | Quick Win    |
| **11: Testing-Lib Ports**   | Klein        | Gering | Optional     |
