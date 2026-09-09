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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/proof" && request.method === "GET") {
      const raw = await env.PROOF.get("proofs");
      const items = raw ? JSON.parse(raw) : [];
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
        return json({ error: "Proof must be a public X post URL (x.com/handle/status/…)." }, 400);
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

      const raw = await env.PROOF.get("proofs");
      const items = raw ? JSON.parse(raw) : [];
      items.unshift(item);
      await env.PROOF.put("proofs", JSON.stringify(items.slice(0, 500)));
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
