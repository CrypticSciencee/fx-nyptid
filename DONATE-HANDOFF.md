# Paste this into the Claude session wiring Stripe for FX

You cannot be messaged from the FX Grok session. Wire Stripe for **journalism donations** on FX. Do not redesign the site. Do not rewrite donate.html. Do not put secrets in git.

## What is already live

- Donate: https://fx.nyptid.com/donate
- Thanks: https://fx.nyptid.com/donate/thanks
- Repo: https://github.com/CrypticSciencee/fx-nyptid
- Worker name: `fx`
- Cloudflare account: `9f77543b0f03220e7bc8886cd4b4c909`
- Custom domain: `fx.nyptid.com`
- KV: binding `PROOF`, id `b995375e839442b39d8505b616cba7e6`, pledges stored under key `donations`

### API the page already calls

`GET https://fx.nyptid.com/api/donate`

```json
{ "ready": false, "mode": null, "currency": "USD", "purpose": "journalism" }
```

After you set the secret, `ready` becomes `true` and `mode` becomes `"checkout"`.

`POST https://fx.nyptid.com/api/donate`

```json
{ "amount": 40, "email": "optional", "name": "optional", "note": "optional", "recurring": false }
```

Worker then:

1. Logs the pledge to KV (`purpose: journalism`, USD).
2. If `STRIPE_SECRET_KEY` is set, creates a **Stripe Checkout Session** for that exact amount (cents) and returns `{ stripe: "https://checkout.stripe.com/..." }`. The browser redirects there.
3. Else if `STRIPE_PAYMENT_LINK` is set, returns that URL (worse: custom amounts will not match unless the link is “customer chooses amount”).
4. Else logs only.

Checkout Session fields the Worker already sends:

- Product name: `FX journalism`
- Description: `Support genuine journalism on fx.nyptid.com`
- Currency: `usd`
- Success: `https://fx.nyptid.com/donate/thanks?session_id={CHECKOUT_SESSION_ID}`
- Cancel: `https://fx.nyptid.com/donate`
- `client_reference_id` = pledge id
- `metadata.purpose` = `journalism`
- Monthly if `recurring: true` (`mode=subscription`, interval `month`)

Amounts on the page: $5, $15, $40, $100, $250, plus custom 1–100000.

## What you must do

Preferred path (custom amounts work):

1. Stripe Dashboard → account that can take USD.
2. Copy the **Secret key** (`sk_live_...` for real money, `sk_test_...` only if they want a dry run).
3. In this repo, from the FX project root:

```bash
npx wrangler secret put STRIPE_SECRET_KEY
```

Paste the key when prompted.

4. Deploy the same Worker:

```bash
npx wrangler deploy
```

That is the whole job. The page already redirects. The thanks page already exists.

### Optional fallback only

A Payment Link is worse because the donor’s chosen amount on FX will not automatically be the Stripe charge unless the link is customer-chooses-amount.

```bash
npx wrangler secret put STRIPE_PAYMENT_LINK
```

Do **not** use a fixed $40 Payment Link as the primary path.

## Verify

```bash
curl -sS https://fx.nyptid.com/api/donate
# ready: true, mode: "checkout"

curl -sS -X POST https://fx.nyptid.com/api/donate \
  -H "content-type: application/json" \
  -d "{\"amount\":5,\"note\":\"wire check\",\"name\":\"claude\"}"
# stripe: https://checkout.stripe.com/...
```

Open https://fx.nyptid.com/donate → Donate with Stripe → Checkout loads → pay (or cancel) → thanks or back to /donate.

## Do not

- Do not rewrite `/donate` or the Worker donate handlers unless Checkout fails.
- Do not commit `sk_live` / `sk_test` / Payment Link URLs to git or `wrangler.toml`.
- Do not change FX branding, copy, or nav.
- Do not build a second donate page on nyptidindustries.com unless asked. FX is `fx.nyptid.com`.

## If Checkout errors

The POST returns 502 with `error` from Stripe (`data.error.message`). Fix the key, currency, or account, then `npx wrangler deploy` only if you changed Worker code. Changing a secret requires a new deploy **or** a new Worker request after `secret put` — run `npx wrangler deploy` after putting the secret to be safe.
