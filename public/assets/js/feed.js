(() => {
  const root = document.getElementById("feed");
  const countEl = document.getElementById("onair-count");
  const pingEl = document.getElementById("onair-ping");
  const statWire = document.getElementById("stat-wire");
  const statPing = document.getElementById("stat-ping");
  const track = document.getElementById("breaking-track");
  const toast = document.getElementById("toast");
  const alertBtn = document.getElementById("enable-alerts");
  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");
  const seen = new Set();
  let first = true;
  let total = 0;
  let timer = 0;
  let lastPing = 0;
  let alerts = false;

  const esc = (s) =>
    String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);

  function ago(iso) {
    const then = new Date(iso).getTime();
    if (!then) return "";
    const s = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.round(m / 60);
    if (h < 48) return `${h}h`;
    return `${Math.round(h / 24)}d`;
  }

  function stamp(iso) {
    const d = new Date(iso);
    if (!d.getTime()) return "--------";
    return d.toISOString().slice(11, 19) + "Z";
  }

  burger?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });

  function card(item, isNew) {
    const url = item.url || item.proof_url || item.profile_url;
    const handle = item.handle || "unknown";
    const src = item.source || "live";
    return `
      <article class="log-row${isNew ? " new" : ""}" data-id="${esc(item.id)}" data-ts="${esc(item.created_at || "")}">
        <time datetime="${esc(item.created_at || "")}">${esc(stamp(item.created_at))}</time>
        <a class="log-handle" href="https://x.com/${esc(handle)}" target="_blank" rel="noopener noreferrer">@${esc(handle)}</a>
        <p>${esc(item.text || item.statement)}</p>
        <span class="log-src">${esc(src)}</span>
        ${url ? `<a class="log-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">open</a>` : ""}
      </article>`;
  }

  function setCount(n) {
    total = n;
    if (countEl) countEl.textContent = `${n} on the wire`;
    if (statWire) statWire.textContent = String(n);
    document.title = n ? `LIVE · ${n} | FX` : "LIVE | FX";
  }

  function setPing() {
    lastPing = Date.now();
    if (pingEl) pingEl.textContent = "updated just now";
    if (statPing) statPing.textContent = "now";
  }

  function showToast(item) {
    if (!toast) return;
    toast.hidden = false;
    toast.textContent = `NEW  @${item.handle}  ${(item.text || "").slice(0, 90)}`;
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => {
      toast.hidden = true;
    }, 5000);
    if (alerts && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(`FX · @${item.handle}`, { body: (item.text || "").slice(0, 140) });
      } catch {
        /* ignore */
      }
    }
  }

  function renderTicker(items) {
    if (!track) return;
    const bits = items
      .slice(0, 12)
      .map((item) => `<span>@${esc(item.handle)} · ${esc((item.text || "").slice(0, 110))}</span>`);
    track.innerHTML = bits.concat(bits).join("<span class='breaking-gap'>///</span>");
  }

  function tickClocks() {
    document.querySelectorAll("#clocks [data-tz]").forEach((el) => {
      const tz = el.dataset.tz;
      const now = new Date();
      if (tz === "UTC") {
        el.textContent = `UTC ${now.toISOString().slice(11, 19)}`;
        return;
      }
      const label = { "America/New_York": "ET", "America/Los_Angeles": "PT", "Europe/London": "LT" }[tz] || tz;
      el.textContent = `${label} ${now.toLocaleTimeString("en-GB", { timeZone: tz, hour12: false })}`;
    });
  }

  async function tick() {
    try {
      const res = await fetch("/api/feed", { cache: "no-store" });
      const data = await res.json();
      const items = data.items || [];
      setPing();
      renderTicker(items);
      if (!items.length && first) {
        root.innerHTML = `<div class="empty">Wire is quiet. File proof or push the scraper.</div>`;
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
        showToast(fresh[0]);
      }
      root.querySelectorAll(".log-row[data-ts] time").forEach((el) => {
        const ts = el.closest(".log-row")?.dataset.ts;
        if (ts) el.title = ago(ts) + " ago";
      });
    } catch {
      if (pingEl) pingEl.textContent = "reconnect";
      if (first) {
        root.innerHTML = `<div class="empty">Feed is down. Retrying.</div>`;
        first = false;
      }
    }
  }

  alertBtn?.addEventListener("click", async () => {
    if (!("Notification" in window)) {
      alertBtn.textContent = "Alerts blocked";
      return;
    }
    const perm = await Notification.requestPermission();
    alerts = perm === "granted";
    alertBtn.textContent = alerts ? "Alerts on" : "Alerts blocked";
  });

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
  tickClocks();
  setInterval(tickClocks, 1000);
  play();
})();
