# FX | fx.nyptid.com

**This will be updated often for more and more reasons why people don’t like x.com.**

Photoreal glass case file of [x.com](https://x.com). Why people still like the firehose, why they hate it, and the `@Parodyjeffx` exhibits with **absolute links to every person** in the screenshots.

**[fx.nyptid.com](https://fx.nyptid.com)** · © FX · by NYPTID Industries Advanced Technologies

The ledger in `public/assets/js/data.js` is the living file. New exhibits, new handles, new hates — this repo is a running list, not a frozen rant.

## Stack

Static site plus a Worker. Each nav tab is its own page (`/exhibits`, `/case`, `/hates`, `/people`, `/live`, `/desk`, `/donate`, `/proof`). No cache. Python receipts scraper in `scraper/`.

```
public/
  index.html
  404.html
  _headers
  assets/evidence/   ← screenshots
  assets/bg/         ← photoreal stills
  assets/css/fx.css
  assets/js/data.js  ← people, posts, hates, likes
  assets/js/fx.js
src/worker.js        ← POST/GET /api/proof
scraper/fx_receipts.py
```

## Local

```bash
npm install
npm run dev
```

Or any static server on `public/`:

```bash
npx --yes serve public
```

## Deploy

Already live on **https://fx.nyptid.com**.

```bash
npx wrangler login
npm run deploy
```

That ships Worker `fx` with the custom domain `fx.nyptid.com` on the `nyptid.com` zone. GitHub Action uses the same command — set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to deploy on push to `main`.

## Donate

[`/donate`](https://fx.nyptid.com/donate) supports genuine journalism on FX. Pledges are logged to KV (`donations`). Stripe Checkout is created per amount when `STRIPE_SECRET_KEY` is set. Thanks page: [`/donate/thanks`](https://fx.nyptid.com/donate/thanks).

Paste `DONATE-HANDOFF.md` into the Claude session wiring Stripe. That session should only:

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler deploy
```

Until the secret is set, pledges still land in KV so nothing is lost.

## Exhibits

Every screenshot on the wall is a door. Poster, quoted account, and tagged accounts all resolve to `https://x.com/{handle}` and, where we have them, the exact status URL.

| # | File | People |
|---|------|--------|
| 01 | Massie / suspended tombstone | [RabbiJeffx](https://x.com/RabbiJeffx) · [RepThomasMassie](https://x.com/RepThomasMassie) · [Parodyjeffx](https://x.com/Parodyjeffx) · [elonmusk](https://x.com/elonmusk) |
| 02 | Tate funnel | [TRW_global](https://x.com/TRW_global) |
| 03 | Local sun | [FELibrary_](https://x.com/FELibrary_) |
| 04 | Unban or never | [MmisterNobody](https://x.com/MmisterNobody) |
| 05 | Appeal denied | [RabbiJeffx](https://x.com/RabbiJeffx) |
| 06 | 350k posts, silence | [RabbiJeffx](https://x.com/RabbiJeffx) · [allegrajacchia](https://x.com/allegrajacchia) |
| 07 | Headlines, no comment | [IanMalcolm84](https://x.com/IanMalcolm84) |
| 08 | The slogan vs the body | [elonmusk](https://x.com/elonmusk/status/1817229118510973267) · [GenXGirl1994](https://x.com/GenXGirl1994) |

## Voice

The site records what was posted. It does not issue a legal finding on Gaza, and it is not a brief for any advocacy group. The product argument is the hypocrisy of the slogan, the feed’s sewage, and a form-letter justice system.
