# Ads Integration Plan (Google)

## Decision

- Start with **Google AdSense** (fast rollout, low ops complexity)
- Keep architecture ready for migration to **Google Ad Manager / GPT** later.

## Principles

- Ads only after explicit user consent (`pus_ads_consent=granted`)
- Keep ad rendering behind one reusable component (`pus-ad-slot`)
- Keep kill-switch capability (next step: Remote Config)
- Separate ad tech from business pages

## Implemented in this task

- `AdConsentService` introduced
- `GoogleAdsService` introduced (script bootstrap + slot render call)
- `AdSlotComponent` introduced (`pus-ad-slot`)
- Dashboard includes first pilot inline ad slot
- Unit tests for consent + ad-slot behavior

## Next steps

- Add Firebase Remote Config gate (`ads_enabled`, `ads_dashboard_inline_enabled`)
- Add real ad client/slot IDs via environment/config (remove placeholders)
- Add consent UI flow for ads preference (settings page)
- Add telemetry events (impression/click proxies where policy-compliant)
- Add route-level ad placement policy
