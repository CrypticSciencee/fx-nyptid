# FX journalism donations — endpoint handoff

Paste this into the Claude session wiring Stripe. Do not redesign FX. Do not put secrets in git.

## Endpoint

Base: `https://fx.nyptid.com`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/donate` | Is checkout live? |
| `POST` | `/api/donate` | Log gift, then return Stripe URL |
| page | `/donate` | Donor UI (already built) |
| page | `/donate/thanks` | Stripe success_url |

Worker: `fx` · Cloudflare account `9f77543b0f03220e7bc8886cd4b4c909` · KV binding `PROOF` (`b995375e839442b39d8505b616cba7e6`) key `donations` · repo https://github.com/CrypticSciencee/fx-nyptid

---

### GET `/api/donate`

No body. No auth.

**Response 200**

```json
{
  "ready": false,
  "mode": null,
  "currency": "USD",
  "purpose": "journalism",
  "note": "Pledges are logged. Set STRIPE_SECRET_KEY on Worker fx to take payment."
}
```

| Field | After you set the secret |
|---|---|
| `ready` | `true` |
| `mode` | `"checkout"` if `STRIPE_SECRET_KEY`, else `"link"` if `STRIPE_PAYMENT_LINK` |
| `currency` | always `"USD"` |
| `purpose` | always `"journalism"` |

The page reads `ready` + `mode` only. Do not change this shape.

---

### POST `/api/donate`

`Content-Type: application/json`

**Request**

```json
{
  "amount": 40,
  "email": "optional@example.com",
  "name": "optional",
  "note": "optional",
  "recurring": false
}
```

| Field | Rules |
|---|---|
| `amount` | number, **required**, `1`–`100000` (USD, not cents) |
| `email` | string, optional, max 120 |
| `name` | string, optional, max 80 |
| `note` | string, optional, max 500 |
| `recurring` | boolean, optional. `true` = monthly subscription |

Rate limit: 12 POSTs / hour / IP.

**Response 200 — checkout live**

```json
{
  "ok": true,
  "ready": true,
  "mode": "checkout",
  "session_id": "cs_...",
  "stripe": "https://checkout.stripe.com/c/pay/cs_...",
  "pledge": {
    "id": "uuid",
    "amount": 40,
    "currency": "USD",
    "purpose": "journalism",
    "recurring": false,
    "email": "",
    "name": "",
    "note": "",
    "created_at": "2026-09-09T00:00:00.000Z"
  }
}
```

The browser sets `window.location` to `stripe`. That is the only redirect.

**Response 200 — secret not set yet**

Same object, `stripe: null`, `ready: false`. Gift is still in KV. Nothing is lost.

**Errors**

| Status | Body |
|---|---|
| 400 | `{ "error": "Send JSON." }` |
| 400 | `{ "error": "Pick an amount between 1 and 100000." }` |
| 429 | `{ "error": "Slow down. Come back in an hour." }` |
| 502 | `{ "ok": true, "pledge": {...}, "stripe": null, "ready": false, "error": "<Stripe message>" }` |

---

### What the Worker already sends to Stripe Checkout

`POST https://api.stripe.com/v1/checkout/sessions`

- `mode`: `payment` or `subscription` if `recurring`
- `line_items[0].price_data.currency` = `usd`
- `line_items[0].price_data.unit_amount` = `amount * 100` (cents)
- Product name: `FX journalism`
- Description: `Support genuine journalism on fx.nyptid.com`
- `success_url`: `https://fx.nyptid.com/donate/thanks?session_id={CHECKOUT_SESSION_ID}`
- `cancel_url`: `https://fx.nyptid.com/donate`
- `client_reference_id` = pledge `id`
- `customer_email` if provided
- `metadata.purpose` = `journalism`
- `metadata.pledge_id` = pledge `id`
- Monthly: `recurring[interval]=month`

UI amounts: 5, 15, 40, 100, 250, plus custom.

---

## Your job (only this)

```bash
cd <fx-nyptid repo>
npx wrangler secret put STRIPE_SECRET_KEY
# paste sk_live_...  (sk_test_... only for a dry run)
npx wrangler deploy
```

Then:

```bash
curl -sS https://fx.nyptid.com/api/donate
# {"ready":true,"mode":"checkout",...}

curl -sS -X POST https://fx.nyptid.com/api/donate \
  -H "content-type: application/json" \
  -d "{\"amount\":5,\"name\":\"claude\",\"note\":\"endpoint check\"}"
# "stripe":"https://checkout.stripe.com/..."
```

Open https://fx.nyptid.com/donate → Continue to secure checkout → Stripe → thanks.

**Do not** use a fixed-price Payment Link as the primary path. Custom amounts will not match.

Optional fallback only:

```bash
npx wrangler secret put STRIPE_PAYMENT_LINK
```

Never commit keys. Never rewrite `/donate` or `/api/donate` unless Checkout fails.
