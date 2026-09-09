(() => {
  const root = document.getElementById("feed");
  const countEl = document.getElementById("onair-count");
  const pingEl = document.getElementById("onair-ping");
  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");
  const seen = new Set();
  let first = true;
  let total = 0;
  let timer = 0;
  let lastPing = 0;

  const esc = (s) =>
    String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);

  const initials = (handle) =>
    String(handle || "?")
      .replace(/^@/, "")
      .slice(0, 2)
      .toUpperCase();

  const sourceLabel = (source) => {
    if (source === "proof") return "filing";
    if (source === "scrape") return "post";
    return source || "live";
  };

  function ago(iso) {
    const then = new Date(iso).getTime();
    if (!then) return "";
    const s = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 48) return `${h}h ago`;
    const d = Math.round(h / 24);
    return `${d}d ago`;
  }

  burger?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });

  function card(item, isNew) {
    const url = item.url || item.proof_url || item.profile_url;
    const profile = item.profile_url || (item.handle ? `https://x.com/${item.handle}` : url);
    const handle = item.handle || "unknown";
    return `
      <article class="feed-item${isNew ? " new" : ""}" data-id="${esc(item.id)}" data-ts="${esc(item.created_at || "")}">
        <div class="feed-av" aria-hidden="true">${esc(initials(handle))}</div>
        <div class="feed-body">
          <div class="feed-meta">
            <a href="${esc(profile)}" target="_blank" rel="noopener noreferrer">@${esc(handle)}</a>
            <span><span class="src">${esc(sourceLabel(item.source))}</span> · <time datetime="${esc(item.created_at || "")}">${esc(ago(item.created_at))}</time></span>
          </div>
          <p>${esc(item.text || item.statement)}</p>
          <div class="pills">
            ${url ? `<a class="pill" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open post</a>` : ""}
            <a class="pill ghost" href="${esc(profile)}" target="_blank" rel="noopener noreferrer">Profile</a>
          </div>
        </div>
      </article>`;
  }

  function setCount(n) {
    total = n;
    if (countEl) countEl.textContent = `${n} on the wire`;
    document.title = n ? `LIVE · ${n} | FX` : "LIVE | FX";
  }

  function setPing() {
    lastPing = Date.now();
    if (pingEl) pingEl.textContent = "updated just now";
  }

  function refreshTimes() {
    root.querySelectorAll(".feed-item[data-ts] time").forEach((el) => {
      const ts = el.closest(".feed-item")?.dataset.ts;
      if (ts) el.textContent = ago(ts);
    });
    if (pingEl && lastPing) {
      const s = Math.max(0, Math.round((Date.now() - lastPing) / 1000));
      pingEl.textContent = s < 2 ? "updated just now" : `ping ${s}s ago`;
    }
  }

  async function tick() {
    try {
      const res = await fetch("/api/feed", { cache: "no-store" });
      const data = await res.json();
      const items = data.items || [];
      setPing();
      if (!items.length && first) {
        root.innerHTML = `<div class="empty">Nothing live yet. File proof or push the scraper.</div>`;
        setCount(0);
        first = false;
        return;
      }
      if (first) {
        items.forEach((item) => item.id && seen.add(item.id));
        root.innerHTML = items.map((item) => card(item, false)).join("");
        setCount(items.length);
        first = false;
        return;
      }
      const fresh = [];
      for (const item of items) {
        if (!item.id || seen.has(item.id)) continue;
        seen.add(item.id);
        fresh.push(item);
      }
      if (fresh.length) {
        const wrap = document.createElement("div");
        wrap.innerHTML = fresh.map((item) => card(item, true)).join("");
        const nodes = [];
        while (wrap.firstChild) nodes.push(wrap.firstChild);
        nodes.reverse().forEach((node) => root.prepend(node));
        setCount(total + fresh.length);
      }
      refreshTimes();
    } catch {
      if (pingEl) pingEl.textContent = "reconnect";
      if (first) {
        root.innerHTML = `<div class="empty">Feed is down. Retrying.</div>`;
        first = false;
      }
    }
  }

  function play() {
    if (timer) return;
    tick();
    timer = setInterval(tick, 4000);
  }

  function pause() {
    clearInterval(timer);
    timer = 0;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
    else play();
  });

  play();
})();
