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
      "/desk": "/desk.html"
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
        const xml = await fetch(feedUrl, { headers: { "User-Agent": "fx.nyptid.com scraper/1.0" } }).then((r) => r.text());
        const found = [...xml.matchAll(/https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]+\/status\/\d+/gi)].map((m) => m[0]);
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
      const quote = async (symbol) => {
        const r = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
          { headers: { "User-Agent": "Mozilla/5.0 fx.nyptid.com desk" } }
        );
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        const meta = j.chart.result[0].meta;
        const price = Number(meta.regularMarketPrice);
        const prev = Number(meta.chartPreviousClose || meta.previousClose || price);
        const change = prev ? ((price - prev) / prev) * 100 : 0;
        return { symbol, price, prev, change, currency: meta.currency || "USD" };
      };
      try {
        const [brent, wti] = await Promise.all([quote("BZ=F"), quote("CL=F")]);
        return json({
          brent,
          wti,
          generated_at: new Date().toISOString()
        });
      } catch (err) {
        return json({ error: "Oil quotes unavailable.", detail: String(err) }, 502);
      }
    }

    if (url.pathname === "/api/world" && request.method === "GET") {
      const feeds = [
        { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
        { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
        { name: "CNBC Energy", url: "https://www.cnbc.com/id/19854910/device/rss/rss.html" }
      ];
      const items = [];
      for (const feed of feeds) {
        try {
          const xml = await fetch(feed.url, {
            headers: { "User-Agent": "fx.nyptid.com desk/1.0" }
          }).then((r) => r.text());
          const blocks = xml.split(/<item[\s>]/i).slice(1, 7);
          for (const block of blocks) {
            const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i) || [])
              .filter(Boolean)
              .pop();
            const link = (block.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>|<link>(.*?)<\/link>/i) || [])
              .filter(Boolean)
              .pop();
            const date = (block.match(/<pubDate>(.*?)<\/pubDate>/i) || [])[1];
            if (title && link) {
              items.push({
                source: feed.name,
                title: clean(title, 220),
                url: clean(link, 400),
                published: date || ""
              });
            }
          }
        } catch {
          /* skip a dead feed */
        }
      }
      return json({ items, generated_at: new Date().toISOString() });
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
