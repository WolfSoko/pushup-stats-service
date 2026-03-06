# PUS Execution Checklist (mit DoD)

Ziel: Themen konsequent abarbeiten, mit klaren Definition-of-Done (DoD) und Gegenprüfung am Ende jedes Blocks.

## Zielarchitektur (immer mitdenken)

- Angular modern/standalone-first
- Signals-first
- NgRx Signal Store als State-Architektur
- Dünne Components, Orchestrierung im Store
- DRY in Produktiv- und Testcode
- E2E featurebasiert, parallelisierbar

---

## Arbeitsmodus (pro Aufgabe)

- [ ] Scope klar (Issue verlinkt)
- [ ] Lösung passt zur Zielarchitektur
- [ ] Tests zuerst/parallel ergänzt (keine ungetesteten Refactors)
- [ ] i18n + UX + a11y kurz mitgeprüft
- [ ] Commit klein, reviewbar, eindeutig
- [ ] DoD-Check durchgeführt und dokumentiert

---

## Aktuelle Themen

## 1) Settings UX/Privacy aufräumen (Issue #101)

### ToDos

- [ ] Technische IDs im Settings-UI ent-emphasieren/entfernen
- [ ] Fokus auf Anzeigename/Username
- [ ] Hinweistext ergänzen: Name kann in Bestenliste erscheinen
- [ ] Opt-out für Leaderboard einbauen

### DoD

- [ ] Keine technische ID mehr als Primärinhalt sichtbar
- [ ] Username-Flow klar und verständlich
- [ ] Opt-out wirkt funktional (UI + Persistenz + Verhalten)
- [ ] Unit-/Integration-Tests grün

---

## 2) Tagesziel prominenter (Toolbar)

### ToDos

- [ ] Tagesziel in Top-Toolbar sichtbar machen
- [ ] Optional Fortschritt heute (`heute/goal`) ergänzen
- [ ] Mobile Darstellung prüfen

### DoD

- [ ] Tagesziel ist in Toolbar sichtbar (Desktop + Mobile)
- [ ] Darstellung bricht Layout nicht
- [ ] Tests ergänzt (mind. Rendering + Grundverhalten)

---

## 3) Danger Zone: Delete Account => Anonymisierung

### ToDos

- [ ] Danger Zone UI in Settings
- [ ] Confirm-Dialog + irreversible copy
- [ ] Backend/Service-Flow: Anonymisierung statt Löschen
- [ ] Daten bleiben für Statistik erhalten

### DoD

- [ ] Kein Hard-Delete von Trainingsdaten
- [ ] Userbezug ist anonymisiert
- [ ] Prozess ist reproduzierbar getestet
- [ ] Fehlerpfade sauber behandelt

---

## 4) SEO Focus

### ToDos

- [ ] Meta title/description/OG/Twitter prüfen + ergänzen
- [ ] Canonical + hreflang für DE/EN
- [ ] robots/sitemap Strategie
- [ ] SSR/Prerender relevante Seiten prüfen

### DoD

- [ ] SEO-Basics vollständig gesetzt
- [ ] Sprach-/Canonical-Links konsistent
- [ ] Tech-Check (view-source / fetch) bestanden

---

## 5) Analytics Einbindung

### ToDos

- [ ] Provider festlegen
- [ ] DSGVO/Consent-Strategie
- [ ] Event-Taxonomie definieren
- [ ] Instrumentierung in App

### DoD

- [ ] Events feuern reproduzierbar
- [ ] Consent-Regeln eingehalten
- [ ] QA-Checklist abgearbeitet

---

## 6) Refactor-Leitplanken (Epic #94, #95-#100)

### ToDos

- [ ] Architektur-ADR (#95)
- [ ] Dashboard Store Migration (#96)
- [ ] Entries + Settings Store Migration (#97)
- [ ] DRY Test Harness (#98)
- [ ] E2E Split für Parallelisierung (#99)
- [ ] CI/DX Guardrails (#100)

### DoD

- [ ] Pro Ticket eigener PR-Slice
- [ ] Store-first Architektur sichtbar umgesetzt
- [ ] Duplication in Tests reduziert
- [ ] E2E parallel stabil

---

## Abschluss-Gegenprüfung (pro Arbeitstag)

- [ ] Alle angefassten Punkte gegen DoD geprüft
- [ ] Offene Punkte in Issues dokumentiert
- [ ] Board-Status synchronisiert
- [ ] Nächste 1-2 Schritte klar priorisiert
