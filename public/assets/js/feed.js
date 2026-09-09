(() => {
  const root = document.getElementById("feed");
  const countEl = document.getElementById("onair-count");
  const pingEl = document.getElementById("onair-ping");
  const toast = document.getElementById("toast");
  const alertBtn = document.getElementById("enable-alerts");
  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");
  const seen = new Set();
  let first = true;
  let total = 0;
  let timer = 0;
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
    if (s < 60) return `${s}s ago`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 48) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  }

  burger?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });

  function card(item, isNew) {
    const url = item.url || item.proof_url || item.profile_url;
    const handle = item.handle || "unknown";
    const profile = item.profile_url || `https://x.com/${handle}`;
    return `
      <article class="proof-card glass${isNew ? " new" : ""}" data-id="${esc(item.id)}">
        <div class="kicker">@${esc(handle)} · ${esc(item.source || "live")} · ${esc(ago(item.created_at))}</div>
        <p>${esc(item.text || item.statement)}</p>
        <div class="pills">
          ${url ? `<a class="pill" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open post</a>` : ""}
          <a class="pill ghost" href="${esc(profile)}" target="_blank" rel="noopener noreferrer">Profile</a>
        </div>
      </article>`;
  }

  function setCount(n) {
    total = n;
    if (countEl) countEl.textContent = `${n} on the wire`;
    document.title = n ? `LIVE · ${n} | FX` : "LIVE | FX";
  }

  function showToast(item) {
    if (!toast) return;
    toast.hidden = false;
    toast.textContent = `NEW  @${item.handle}`;
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => {
      toast.hidden = true;
    }, 4000);
    if (alerts && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(`FX · @${item.handle}`, { body: (item.text || "").slice(0, 140) });
      } catch {
        /* ignore */
      }
    }
  }

  async function tick() {
    try {
      const res = await fetch("/api/feed", { cache: "no-store" });
      const data = await res.json();
      const items = data.items || [];
      if (pingEl) pingEl.textContent = "updated just now";
      if (!items.length && first) {
        root.innerHTML = `<div class="empty glass">Wire is quiet. File proof or push the scraper.</div>`;
        setCount(0);
        first = false;
        return;
      }
      if (first) {
        items.forEach((item) => item.id && seen.add(item.id));
        root.innerHTML = `<div class="people-grid">${items.map((item) => card(item, false)).join("")}</div>`;
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
      const grid = root.querySelector(".people-grid") || root;
      if (fresh.length) {
        const wrap = document.createElement("div");
        wrap.innerHTML = fresh.map((item) => card(item, true)).join("");
        const nodes = [];
        while (wrap.firstChild) nodes.push(wrap.firstChild);
        nodes.reverse().forEach((node) => grid.prepend(node));
        setCount(total + fresh.length);
        showToast(fresh[0]);
      }
    } catch {
      if (pingEl) pingEl.textContent = "reconnect";
      if (first) {
        root.innerHTML = `<div class="empty glass">Feed is down. Retrying.</div>`;
        first = false;
      }
    }
  }

  alertBtn?.addEventListener("click", async () => {
    if (!("Notification" in window)) return;
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
  tickClocks();
  setInterval(tickClocks, 1000);
  play();
})();
