(() => {
  const log = document.getElementById("chat-log");
  if (!log) return;

  const countEl = document.getElementById("onair-count");
  const pingEl = document.getElementById("onair-ping");
  const toast = document.getElementById("toast");
  const alertBtn = document.getElementById("enable-alerts");
  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");
  const seen = new Set();
  let filter = "all";
  let alertsOn = false;
  let stick = true;
  let timer = 0;

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

  function clock(iso) {
    const d = new Date(iso);
    if (!d.getTime()) return "";
    return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  }

  function initials(name) {
    return String(name || "?")
      .replace(/[^A-Za-z0-9 ]/g, "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  if (burger && !burger.dataset.bound) {
    burger.dataset.bound = "1";
    burger.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  log.addEventListener("scroll", () => {
    stick = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  });

  function row(item, isNew) {
    const kind = item.kind === "x" ? "x" : "wire";
    const who = item.display_name || item.handle || item.source || "wire";
    const href = item.url || item.profile_url || "#";
    const dek = item.dek || (kind === "x" ? `X · @${item.handle || who}` : `${item.source || "wire"} · named desk`);
    const when = clock(item.created_at);
    return `
      <a class="chat-row ${kind}${isNew ? " new" : ""}" data-id="${esc(item.id)}" data-kind="${kind}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">
        <div class="chat-av" aria-hidden="true">${esc(initials(who))}</div>
        <div class="chat-body">
          <div class="chat-meta">
            <b>${esc(who)}</b>
            <span class="chat-kind">${esc(kind === "x" ? "X filing" : "named wire")}</span>
            ${item.stance && item.stance !== "neutral" ? `<span>${esc(item.stance)}</span>` : ""}
          </div>
          <p>${esc(item.text || "")}</p>
          <div class="chat-dek">${esc(dek)}${when ? " · " + esc(when) : ""}</div>
        </div>
        <time class="chat-time">${esc(ago(item.created_at) || "now")}</time>
      </a>`;
  }

  function applyFilter() {
    log.querySelectorAll(".chat-row").forEach((el) => {
      el.hidden = filter !== "all" && el.dataset.kind !== filter;
    });
  }

  function setCount(n) {
    if (countEl) countEl.textContent = `${n} alerts`;
    document.title = n ? `Alerts · ${n} | FX` : "Alerts | FX";
  }

  function showToast(item) {
    if (!toast) return;
    toast.hidden = false;
    toast.textContent = `NEW  ${item.display_name || item.handle || item.source}`;
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => {
      toast.hidden = true;
    }, 3500);
    if (alertsOn && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(`FX · ${item.source || item.handle}`, { body: (item.text || "").slice(0, 140) });
      } catch {
        /* ignore */
      }
    }
  }

  function pinBottom() {
    if (stick) log.scrollTop = log.scrollHeight;
  }

  if (!log.querySelector(".chat-row")) {
    log.innerHTML = `<div class="empty">Pulling named wires…</div>`;
  }

  async function tick() {
    try {
      const res = await fetch("/api/alerts", { cache: "no-store" });
      const data = await res.json();
      const items = (data.items || []).slice().reverse();
      if (pingEl) pingEl.textContent = items.length ? "live" : "wire quiet";
      const fresh = [];
      for (const item of items) {
        if (!item.id || seen.has(item.id)) continue;
        seen.add(item.id);
        fresh.push(item);
      }
      if (fresh.length) {
        log.querySelector(".empty")?.remove();
        const wrap = document.createElement("div");
        wrap.innerHTML = fresh.map((item) => row(item, Boolean(log.querySelector(".chat-row")))).join("");
        while (wrap.firstChild) log.appendChild(wrap.firstChild);
        applyFilter();
        setCount(log.querySelectorAll(".chat-row").length);
        pinBottom();
        if (log.querySelectorAll(".chat-row").length > fresh.length) showToast(fresh[fresh.length - 1]);
        return;
      }
      if (!log.querySelector(".chat-row")) {
        log.innerHTML = items.length
          ? items.map((item) => row(item, false)).join("")
          : `<div class="empty">Wire is quiet. Retrying.</div>`;
        items.forEach((item) => item.id && seen.add(item.id));
        applyFilter();
        setCount(items.length);
        pinBottom();
      }
    } catch {
      if (pingEl) pingEl.textContent = "reconnect";
      if (!log.querySelector(".chat-row")) {
        log.innerHTML = `<div class="empty">Feed dropped. Retrying the wires.</div>`;
      }
    }
  }

  document.querySelectorAll("[data-chat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-chat]").forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
      filter = btn.dataset.chat;
      applyFilter();
    });
  });

  alertBtn?.addEventListener("click", async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    alertsOn = perm === "granted";
    alertBtn.textContent = alertsOn ? "Alerts on" : "Alerts blocked";
  });

  function tickClocks() {
    document.querySelectorAll("#clocks [data-tz]").forEach((el) => {
      const tz = el.dataset.tz;
      const city = el.dataset.city || tz;
      const t = new Date().toLocaleTimeString("en-GB", {
        timeZone: tz,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
      el.innerHTML = `<b>${city}</b> ${t}`;
    });
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

  if (!document.getElementById("desk-stamp")) {
    tickClocks();
    setInterval(tickClocks, 1000);
  }
  play();
})();
