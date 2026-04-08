# feat: KI-gestützte Analyse des Trainingsverhaltens, Fortschritts und personalisierte Empfehlungen

**Labels:** `enhancement`, `ai`, `cloud-functions`, `frontend`

## Beschreibung

Als User möchte ich eine **KI-generierte Analyse meines Trainings** sehen, die mir auf einen Blick zeigt:

1. **Trainingsverhalten** — Wie trainiere ich? (Häufigkeit, Tageszeiten, Regelmäßigkeit, Muster)
2. **Fortschritt** — Wie hat sich mein Training entwickelt? (Trends, Steigerungen, Plateaus)
3. **Empfehlungen** — Konkrete, personalisierte Schlussfolgerungen: Wie kann ich mein Training steigern, durchhalten oder wieder aufnehmen?

## Motivation

Die App zeigt bereits Rohstatistiken (Heatmap, Wochen-/Monatstrends, Streaks, Best Day). Aber die **Interpretation** dieser Daten bleibt dem User überlassen. Eine KI-Analyse verwandelt Zahlen in verständliche Einsichten und motivierende, handlungsorientierte Empfehlungen.

## Vorhandene Infrastruktur

| Baustein | Status | Details |
|---|---|---|
| **Gemini-Integration** | vorhanden | `@google/generative-ai`, Gemini 2.0 Flash Lite für Motivations-Zitate |
| **UserStats (precomputed)** | vorhanden | `total`, `totalEntries`, `totalDays`, `currentStreak`, `bestDay`, `bestSingleEntry`, `heatmapData`, `dailyReps`, `weeklyReps`, `monthlyReps`, Sets-Statistiken |
| **AnalysisStore** | vorhanden | `weekTrend`, `monthTrend`, `typeBreakdown`, `setsDistribution`, `heatmapData` |
| **UserConfig (Goals)** | vorhanden | `dailyGoal`, `weeklyGoal`, `monthlyGoal` |
| **Motivation-Modul** | vorhanden | Caching-Pattern (Firestore + localStorage), Fallback-Logik |
| **i18n** | vorhanden | DE (Source) + EN (Translation), XLIFF 2.0 |

## Anforderungen

### 1. Cloud Function: `generateTrainingAnalysis`

Neue Callable Cloud Function, die Gemini mit dem Trainingskontext des Users aufruft.

**Input-Daten für den Prompt:**
- `UserStats`: Gesamtzahlen, Streaks, Best Day, Heatmap, Sets-Statistiken
- Wochen-/Monats-Trends (letzte 4-8 Wochen aggregiert)
- Ziel-Konfiguration (`dailyGoal`, `weeklyGoal`, `monthlyGoal`) + Zielerreichung
- Letzte Aktivität (`lastEntryDate`) — für Inaktivitäts-Erkennung
- Sprache (`de` / `en`)

**Output-Struktur (JSON):**

```typescript
interface TrainingAnalysis {
  behavior: {
    summary: string;           // z.B. "Du trainierst hauptsächlich abends zwischen 20-22 Uhr..."
    patterns: string[];        // Erkannte Muster als Bullet-Points
    consistency: 'high' | 'medium' | 'low';
  };
  progress: {
    summary: string;           // z.B. "Dein Wochenvolumen ist in den letzten 4 Wochen um 15% gestiegen..."
    trend: 'improving' | 'stable' | 'declining' | 'returning';
    highlights: string[];      // Besondere Erfolge
  };
  recommendation: {
    summary: string;           // Hauptempfehlung
    actions: string[];         // 2-3 konkrete nächste Schritte
    motivation: string;        // Motivierender Abschluss
  };
  generatedAt: string;         // ISO timestamp
}
```

**Szenarien-Awareness im Prompt:**

| Szenario | Prompt-Fokus |
|---|---|
| Aktiver User, steigernd | Steigerungstipps (Intensität, Variation, neue Ziele) |
| Aktiver User, Plateau | Plateau-Durchbruch-Strategien |
| Gebrochener Streak / abnehmend | Ermutigung, realistischere Ziele |
| Inaktiv (> 3 Tage kein Eintrag) | Wiedereinstiegs-Motivation, niedrigschwellige Ziele |

**Caching:** Analog zu `generateMotivationQuotes` — Firestore-Cache mit 24h TTL pro User/Sprache. Kein erneuter Gemini-Call bei erneutem Laden am selben Tag.

**Fallback:** Statische Analyse-Templates basierend auf den Rohdaten, falls Gemini nicht verfügbar.

### 2. Frontend: Analyse-Karte auf der Analysis-Seite

**Option A: Karte auf der Analysis-Seite (bevorzugt)**
- Neue `TrainingAnalysisCard`-Komponente auf der bestehenden Analysis-Page
- Drei aufklappbare Sektionen: Verhalten | Fortschritt | Empfehlung
- Material-Icons für Konsistenz/Trend-Indikatoren
- Lazy-Load: Analyse wird erst bei Scroll/Klick geladen

**Option B: Eigene Unterseite `/analysis/ai`**
- Vollständige Analyse-Ansicht mit mehr Platz
- Link von der Analysis-Page und vom Dashboard

**UI-Elemente:**
- `mat-expansion-panel` für die drei Sektionen
- `mat-chip` für Konsistenz-Level und Trend-Richtung
- `mat-icon` passend zum Trend (`trending_up`, `trending_flat`, `trending_down`, `restart_alt`)
- Aktions-Items als `mat-list` mit Checkboxen (nicht persistent, rein visuell)
- Refresh-Button zum manuellen Neu-Generieren
- Ladeindikator (Skeleton oder Spinner) während Gemini generiert

### 3. Data Access

- Neuer `TrainingAnalysisApiService` in `@pu-stats/data-access`
- Methoden: `getAnalysis(userId): Observable<TrainingAnalysis | null>`, `generateAnalysis(): Observable<TrainingAnalysis>`
- Caching-Layer analog zu `MotivationQuoteService`

### 4. State Management

- `TrainingAnalysisStore` (signalStore, feature-level DI in Analysis-Page)
- State: `analysis`, `loading`, `error`, `lastGenerated`
- Methods: `load()`, `refresh()` (force regenerate)

## Architektur-Überlegungen

- **Modul-Grenzen:** Cloud Function bleibt in `cloud-functions`, liest `userStats/{userId}` + `pushups`-Collection. Kein neues Lib nötig — Service in `data-access`, Store in `web/app/stats/`.
- **Gemini-Prompt:** Strukturierter System-Prompt mit JSON-Output-Schema. User-Daten als Context, nicht als Prompt-Injection-Vektor (sanitize displayName etc.).
- **Kosten:** 24h-Cache pro User minimiert Gemini-Calls. Bei 100 DAU = max 100 Calls/Tag.
- **Privacy:** Keine personenbezogenen Daten an Gemini außer aggregierten Stats. Kein `displayName` im Prompt (nur für Anrede, optional).
- **i18n:** Gemini generiert direkt in der Zielsprache (`de`/`en`). Statische UI-Labels via XLIFF.

## Akzeptanzkriterien

- [ ] Cloud Function `generateTrainingAnalysis` liefert strukturierte Analyse als JSON
- [ ] Analyse berücksichtigt alle drei Aspekte: Verhalten, Fortschritt, Empfehlungen
- [ ] Empfehlungen sind kontextabhängig (aktiv/Plateau/inaktiv/Wiedereinstieg)
- [ ] 24h-Caching in Firestore, kein doppelter Gemini-Call am selben Tag
- [ ] Fallback bei Gemini-Fehler liefert sinnvolle statische Analyse
- [ ] Frontend zeigt Analyse in Material-Komponenten auf Analysis-Page
- [ ] i18n: Funktioniert auf Deutsch und Englisch
- [ ] Unit-Tests für Cloud Function (pure Logic extrahiert)
- [ ] Unit-Tests für Store und Komponente
- [ ] Keine neuen Modul-Boundary-Verletzungen

## Technische Umsetzungsschritte

1. **Models:** `TrainingAnalysis` Interface in `@pu-stats/models`
2. **Cloud Function:** `generateTrainingAnalysis` mit Gemini-Prompt, Caching, Fallback
3. **Pure Logic:** Trainings-Kontext-Aggregation als testbares Modul extrahieren
4. **API Service:** `TrainingAnalysisApiService` in `data-access`
5. **Store:** `TrainingAnalysisStore` als Feature-Store
6. **UI:** `TrainingAnalysisCard` Component mit Material-Komponenten
7. **i18n:** Labels in XLIFF, Gemini-Output sprachabhängig
8. **Tests:** Jest (Cloud Function), Vitest (Store + Component)
