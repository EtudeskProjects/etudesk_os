# Analytics

The website is wired for Plausible-compatible analytics.

## What is tracked

- Page views for the landing pages, including `/fr` and `/en`.
- Page views for the digital skills referential, including `/fr/digital-skills`.
- Outbound clicks to App Store and Google Play through the custom event `Store Download Click`.

Event properties:

- `platform`: `ios` or `android`
- `source_path`: current page path where the click happened

## Recommended setup

Simple proprietary option:

- Plausible Cloud
- Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=etudesk.com`
- Set `NEXT_PUBLIC_PLAUSIBLE_SRC=https://plausible.io/js/pa-SKHvpHlKIaWNsUZpRA8NU.js`

Simple open-source option:

- Self-host Plausible CE or Umami.
- For Plausible CE, set `NEXT_PUBLIC_PLAUSIBLE_SRC` to your hosted script URL.
- For Umami, add a small adapter component or replace `Analytics.tsx` with Umami's script.

## Store attribution

Website clicks are tracked on the site. Actual installs/downloads must be reconciled in:

- App Store Connect: use the campaign token in the iOS URL (`ct=website`).
- Google Play Console: use the Play URL UTM parameters.

This gives a clean funnel:

1. Landing page visitors
2. Referential visitors
3. Store click intent by platform
4. Store-side downloads/installs by campaign
