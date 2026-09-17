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

## Bauen

Lokal braucht es ein Android SDK, das auf diesem Rechner nicht installiert ist. Der
Nachweis läuft deshalb über CI: `.github/workflows/android-twa.yml` baut bei jeder
Änderung unter `mobile/android-twa/**` ein **unsigniertes** `bundleRelease` und hängt
das AAB als Artefakt an den Lauf. Der Upload-Keystore liegt nicht im Repo und gehört
auch nicht hinein — signiert wird lokal per Bubblewrap.

Der Job ist **nicht** Teil des `promote-to-deploy`-Gates: der Wrapper geht nicht über
Firebase raus, sondern per Hand in die Play Console.

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
