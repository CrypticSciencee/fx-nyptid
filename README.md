# FX — fx.nyptid.com

**This will be updated often for more and more reasons why people don’t like x.com.**

Photoreal glass case file of [x.com](https://x.com). Why people still like the firehose, why they hate it, and the `@Parodyjeffx` exhibits with **absolute links to every person** in the screenshots.

Live: [fx.nyptid.com](https://fx.nyptid.com) · not affiliated with X Corp.

The ledger in `public/assets/js/data.js` is the living file. New exhibits, new handles, new hates — this repo is a running list, not a frozen rant.

## Stack

Static site. No build step. Cloudflare Pages.

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

## Deploy to Cloudflare Pages → fx.nyptid.com

1. Log in: `npx wrangler login`
2. Ship the folder:

```bash
npm run deploy
```

3. In the Cloudflare dashboard: **Workers & Pages → fx-nyptid → Custom domains → `fx.nyptid.com`**.
4. If `nyptid.com` is already on Cloudflare, Pages will attach the CNAME for `fx` for you. If the zone lives elsewhere, CNAME `fx` to `fx-nyptid.pages.dev`.

First-time project create (if deploy asks):

```bash
npx wrangler pages project create fx-nyptid --production-branch main
```

GitHub Action: set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, then push to `main`.

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
