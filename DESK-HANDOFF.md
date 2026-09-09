# Paste this into the NYPTID Industries session

You cannot be messaged from the FX Grok session. If you are working on nyptidindustries.com, add the same live desk that is now on FX.

## What to ship

1. A **Live feed** page: unfiltered running log, newest first, polling an API every few seconds, RSS out, optional browser alerts.
2. A **Desk** page copied from TheOSSreport’s live chrome (not their article archive):
   - BREAKING ticker of world headlines
   - World clocks: Jerusalem, Tehran, Washington, Moscow, Beijing, San Francisco
   - Live oil: Brent (BZ=F) and WTI (CL=F)
   - TradingView dark widget for TVC:UKOIL
   - Hormuz board: blockade day since 2026-03-03, transits vs 140 pre-war, ~5M bbl/day blocked
   - Headline rail from BBC World + Al Jazeera + CNBC energy RSS

## Working endpoints already live on FX (reuse or clone)

- Site: https://fx.nyptid.com
- X live log: https://fx.nyptid.com/live
- World desk: https://fx.nyptid.com/desk
- `GET https://fx.nyptid.com/api/oil` → `{ brent: { price, change }, wti: { price, change } }`
- `GET https://fx.nyptid.com/api/world` → `{ items: [{ source, title, url, published }] }`
- `GET https://fx.nyptid.com/rss.xml` → FX live RSS
- Repo: https://github.com/CrypticSciencee/fx-nyptid

NYPTID Industries is React Router. Add `/live` and `/desk` routes. Do not swallow them in the homepage. Pull oil/world from the FX APIs above if you do not want a second worker.
