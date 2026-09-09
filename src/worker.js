const X_HOST = /^(https:\/\/(www\.)?(x|twitter)\.com)(\/|$)/i;
const STATUS = /^https:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/\d+/i;
const HANDLE = /^@?[A-Za-z0-9_]{1,15}$/;

function clean(value, max) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
      pragma: "no-cache"
    }
  });
}

function xUrl(value) {
  const url = clean(value, 300);
  if (!X_HOST.test(url)) return "";
  try {
    const parsed = new URL(url);
    if (!["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(parsed.hostname)) return "";
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function normalizeHandle(value, profileUrl) {
  let handle = clean(value, 16).replace(/^@/, "");
  if (!handle && profileUrl) {
    const parts = profileUrl.split("/").filter(Boolean);
    handle = parts[parts.length - 1] || "";
  }
  return HANDLE.test(handle) ? handle : "";
}

function asFeed(item, source) {
  return {
    id: item.id,
    source,
    handle: item.handle,
    display_name: item.display_name || item.author || item.handle,
    text: item.text || item.statement,
    url: item.url || item.proof_url,
    profile_url: item.profile_url || (item.handle ? `https://x.com/${item.handle}` : ""),
    created_at: item.created_at
  };
}

async function readList(env, key) {
  const raw = await env.PROOF.get(key);
  return raw ? JSON.parse(raw) : [];
}

async function writeList(env, key, items) {
  await env.PROOF.put(key, JSON.stringify(items.slice(0, 500)));
}

async function pushFeed(env, item) {
  const feed = await readList(env, "feed");
  if (feed.some((row) => row.id === item.id || (row.url && row.url === item.url))) return false;
  feed.unshift(item);
  await writeList(env, "feed", feed);
  return true;
}

const RELEVANT =
  /ban|unban|suspend|shadowban|free.?speech|grok|parody|elon|appeal|x\.com|twitter|\bx\b|algorithm|bot|premium|censor|receipt|hypocrisy|tombstone|form.?letter|safety|community notes|for you|verified|blue check|massie|gaza/i;

async function scrapePost(statusUrl) {
  const endpoint = `https://publish.twitter.com/oembed?url=${encodeURIComponent(statusUrl)}&omit_script=true&dnt=true`;
  const res = await fetch(endpoint, {
    headers: { "User-Agent": "fx.nyptid.com scraper/1.0" }
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text = clean(String(data.html || "").replace(/<[^>]+>/g, " "), 2000);
  return {
    text,
    author: data.author_name || "",
    author_url: data.author_url || ""
  };
}

function relevant(blob) {
  return RELEVANT.test(blob || "");
}

function toRss(items) {
  const rows = (items || [])
    .slice(0, 80)
    .map((item) => {
      const title = `@${item.handle}: ${(item.text || "").slice(0, 180)}`;
      return `<item><title>${escapeXml(title)}</title><link>${escapeXml(item.url || "")}</link><guid>${escapeXml(item.id || item.url || "")}</guid><pubDate>${escapeXml(item.created_at || "")}</pubDate><description>${escapeXml(item.text || "")}</description></item>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>FX live</title><link>https://fx.nyptid.com/live</link><description>Unfiltered live receipts from x.com</description>${rows}</channel></rss>`;
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

const mem = {
  oil: { exp: 0, data: null },
  world: { exp: 0, data: null }
};

async function remember(slot, ttl, fn) {
  const now = Date.now();
  if (mem[slot].data && now < mem[slot].exp) return mem[slot].data;
  try {
    const data = await fn();
    mem[slot] = { exp: now + ttl, data };
    return data;
  } catch (err) {
    if (mem[slot].data) return mem[slot].data;
    throw err;
  }
}

function lastClose(result) {
  const closes = result?.indicators?.quote?.[0]?.close || [];
  for (let i = closes.length - 1; i >= 0; i -= 1) {
    if (closes[i] != null && Number.isFinite(Number(closes[i]))) return Number(closes[i]);
  }
  return null;
}

function tradingState(meta) {
  const now = Math.floor(Date.now() / 1000);
  const regular = meta?.currentTradingPeriod?.regular;
  if (regular && Number(regular.start) <= now && now < Number(regular.end)) return "OPEN";
  const state = String(meta?.marketState || "").toUpperCase();
  if (state === "REGULAR" || state === "OPEN") return "OPEN";
  return "CLOSED";
}

async function fetchQuote(symbol) {
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
  ];
  let lastErr;
  for (const endpoint of urls) {
    try {
      const r = await fetch(endpoint, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Accept: "application/json"
        }
      });
      if (!r.ok) throw new Error(String(r.status));
      const payload = await r.json();
      const result = payload.chart.result[0];
      const meta = result.meta;
      const price = Number(meta.regularMarketPrice ?? lastClose(result));
      const prev = Number(meta.chartPreviousClose || meta.previousClose || price);
      const change = prev ? ((price - prev) / prev) * 100 : 0;
      let ts = Number(meta.regularMarketTime || 0);
      if (ts && ts < 1e12) ts *= 1000;
      return {
        symbol,
        price,
        prev,
        change,
        currency: meta.currency || "USD",
        exchange: meta.fullExchangeName || meta.exchangeName || "",
        quoted_at: ts ? new Date(ts).toISOString() : new Date().toISOString(),
        state: tradingState(meta)
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("quote failed");
}

async function loadOil() {
  const [brent, wti] = await Promise.all([fetchQuote("BZ=F"), fetchQuote("CL=F")]);
  return {
    brent,
    wti,
    spread: Number((brent.price - wti.price).toFixed(2)),
    generated_at: new Date().toISOString(),
    source: "Yahoo Finance",
    note: "ICE Brent (BZ=F) and NYMEX WTI (CL=F) last print via Yahoo Finance. Futures. Not a licensed exchange feed."
  };
}

function rssTag(block, tag) {
  const re = new RegExp(
    `<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))\\s*</${tag}>`,
    "i"
  );
  const match = block.match(re);
  return decodeEntities((match && (match[1] || match[2])) || "").trim();
}

function rssLink(block) {
  const href = block.match(/<link[^>]+href=["']([^"']+)["']/i);
  if (href) return decodeEntities(href[1]).trim();
  return rssTag(block, "link");
}

const WORLD_FEEDS = [
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { name: "Guardian", url: "https://www.theguardian.com/world/rss" },
  { name: "NPR World", url: "https://feeds.npr.org/1004/rss.xml" },
  { name: "OilPrice", url: "https://oilprice.com/rss/main" },
  { name: "Google News", url: "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en" }
];

const SPORT_TITLE =
  /\b(us open|premier league|nba|nfl|mlb|nhl|wimbledon|alcaraz|federer|box score|kickoff)\b/i;

function stance(text) {
  const t = String(text || "").toLowerCase();
  const hate =
    /suspend|shadowban|tombstone|form letter|bot farm|paywall|censored|unban|appeal denied|hate this app|scam check|deepfake/;
  const like =
    /community notes|breaking first|love (x|twitter)|still the firehose|best place for news|following feed works|edit button/;
  const h = hate.test(t);
  const l = like.test(t);
  if (h && !l) return "hate";
  if (l && !h) return "like";
  return "neutral";
}

async function loadWorld() {
  const results = await Promise.all(
    WORLD_FEEDS.map(async (feed) => {
      try {
        const xml = await fetch(feed.url, {
          headers: {
            "User-Agent": "fx.nyptid.com desk/1.0",
            Accept: "application/rss+xml, application/xml, text/xml, */*"
          },
          signal: AbortSignal.timeout(8000)
        }).then((r) => r.text());
        return { feed, xml };
      } catch {
        return { feed, xml: "" };
      }
    })
  );

  const items = [];
  const seen = new Set();
  for (const { feed, xml } of results) {
    if (!xml) continue;
    const blocks = xml.split(/<item[\s>]/i).slice(1, 10);
    for (const block of blocks) {
      const rawTitle = clean(rssTag(block, "title"), 240);
      const url = clean(rssLink(block), 400);
      const date = rssTag(block, "pubDate") || rssTag(block, "updated") || rssTag(block, "dc:date");
      const source = clean(rssTag(block, "source"), 40) || feed.name;
      let title = rawTitle;
      if (source && title.toLowerCase().endsWith(` - ${source.toLowerCase()}`)) {
        title = title.slice(0, title.length - source.length - 3).trim();
      }
      if (!title || !url || !/^https?:\/\//i.test(url)) continue;
      if (/\/sports\//i.test(url) || SPORT_TITLE.test(title)) continue;
      const key = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const parsed = Date.parse(date);
      items.push({
        source,
        title,
        url,
        published: Number.isFinite(parsed) ? new Date(parsed).toISOString() : ""
      });
    }
  }
  items.sort((a, b) => Date.parse(b.published || 0) - Date.parse(a.published || 0));
  return { items: items.slice(0, 40), generated_at: new Date().toISOString() };
}

async function loadAlerts(env) {
  const [world, feed] = await Promise.all([
    remember("world", 20000, loadWorld).catch(() => ({ items: [], generated_at: new Date().toISOString() })),
    readList(env, "feed")
  ]);
  const items = [];
  for (const row of world.items || []) {
    items.push({
      id: `wire:${row.url}`,
      kind: "wire",
      source: row.source,
      handle: row.source,
      display_name: row.source,
      text: row.title,
      url: row.url,
      created_at: row.published || world.generated_at,
      stance: "neutral"
    });
  }
  for (const row of feed || []) {
    items.push({
      id: row.id,
      kind: "x",
      source: "X",
      handle: row.handle,
      display_name: row.display_name || row.handle,
      text: row.text,
      url: row.url,
      profile_url: row.profile_url,
      created_at: row.created_at,
      stance: stance(`${row.text} ${row.handle}`)
    });
  }
  items.sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0));
  return { items: items.slice(0, 80), generated_at: new Date().toISOString() };
}

function stripeCheckout(base, pledge) {
  if (!base) return null;
  try {
    const parsed = new URL(base);
    if (pledge?.email) parsed.searchParams.set("prefilled_email", pledge.email);
    if (pledge?.id) parsed.searchParams.set("client_reference_id", pledge.id);
    return parsed.toString();
  } catch {
    return base;
  }
}

function donateReady(env) {
  if (env.STRIPE_SECRET_KEY) return "checkout";
  if (env.STRIPE_PAYMENT_LINK) return "link";
  return null;
}

async function createStripeCheckout(env, pledge) {
  const mode = donateReady(env);
  if (mode === "checkout") {
    const cents = Math.round(Number(pledge.amount) * 100);
    const body = new URLSearchParams();
    body.set("mode", pledge.recurring ? "subscription" : "payment");
    body.set("success_url", "https://fx.nyptid.com/donate/thanks?session_id={CHECKOUT_SESSION_ID}");
    body.set("cancel_url", "https://fx.nyptid.com/donate");
    body.set("client_reference_id", pledge.id);
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", "usd");
    body.set("line_items[0][price_data][unit_amount]", String(cents));
    body.set("line_items[0][price_data][product_data][name]", "FX journalism");
    body.set(
      "line_items[0][price_data][product_data][description]",
      "Support genuine journalism on fx.nyptid.com"
    );
    if (pledge.recurring) body.set("line_items[0][price_data][recurring][interval]", "month");
    if (pledge.email) body.set("customer_email", pledge.email);
    body.set("metadata[pledge_id]", pledge.id);
    body.set("metadata[purpose]", "journalism");
    if (pledge.name) body.set("metadata[name]", pledge.name);
    if (pledge.note) body.set("metadata[note]", pledge.note.slice(0, 400));
    if (!pledge.recurring) body.set("payment_intent_data[description]", `FX journalism · ${pledge.id}`);
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
    const data = await res.json();
    if (!res.ok || !data.url) {
      throw new Error(data.error?.message || "Stripe checkout failed.");
    }
    return { url: data.url, mode: "checkout", session_id: data.id };
  }
  if (mode === "link") {
    return { url: stripeCheckout(env.STRIPE_PAYMENT_LINK, pledge), mode: "link", session_id: null };
  }
  return { url: null, mode: null, session_id: null };
}

async function ingestStatus(env, statusUrl, source, extra = {}, opts = {}) {
  const postUrl = xUrl(statusUrl);
  if (!STATUS.test(postUrl)) return { ok: false, reason: "Not an x.com/status URL." };
  const scraped = await scrapePost(postUrl);
  if (!scraped) return { ok: false, reason: "Could not fetch that post from X. Is it public?" };
  const handle =
    normalizeHandle(extra.handle, scraped.author_url || postUrl) ||
    normalizeHandle("", scraped.author_url || postUrl);
  const blob = `${scraped.text} ${extra.statement || ""} ${handle}`;
  if (opts.requireRelevant && !relevant(blob)) {
    return { ok: false, reason: "Post does not look like an X-platform receipt. This wall is for X itself." };
  }
  const item = asFeed(
    {
      id: crypto.randomUUID(),
      handle,
      display_name: extra.display_name || scraped.author || handle,
      text: extra.statement || scraped.text,
      url: postUrl,
      profile_url: `https://x.com/${handle}`,
      created_at: new Date().toISOString()
    },
    source
  );
  const added = await pushFeed(env, item);
  return { ok: true, item, added, scraped };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const PAGES = {
      "/exhibits": "/exhibits.html",
      "/case": "/case.html",
      "/hates": "/hates.html",
      "/people": "/people.html",
      "/proof": "/proof.html",
      "/live": "/live.html",
      "/desk": "/desk.html",
      "/donate": "/donate.html",
      "/donate/thanks": "/donate-thanks.html"
    };
    const cleanPath = url.pathname.replace(/\/+$/, "") || "/";
    const pageFile = PAGES[cleanPath];
    if (pageFile) {
      const page = await env.ASSETS.fetch(new URL(pageFile, request.url));
      const headers = new Headers(page.headers);
      headers.set("cache-control", "no-store, no-cache, must-revalidate, max-age=0");
      return new Response(page.body, { status: page.status, headers });
    }

    if (url.pathname === "/rss.xml" || url.pathname === "/api/rss") {
      if (request.method === "GET") {
        const feed = await readList(env, "feed");
        return new Response(toRss(feed), {
          headers: {
            "content-type": "application/rss+xml; charset=utf-8",
            "cache-control": "no-store"
          }
        });
      }
      if (request.method === "POST") {
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Send JSON." }, 400);
        }
        const feedUrl = clean(body.feed || body.url, 400);
        if (!/^https:\/\//i.test(feedUrl)) return json({ error: "Need an https RSS URL." }, 400);
        const xml = await fetch(feedUrl, { headers: { "User-Agent": "fx.nyptid.com scraper/1.0" } }).then((r) =>
          r.text()
        );
        const found = [...xml.matchAll(/https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]+\/status\/\d+/gi)].map(
          (m) => m[0]
        );
        const unique = [...new Set(found)].slice(0, 25);
        const ingested = [];
        for (const link of unique) {
          const result = await ingestStatus(env, link, "rss");
          if (result.ok && result.added) ingested.push(result.item);
        }
        return json({ ok: true, found: unique.length, ingested: ingested.length, items: ingested });
      }
    }

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/oil" && request.method === "GET") {
      try {
        return json(await remember("oil", 20000, loadOil));
      } catch (err) {
        return json({ error: "Oil quotes unavailable.", detail: String(err) }, 502);
      }
    }

    if (url.pathname === "/api/world" && request.method === "GET") {
      try {
        return json(await remember("world", 45000, loadWorld));
      } catch (err) {
        return json({ error: "Wire unavailable.", detail: String(err), items: [] }, 502);
      }
    }

    if (url.pathname === "/api/alerts" && request.method === "GET") {
      try {
        return json(await loadAlerts(env));
      } catch (err) {
        return json({ error: "Alerts unavailable.", detail: String(err), items: [] }, 502);
      }
    }

    if (url.pathname === "/api/ledger" && request.method === "GET") {
      try {
        const alerts = await loadAlerts(env);
        const live = (alerts.items || []).map((row) => ({
          id: row.id,
          kind: row.stance || "neutral",
          cat: row.kind === "x" ? "x" : "world",
          text: row.kind === "x" ? `@${row.handle}: ${row.text}` : row.text,
          url: row.url,
          source: row.source,
          created_at: row.created_at
        }));
        return json({ live, generated_at: alerts.generated_at });
      } catch (err) {
        return json({ error: "Ledger live unavailable.", detail: String(err), live: [] }, 502);
      }
    }

    if (url.pathname === "/api/desk" && request.method === "GET") {
      const [oilSettled, worldSettled, feed, alerts] = await Promise.all([
        remember("oil", 20000, loadOil).catch((err) => ({ error: "Oil quotes unavailable.", detail: String(err) })),
        remember("world", 20000, loadWorld).catch(() => ({ items: [], generated_at: new Date().toISOString() })),
        readList(env, "feed"),
        loadAlerts(env).catch(() => ({ items: [], generated_at: new Date().toISOString() }))
      ]);
      return json({
        oil: oilSettled,
        world: worldSettled.items || [],
        world_at: worldSettled.generated_at || new Date().toISOString(),
        receipts: (feed || []).slice(0, 8),
        alerts: alerts.items || [],
        generated_at: new Date().toISOString()
      });
    }

    if (url.pathname === "/api/donate" && request.method === "GET") {
      const mode = donateReady(env);
      return json({
        ready: Boolean(mode),
        mode,
        currency: "USD",
        purpose: "journalism",
        note: mode
          ? "Stripe checkout is live."
          : "Pledges are logged. Set STRIPE_SECRET_KEY on Worker fx to take payment."
      });
    }

    if (url.pathname === "/api/donate" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Send JSON." }, 400);
      }
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
        return json({ error: "Pick an amount between 1 and 100000." }, 400);
      }

      const ip = request.headers.get("CF-Connecting-IP") || "0";
      const rlKey = `rl:donate:${ip}`;
      const hits = Number((await env.PROOF.get(rlKey)) || "0");
      if (hits >= 12) return json({ error: "Slow down. Come back in an hour." }, 429);
      await env.PROOF.put(rlKey, String(hits + 1), { expirationTtl: 3600 });

      const pledge = {
        id: crypto.randomUUID(),
        amount,
        currency: "USD",
        purpose: "journalism",
        recurring: Boolean(body.recurring),
        email: clean(body.email, 120),
        name: clean(body.name, 80),
        note: clean(body.note, 500),
        created_at: new Date().toISOString()
      };
      const rows = await readList(env, "donations");
      rows.unshift(pledge);
      await writeList(env, "donations", rows);
      try {
        const checkout = await createStripeCheckout(env, pledge);
        return json({
          ok: true,
          pledge,
          stripe: checkout.url,
          mode: checkout.mode,
          session_id: checkout.session_id,
          ready: Boolean(checkout.url)
        });
      } catch (err) {
        return json({
          ok: true,
          pledge,
          stripe: null,
          ready: false,
          error: String(err.message || err)
        }, 502);
      }
    }

    if (url.pathname === "/api/feed" && request.method === "GET") {
      let feed = await readList(env, "feed");
      if (!feed.length) {
        const proofs = await readList(env, "proofs");
        feed = proofs.map((p) => asFeed(p, "proof"));
      }
      const since = url.searchParams.get("since");
      const items = since ? feed.filter((row) => row.created_at > since) : feed;
      return json({ items, live: true, generated_at: new Date().toISOString() });
    }

    if (url.pathname === "/api/feed" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Send JSON." }, 400);
      }
      const result = await ingestStatus(env, body.url || body.proof_url, body.source || "scrape", body);
      if (!result.ok) return json({ error: result.reason }, 400);
      return json({ ok: true, verified: true, item: result.item, added: result.added });
    }

    if (url.pathname === "/api/proof" && request.method === "GET") {
      const items = await readList(env, "proofs");
      return json({ items });
    }

    if (url.pathname === "/api/proof" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Send JSON." }, 400);
      }

      if (clean(body.company, 80) || clean(body.website, 80)) {
        return json({ ok: true, ignored: true });
      }

      const ip = request.headers.get("CF-Connecting-IP") || "0";
      const rlKey = `rl:${ip}`;
      const hits = Number((await env.PROOF.get(rlKey)) || "0");
      if (hits >= 8) return json({ error: "Slow down. Come back in an hour." }, 429);
      await env.PROOF.put(rlKey, String(hits + 1), { expirationTtl: 3600 });

      const profileUrl = xUrl(body.profile_url);
      const handle = normalizeHandle(body.handle, profileUrl);
      const proofUrl = xUrl(body.proof_url);
      const extras = String(body.extra_urls || "")
        .split(/[\s,]+/)
        .map(xUrl)
        .filter(Boolean)
        .slice(0, 6);
      const statement = clean(body.statement, 1200);
      const name = clean(body.display_name, 80);

      if (!profileUrl || !handle) {
        return json({ error: "Link a real X profile (x.com/yourhandle)." }, 400);
      }
      if (!STATUS.test(proofUrl)) {
        return json({ error: "Proof must be a public X post URL (x.com/handle/status/123)." }, 400);
      }
      if (statement.length < 12) {
        return json({ error: "Tell us what happened. Twelve characters, minimum." }, 400);
      }

      const result = await ingestStatus(
        env,
        proofUrl,
        "proof",
        {
          handle,
          statement,
          display_name: name || handle
        },
        { requireRelevant: true }
      );
      if (!result.ok) return json({ error: result.reason, verified: false }, 400);

      const item = {
        id: result.item.id,
        created_at: result.item.created_at,
        handle: result.item.handle,
        profile_url: result.item.profile_url,
        proof_url: proofUrl,
        extra_urls: extras,
        statement,
        display_name: result.item.display_name,
        verified: true
      };

      const items = await readList(env, "proofs");
      items.unshift(item);
      await writeList(env, "proofs", items);
      return json({ ok: true, verified: true, item });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "https://fx.nyptid.com",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          "cache-control": "no-store"
        }
      });
    }

    return json({ error: "Not found." }, 404);
  }
};
