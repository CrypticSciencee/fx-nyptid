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
  if (feed.some((row) => row.id === item.id || (row.url && row.url === item.url))) return;
  feed.unshift(item);
  await writeList(env, "feed", feed);
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
      "/live": "/live.html"
    };
    const cleanPath = url.pathname.replace(/\/+$/, "") || "/";
    const pageFile = PAGES[cleanPath];
    if (pageFile) {
      const page = await env.ASSETS.fetch(new URL(pageFile, request.url));
      const headers = new Headers(page.headers);
      headers.set("cache-control", "no-store, no-cache, must-revalidate, max-age=0");
      return new Response(page.body, { status: page.status, headers });
    }

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/feed" && request.method === "GET") {
      let feed = await readList(env, "feed");
      if (!feed.length) {
        const proofs = await readList(env, "proofs");
        feed = proofs.map((p) => asFeed(p, "proof"));
      }
      return json({ items: feed, live: true });
    }

    if (url.pathname === "/api/feed" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Send JSON." }, 400);
      }
      const postUrl = xUrl(body.url || body.proof_url);
      const handle = normalizeHandle(body.handle, body.author_url || body.profile_url || postUrl);
      const text = clean(body.text || body.statement, 1200);
      if (!handle || !STATUS.test(postUrl) || text.length < 8) {
        return json({ error: "Need handle, x.com/status URL, and text." }, 400);
      }
      const item = asFeed(
        {
          id: crypto.randomUUID(),
          handle,
          display_name: clean(body.author || body.display_name, 80) || handle,
          text,
          url: postUrl,
          profile_url: `https://x.com/${handle}`,
          created_at: new Date().toISOString()
        },
        "scrape"
      );
      await pushFeed(env, item);
      return json({ ok: true, item });
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

      const item = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        handle,
        profile_url: `https://x.com/${handle}`,
        proof_url: proofUrl,
        extra_urls: extras,
        statement,
        display_name: name || handle
      };

      const items = await readList(env, "proofs");
      items.unshift(item);
      await writeList(env, "proofs", items);
      await pushFeed(env, asFeed(item, "proof"));
      return json({ ok: true, item });
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
