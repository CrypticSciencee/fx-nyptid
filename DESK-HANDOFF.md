# Paste this into the NYPTID Industries session

You cannot be messaged from the FX Grok session. If you are working on nyptidindustries.com, add the same live surfaces that are now on FX. Do not clone TheOSSreport. FX’s desk is its own forensic board.

## What to ship

1. A **Live feed** page: unfiltered running log, newest first, polling an API every few seconds, RSS out, optional browser alerts.
2. A **Desk** page that is FX-native:
   - LIVE status strip (quote age, wire age, last refresh)
   - WIRE ticker of named-source headlines (viewport clipped, badge never covers text)
   - City clocks with seconds
   - Live oil: ICE Brent `BZ=F` and NYMEX WTI `CL=F` from Yahoo Finance, plus the live spread
   - TradingView dark widget for `TVC:UKOIL`
   - Hormuz as a dated conflict clock (28 Feb 2026, Reuters first-strikes date) — not a fake live AIS count
   - Named wires: BBC World, Al Jazeera, Guardian, OilPrice
   - FX receipts column from the live feed
3. A **Donate** page: pledges for genuine journalism. Stripe Payment Link via `STRIPE_PAYMENT_LINK`.

## Working endpoints already live on FX (reuse or clone)

- Site: https://fx.nyptid.com
- X live log: https://fx.nyptid.com/live
- FX desk: https://fx.nyptid.com/desk
- Donate: https://fx.nyptid.com/donate
- `GET https://fx.nyptid.com/api/oil` → `{ brent, wti, spread, source, generated_at }`
- `GET https://fx.nyptid.com/api/world` → `{ items: [{ source, title, url, published }] }`
- `GET https://fx.nyptid.com/api/desk` → oil + world + FX receipts in one payload
- `GET/POST https://fx.nyptid.com/api/donate`
- `GET https://fx.nyptid.com/rss.xml` → FX live RSS
- Repo: https://github.com/CrypticSciencee/fx-nyptid

NYPTID Industries is React Router. Add `/live`, `/desk`, and `/donate` routes. Do not swallow them in the homepage. Pull oil/world/desk from the FX APIs above if you do not want a second worker.
