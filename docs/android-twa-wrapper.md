# Android-TWA-Wrapper

Die Play-Store-App ist kein eigenes Frontend, sondern eine **Trusted Web Activity**:
ein dünner Android-Wrapper unter `mobile/android-twa/`, der `https://pushup-stats.com`
in einem Chrome-Fenster ohne Browser-Chrome öffnet. Alles Sichtbare kommt aus
`web/` — Layout-Probleme in der App sind fast immer Web-Probleme.

## Bubblewrap überschreibt Handarbeit

`mobile/android-twa/` ist von [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
generiert. `bubblewrap update` erzeugt `app/build.gradle`, `AndroidManifest.xml` und
`LauncherActivity.java` **neu aus `twa-manifest.json`** und wirft dabei jede Änderung
weg, die nicht aus dem Manifest ableitbar ist.

Nach einem `bubblewrap update` sind deshalb diese Stellen erneut zu setzen:

| Stelle                  | Was                                                                                                                               | Warum                                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `build.gradle` (root)   | AGP `9.4.0`, `jcenter()` → `mavenCentral()`, `tasks.register('clean', Delete)` mit `layout.buildDirectory`                        | Play fordert AGP ≥ 9; `buildDir` gibt es in Gradle 9 nicht mehr                                                                                                          |
| `app/build.gradle`      | neue DSL: `compileSdk =`, `minSdk =`, `targetSdk =`, `lint { }` statt `lintOptions { }`                                           | AGP 9 setzt `android.newDsl=true` und hat die alten Methoden entfernt                                                                                                    |
| `app/build.gradle`      | `release { shrinkResources = true; proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro' }` | ohne `-optimize`-Variante meldet Play „Optimierung ist nicht aktiviert"                                                                                                  |
| `app/build.gradle`      | `generateShorcutsFile` als `tasks.register { doLast { … } }`                                                                      | Bubblewrap schreibt die Datei in der Configuration Phase; Gradle 9 hat den Configuration Cache an                                                                        |
| `app/build.gradle`      | `buildFeatures { resValues = true }`                                                                                              | AGP 9 schaltet `android.defaults.buildfeatures.resvalues` ab, und fast die ganze TWA-Konfiguration kommt über `resValue` — sonst scheitert schon die Konfigurationsphase |
| `app/build.gradle`      | `compileOptions` auf Java 17                                                                                                      | JDK 17 ist die AGP-9-Untergrenze                                                                                                                                         |
| `AndroidManifest.xml`   | `package="…"` am `<manifest>`-Element **entfernen**                                                                               | AGP 9 lehnt es ab; `namespace` in `app/build.gradle` übernimmt                                                                                                           |
| `LauncherActivity.java` | `onCreate`-Override **nicht** wiederherstellen                                                                                    | der Override pinnt den Splash Screen auf Hochformat — genau die Einschränkung, die Play für große Displays anmahnt                                                       |

`twa-manifest.json` selbst ist gepflegt (`"orientation": "any"`, `"minSdkVersion": 23`),
ein Update leitet daraus also schon das Richtige ab — aber eben nur daraus.

`minSdkVersion 23` ist keine freie Wahl: `androidbrowserhelper` verlangt es ab 2.7.x.

## App-Links: Webseiten-Links öffnen in der App

Der `VIEW`-Intent-Filter der `LauncherActivity` trägt `android:autoVerify="true"` und
`pathPrefix="/"` — damit öffnet Android **jeden** `https://pushup-stats.com/…`-Link
(WhatsApp, Mail, geteilte Profile, alle Sprachpfade `/de/`, `/en/`, …) direkt in der
App statt im Browser, sofern sie installiert ist. Bis Version 4 stand dort `/de/`;
Links auf andere Sprachen landeten im Browser.

Voraussetzungen, die zusammenpassen müssen:

- `twa-manifest.json` und `app/build.gradle` → `fullScopeUrl` ist die Domain-Wurzel. Bubblewrap leitet den
  `pathPrefix` daraus ab — steht dort wieder ein Sprachpfad, schrumpft ein
  `bubblewrap update` den Filter zurück.
- `web/public/.well-known/assetlinks.json` (per Rewrite unter
  `/.well-known/assetlinks.json` ausgeliefert) listet **beide** Fingerprints: Upload-Key
  und Play App Signing. Ohne den Play-Signing-Key scheitert die Verifizierung für jede
  Installation aus dem Store.
- `authDomain` ist `pushup-stats.firebaseapp.com`, nicht die eigene Domain — der
  OAuth-Redirect läuft also nicht über einen Pfad, den die App abfangen würde.

Links, die im Browser auf derselben Seite angeklickt werden, bleiben im Browser —
Chrome übergibt nur Navigationen von außen an die App. Die Änderung greift erst mit
dem nächsten AAB aus `play-release.yml` in der Produktion; prüfen lässt sie sich auf
dem Gerät mit `adb shell pm get-app-links com.pushupstats.app` (Status `verified`).

## Install-Vorschlag im Web

`InstallSuggestionOrchestrationService` (`web/src/app/core/install-suggestion/`) öffnet
einmal pro Sitzung einen Dialog auf dem Dashboard: auf Android den Play-Store-Link (plus
„Im Browser installieren", falls Chrome das anbietet — Geräte ohne Play Store), auf iOS
die „Zum Home-Bildschirm"-Schritte, sonst den PWA-Installationsdialog des Browsers
(`beforeinstallprompt`).

- **Zeitpunkt:** 20 s, nachdem die User-Config geladen ist. Walkthrough und
  Android-Test-Einladung öffnen auf dasselbe Signal ohne Blick auf offene Dialoge — sie
  gehen also vor, und der Vorschlag lässt die Sitzung aus, wenn dann schon ein Dialog
  offen ist.
- **Stumm** in der installierten App (`display-mode: standalone` oder TWA-Referrer) und
  wenn Chrome die Android-App über `getInstalledRelatedApps()` findet (dafür steht sie in
  `related_applications` des Web-Manifests).
- **Snooze** 14 Tage nach „Nicht jetzt", 90 Tage nach gestarteter Installation oder
  gefundener App — im `localStorage`, weil pro Gerät installiert wird, nicht pro Account.

Kein `launch_handler` im Web-Manifest: `navigate-existing` würde ein offenes PWA-Fenster
samt laufender Trainings-Session wegnavigieren, sobald ein Link von außen kommt.

## Bauen

Lokal braucht es ein Android SDK, das auf diesem Rechner nicht installiert ist. Der
Nachweis läuft deshalb über CI, in zwei Stufen:

- **Auf PRs:** `.github/workflows/android-twa.yml` baut ein **unsigniertes**
  `bundleRelease` und hängt das AAB als Artefakt an den Lauf. Reiner Build-Beweis.
- **Auf `main`:** `.github/workflows/play-release.yml` baut signiert, mit einem
  versionCode aus der Commit-Zahl, und lädt in den `internal`-Track hoch. Details:
  [`play-store-publishing.md`](play-store-publishing.md#die-app-selbst-veröffentlichen-aab-upload).

Der Upload-Keystore liegt nicht im Repo und gehört auch nicht hinein — er kommt als
GitHub-Secret und existiert im Lauf nur unter `$RUNNER_TEMP`.

Keiner der beiden Jobs ist Teil des `promote-to-deploy`-Gates: der Wrapper geht nicht
über Firebase raus, sondern über die Play Console.

## `signingKey.path` ist maschinenlokal

`twa-manifest.json` trägt einen **absoluten** Pfad zum Keystore — Bubblewrap
verlangt das so und unterstützt weder relative Pfade noch Platzhalter. Der Wert
gilt damit nur auf genau einem Rechner und zeigt auf jedem anderen ins Leere.

Für die Veröffentlichung spielt er **keine Rolle**: `play-release.yml` baut über
Gradle und bekommt den Keystore aus `ANDROID_KEYSTORE_PATH`, nicht aus dem
Manifest. Relevant ist das Feld nur, wenn jemand lokal `bubblewrap build`
aufruft — und dort gehört der Pfad auf die Kommandozeile statt in die
eingecheckte Datei:

```bash
bubblewrap build --signingKeyPath="/pfad/zu/upload.keystore"
```

## Was CI nicht beweist

R8 läuft im Release-Build mit Full Mode, Shrinking und (ab AGP 9)
`strictFullModeForKeepRules`. Fehler daraus schlagen **zur Laufzeit** zu, nicht beim
Bauen. Ein neues AAB gehört deshalb zuerst in den **Internal-Testing-Track** und einmal
durchgeklickt — Start, Splash, Dashboard, Arc-Nav, Auto-Count, Drehen —, bevor es auf
Produktion promoted wird.

## Edge-to-Edge

Ab targetSdk 35 zeichnet Android hinter Status- und Navigationsleiste. Der Wrapper
liefert dafür nur den Splash Screen (`androidbrowserhelper` ≥ 2.7.0,
`WindowCompat.enableEdgeToEdge`); den Rest macht die Web-App — siehe
[`gotchas/ui-interaction.md`](gotchas/ui-interaction.md#edge-to-edge-und-safe-area-insets).

Die Play Console meldet weiterhin `Window.setStatusBarColor` /
`setNavigationBarColor` / `getStatusBarColor` aus
`com.google.androidbrowserhelper.trusted.Utils` und `WebViewFallbackActivity`. Diese
Aufrufe stehen in der Bibliothek, nicht in unserem Code, und sind auf Android 15+
ohnehin No-ops. `WebViewFallbackActivity` aus dem Manifest zu streichen hilft nicht:
die Klasse wird aus der Bibliothek referenziert und bliebe im DEX — es würde nur den
Fallback auf Geräten ohne Custom-Tabs-Browser kaputt machen.
