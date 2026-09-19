# Kamera-Autozähler

Der Autozähler besteht aus zwei Hälften: `libs/auto-count` (plattformfrei, Ports + Zustandsautomaten) und `web/src/app/auto-count` (Browser-Adapter + Dialoge). Wer die Erkennung anfasst, sollte die folgenden drei Punkte kennen — alles andere steht im Code.

## Was pro Frame durch die Pipeline läuft

`MediaPipePoseDetector` → `poseToAngleSample()` → `RepStateMachine` / `HoldStateMachine`.

`poseToAngleSample()` wählt die besser sichtbare Körperseite und liefert neben Winkel und Konfidenz auch das **Skelett** (`PoseSkeleton`: alle Landmarks plus das gemessene Gelenk-Triplett). Das Skelett reist über `FormCheckFrame.pose` bzw. `HoldFormCheckFrame.pose` zur UI. Der Proximity-Zähler (Helligkeit statt Pose) setzt dort `null` — jeder Konsument muss den Fall behandeln.

## Fallstrick: Overlay-Koordinaten

Landmarks sind auf das **Quellbild** normiert (`[0, 1]`), das `<video>` ist aber mit `object-fit: cover` **und** `transform: scaleX(-1)` gestylt. Ein naives `x * breite` lässt das Skelett neben dem Körper landen, sobald Kamera- und Element-Seitenverhältnis auseinanderlaufen — auf dem Handy immer.

`coverProjector()` (`pose-overlay-projection.ts`) rechnet den Cover-Beschnitt nach und spiegelt die x-Achse. Das Canvas selbst darf **nicht** per CSS gespiegelt werden, sonst steht die Winkelbeschriftung seitenverkehrt.

## Parameter-Tuning (Admin)

Die Schwellwerte in `exercise-angle-profile.ts` / `exercise-hold-profile.ts` sind die Standardwerte, nicht das letzte Wort. Über den Port `PROFILE_OVERRIDES` legt sich `AutoCountTuningStore` darüber:

- Firestore-Collection **`autoCountProfiles`**, ein Dokument je Detektor-Profil-Id (`pushup`, `plank`, …). Lesen: alle angemeldeten Clients. Schreiben: nur `request.auth.token.admin == true`.
- Das Feld **`published`** ist der Rollout-Schalter. Solange es `false` ist, wirkt das Profil **nur für Admins** — halbfertige Schwellwerte sollen nicht verändern, was bei allen anderen gezählt wird.
- Schieberegler wirken sofort lokal (Draft schlägt gespeicherten Wert), greifen aber erst beim **nächsten** `start()` — die Dialoge starten den Detektor deshalb bei jeder Änderung neu.
- Nur numerische, im Slider-Bereich liegende Werte überleben (`sanitizeTuningValues`, `applyOverride`). Ein kaputtes Dokument darf keinen Schwellwert auf `NaN` ziehen: jeder Vergleich im Automaten wäre dann `false` und es würde stillschweigend nicht mehr gezählt.

Gelenk-Tripletts sind bewusst **nicht** übersteuerbar — an welchem Gelenk eine Übung gemessen wird, ist Eigenschaft der Übung, kein Tuning-Parameter.

## Genauigkeits-Feedback

Nach einem gezählten Satz fragt der Dialog einmal nach: „Erkannt: N — hat das gestimmt?“. Die Antwort des Nutzers **bestimmt den gebuchten Eintrag**, nicht nur die Telemetrie; ehrlich antworten darf keinen falschen Eintrag kosten.

- Firestore-Collection **`autoCountFeedback`**, create-only für angemeldete Nutzer, Rücklesen nur über die Callable `adminListAutoCountFeedback` (Admin SDK umgeht die Rules).
- Gespeichert werden erkannte und tatsächliche Anzahl plus die **effektiv benutzten Schwellwerte** — ohne die ist ein Fehlzähler nicht interpretierbar.
- Opt-out pro Gerät (`localStorage`, `pus_auto_count_feedback`), umschaltbar unter Einstellungen → Privatsphäre. Standard ist an: die Frage ist ein Tap und die Daten nützen nur, wenn die Mehrheit der Läufe antwortet.
- Ein fehlgeschlagener Schreibvorgang wird verschluckt (`AutoCountFeedbackFlow.record`) — Telemetrie darf den Eintrag nie blockieren.

### Auswertung auf `/admin`

`summarizeAutoCountFeedback()` gruppiert nach Profil **und Schwellwert-Satz**, nicht nur nach Profil. Genau das ist die Frage beim Tuning: „bei `downAngleDeg 80` waren 92 % von 40 Läufen exakt, bei `90` nur 71 %" — eine Auswertung über das Profil als Ganzes würde die beiden Konfigurationen wegmitteln.

Sortiert wird nach Anzahl Läufe absteigend, und Sätze unter 10 Läufen bekommen im Admin-Abschnitt ein Warndreieck: 100 % aus zwei Läufen ist kein Ergebnis. Die Spalte „Tendenz" ist der **vorzeichenbehaftete** Mittelwert (`tatsächlich − erkannt`) — Plus heißt, der Zähler übersieht Wiederholungen, Minus heißt, er zählt zu viele. Das entscheidet, in welche Richtung der Schwellwert muss.
