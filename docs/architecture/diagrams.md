# Architektur-Diagramme

> **Generiert** von `pnpm nx run tools:generate-architecture-diagrams` — nicht von Hand
> bearbeiten. Die wöchentliche Routine [`architecture-review`](../../.claude/routines/architecture-review.md)
> aktualisiert diese Datei und `metrics.json`; Regeln und Hintergründe stehen in
> [`docs/architecture.md`](../architecture.md).

## 1. Nx-Projekte

Pfeile: `-->` statischer Import, `-.->` dynamischer Import, `==>` implizite Abhängigkeit.

```mermaid
flowchart TD
  subgraph apps["Apps"]
    cloud_functions["cloud-functions<br/><i>cloud-functions</i><br/>109 Dateien · 12391 LOC"]
    data_store["data-store<br/><i>data-store</i>"]
    sw_push["sw-push<br/><i>sw-push</i><br/>3 Dateien · 434 LOC"]
    web["web<br/><i>app</i><br/>401 Dateien · 48623 LOC"]
    web_e2e_emulator["web-e2e-emulator<br/><i>e2e</i>"]
  end
  subgraph libs["Libs"]
    auth["auth<br/><i>auth</i><br/>25 Dateien · 1956 LOC"]
    auto_count["auto-count<br/><i>auto-count</i><br/>20 Dateien · 1620 LOC"]
    pus_motivation["pus-motivation<br/><i>motivation</i><br/>3 Dateien · 296 LOC"]
    pus_push["pus-push<br/><i>push</i><br/>5 Dateien · 516 LOC"]
    pus_reminders["pus-reminders<br/><i>reminders</i><br/>6 Dateien · 418 LOC"]
    pus_ui["pus-ui<br/><i>ui</i><br/>5 Dateien · 377 LOC"]
    stats_ads["stats-ads<br/><i>ads</i><br/>6 Dateien · 330 LOC"]
    stats_data_access["stats-data-access<br/><i>data-access</i><br/>18 Dateien · 1809 LOC"]
    stats_data_access_state["stats-data-access-state<br/><i>data-access-state</i><br/>3 Dateien · 335 LOC"]
    stats_date["stats-date<br/><i>date</i><br/>11 Dateien · 183 LOC"]
    stats_models["stats-models<br/><i>models</i><br/>38 Dateien · 6945 LOC"]
    stats_quick_add["stats-quick-add<br/><i>quick-add</i><br/>5 Dateien · 302 LOC"]
    testing["testing<br/><i>testing</i>"]
    tools["tools<br/><i>tools</i>"]
  end
  auth --> pus_ui
  auth --> stats_models
  auth --> testing
  cloud_functions --> stats_models
  data_store ==> cloud_functions
  pus_motivation --> stats_models
  pus_push --> stats_data_access
  pus_push ==> sw_push
  pus_reminders --> pus_motivation
  pus_reminders --> pus_push
  pus_reminders --> stats_data_access
  pus_reminders --> stats_models
  stats_data_access --> stats_models
  stats_data_access_state --> pus_ui
  stats_data_access_state --> stats_data_access
  stats_data_access_state --> stats_models
  stats_quick_add --> pus_ui
  stats_quick_add --> testing
  sw_push ==> stats_models
  testing --> stats_data_access
  testing --> stats_models
  tools -.-> web
  web --> auth
  web --> auto_count
  web ==> data_store
  web --> pus_motivation
  web --> pus_push
  web --> pus_reminders
  web --> pus_ui
  web --> stats_ads
  web --> stats_data_access
  web --> stats_data_access_state
  web --> stats_date
  web --> stats_models
  web --> stats_quick_add
  web ==> sw_push
  web --> testing
  web_e2e_emulator ==> data_store
  web_e2e_emulator ==> web
```

### Kopplung der Projekte (statische Kanten)

| Modul                     | Dateien |   LOC | > 250 LOC | Ca (eingehend) | Ce (ausgehend) | Instabilität |
| ------------------------- | ------: | ----: | --------: | -------------: | -------------: | -----------: |
| `auth`                    |      25 |  1956 |         1 |              1 |              3 |         0.75 |
| `auto-count`              |      20 |  1620 |         0 |              1 |              0 |         0.00 |
| `cloud-functions`         |     109 | 12391 |         9 |              0 |              1 |         1.00 |
| `pus-motivation`          |       3 |   296 |         0 |              2 |              1 |         0.33 |
| `pus-push`                |       5 |   516 |         1 |              2 |              1 |         0.33 |
| `pus-reminders`           |       6 |   418 |         0 |              1 |              4 |         0.80 |
| `pus-ui`                  |       5 |   377 |         0 |              4 |              0 |         0.00 |
| `stats-ads`               |       6 |   330 |         0 |              1 |              0 |         0.00 |
| `stats-data-access`       |      18 |  1809 |         3 |              5 |              1 |         0.17 |
| `stats-data-access-state` |       3 |   335 |         0 |              1 |              3 |         0.75 |
| `stats-date`              |      11 |   183 |         0 |              1 |              0 |         0.00 |
| `stats-models`            |      38 |  6945 |         8 |              8 |              0 |         0.00 |
| `stats-quick-add`         |       5 |   302 |         0 |              1 |              2 |         0.67 |
| `sw-push`                 |       3 |   434 |         0 |              0 |              0 |         0.00 |
| `testing`                 |       0 |     0 |         0 |              3 |              2 |         0.40 |
| `web`                     |     401 | 48623 |        33 |              0 |             13 |         1.00 |

### Zyklen zwischen Projekten

_Keine Zyklen._

## 2. Feature-Bereiche in `web/src/app`

Jeder Knoten ist ein Ordner direkt unter `web/src/app` (`app-shell` = Dateien direkt im
Ordner). Eine Kante zählt die Prod-Dateien des Quell-Features, die per relativem Import
in das Ziel-Feature greifen. Rot umrandet: Teil eines Import-Zyklus.

```mermaid
flowchart LR
  achievements["achievements<br/>9 Dateien · 826 LOC"]
  admin["admin<br/>25 Dateien · 3274 LOC"]
  ai["ai<br/>9 Dateien · 451 LOC"]
  app_shell["app-shell<br/>7 Dateien · 1297 LOC"]
  auto_count["auto-count<br/>22 Dateien · 2298 LOC"]
  blog["blog<br/>6 Dateien · 641 LOC"]
  core["core<br/>68 Dateien · 7363 LOC"]
  friends["friends<br/>25 Dateien · 3107 LOC"]
  goals["goals<br/>5 Dateien · 552 LOC"]
  leaderboard["leaderboard<br/>1 Dateien · 233 LOC"]
  marketing["marketing<br/>9 Dateien · 763 LOC"]
  notifications["notifications<br/>11 Dateien · 1147 LOC"]
  public_profile["public-profile<br/>10 Dateien · 1265 LOC"]
  reminders["reminders<br/>11 Dateien · 1319 LOC"]
  settings["settings<br/>4 Dateien · 206 LOC"]
  stats["stats<br/>91 Dateien · 13560 LOC"]
  training_plans["training-plans<br/>44 Dateien · 5443 LOC"]
  wiki["wiki<br/>5 Dateien · 1257 LOC"]
  workouts["workouts<br/>22 Dateien · 2642 LOC"]
  achievements -->|3| core
  achievements -->|2| public_profile
  admin --> achievements
  admin -->|6| core
  admin --> public_profile
  admin -->|2| stats
  ai -->|2| core
  ai --> stats
  app_shell -->|2| achievements
  app_shell --> admin
  app_shell -->|2| ai
  app_shell --> auto_count
  app_shell -->|2| blog
  app_shell -->|3| core
  app_shell --> friends
  app_shell --> goals
  app_shell --> leaderboard
  app_shell --> marketing
  app_shell -->|2| notifications
  app_shell --> public_profile
  app_shell --> reminders
  app_shell --> settings
  app_shell --> stats
  app_shell --> training_plans
  app_shell --> wiki
  app_shell --> workouts
  auto_count -->|3| core
  auto_count -->|2| stats
  blog -->|2| core
  core -->|3| admin
  core -->|2| auto_count
  core --> blog
  core -->|2| friends
  core --> notifications
  core -->|7| stats
  core -->|3| training_plans
  core -->|2| workouts
  friends -->|2| admin
  friends -->|3| core
  friends -->|3| stats
  goals --> core
  goals --> stats
  leaderboard --> core
  leaderboard --> stats
  marketing --> ai
  marketing --> core
  notifications -->|3| core
  public_profile -->|2| core
  public_profile --> friends
  public_profile --> stats
  public_profile --> workouts
  reminders --> core
  reminders --> notifications
  settings --> auto_count
  settings -->|2| core
  settings -->|4| stats
  stats -->|14| core
  stats --> friends
  stats -->|2| notifications
  stats -->|4| training_plans
  training_plans --> auto_count
  training_plans -->|12| core
  training_plans -->|3| stats
  wiki -->|3| core
  wiki -->|2| workouts
  workouts --> admin
  workouts -->|3| core
  workouts --> friends
  workouts -->|3| stats
  workouts -->|2| training_plans
  classDef cyclic stroke:#d33,stroke-width:3px
  class achievements,admin,auto_count,blog,core,friends,notifications,public_profile,stats,training_plans,workouts cyclic
```

### Kopplung der Feature-Bereiche

| Modul            | Dateien |   LOC | > 250 LOC | Ca (eingehend) | Ce (ausgehend) | Instabilität |
| ---------------- | ------: | ----: | --------: | -------------: | -------------: | -----------: |
| `achievements`   |       9 |   826 |         0 |              2 |              2 |         0.50 |
| `admin`          |      25 |  3274 |         2 |              4 |              4 |         0.50 |
| `ai`             |       9 |   451 |         0 |              2 |              2 |         0.50 |
| `app-shell`      |       7 |  1297 |         2 |              0 |             18 |         1.00 |
| `auto-count`     |      22 |  2298 |         2 |              4 |              2 |         0.33 |
| `blog`           |       6 |   641 |         0 |              2 |              1 |         0.33 |
| `core`           |      68 |  7363 |         5 |             18 |              8 |         0.31 |
| `friends`        |      25 |  3107 |         2 |              5 |              3 |         0.38 |
| `goals`          |       5 |   552 |         0 |              1 |              2 |         0.67 |
| `leaderboard`    |       1 |   233 |         0 |              1 |              2 |         0.67 |
| `marketing`      |       9 |   763 |         0 |              1 |              2 |         0.67 |
| `notifications`  |      11 |  1147 |         0 |              4 |              1 |         0.20 |
| `public-profile` |      10 |  1265 |         0 |              3 |              4 |         0.57 |
| `reminders`      |      11 |  1319 |         1 |              1 |              2 |         0.67 |
| `settings`       |       4 |   206 |         0 |              1 |              3 |         0.75 |
| `stats`          |      91 | 13560 |        12 |             12 |              4 |         0.25 |
| `training-plans` |      44 |  5443 |         3 |              4 |              3 |         0.43 |
| `wiki`           |       5 |  1257 |         2 |              1 |              2 |         0.67 |
| `workouts`       |      22 |  2642 |         0 |              4 |              5 |         0.56 |

### Zyklen zwischen Feature-Bereichen

- `achievements` ↔ `admin` ↔ `auto-count` ↔ `blog` ↔ `core` ↔ `friends` ↔ `notifications` ↔ `public-profile` ↔ `stats` ↔ `training-plans` ↔ `workouts`

## 3. Prod-Dateien über 250 LOC

| Datei                                                                                       | LOC |
| ------------------------------------------------------------------------------------------- | --: |
| `libs/stats/src/lib/models/pushup-type.models.ts`                                           | 910 |
| `web/src/app/stats/shell/stats-dashboard.component.ts`                                      | 547 |
| `libs/stats/src/lib/models/exercise.models.ts`                                              | 534 |
| `data-store/functions/src/user-stats-delta.ts`                                              | 503 |
| `web/src/app/stats/analysis.store.ts`                                                       | 469 |
| `web/src/app/app.ts`                                                                        | 466 |
| `libs/stats/src/lib/models/exercise-wiki.models.ts`                                         | 444 |
| `web/src/app/app.routes.ts`                                                                 | 436 |
| `libs/data-access/src/lib/api/user-training-plan-api.service.ts`                            | 407 |
| `web/src/app/stats/components/filter-bar/filter-bar.component.ts`                           | 402 |
| `web/src/app/stats/components/quick-add-config-dialog/quick-add-config-dialog.component.ts` | 398 |
| `web/src/app/stats/shell/analysis-page.component.ts`                                        | 395 |
| `web/src/app/core/goal-reached-notification.service.ts`                                     | 379 |
| `web/src/app/core/page-header/page-header.component.ts`                                     | 374 |
| `data-store/functions/src/functions-push.ts`                                                | 369 |
| `libs/stats/src/lib/models/user-config.models.ts`                                           | 356 |
| `data-store/functions/src/functions-android-test.ts`                                        | 355 |
| `web/src/app/wiki/pushup-types-page.component.ts`                                           | 350 |
| `web/src/app/training-plans/training-plan.store.ts`                                         | 346 |
| `libs/push/src/lib/push-subscription.store.ts`                                              | 345 |
| `web/src/app/wiki/pushup-type-detail.component.ts`                                          | 345 |
| `data-store/functions/src/profile/og-render.ts`                                             | 336 |
| `web/src/app/stats/dashboard.store.ts`                                                      | 333 |
| `data-store/functions/src/functions-public-profile.ts`                                      | 329 |
| `web/src/app/stats/entries.store.ts`                                                        | 328 |

…und 30 weitere (siehe `metrics.json`).
