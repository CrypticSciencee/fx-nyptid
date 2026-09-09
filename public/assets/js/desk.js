(() => {
  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");
  burger?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });

  const WAR_START = Date.UTC(2026, 1, 28);

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }

  function ago(value) {
    const ms = Date.now() - Date.parse(value || 0);
    if (!Number.isFinite(ms) || ms < 0) return "";
    const sec = Math.floor(ms / 1000);
    if (sec < 20) return "just now";
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 48) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  }

  function money(n) {
    return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function chg(n) {
    const v = Number(n);
    const sign = v >= 0 ? "+" : "";
    return `${sign}${v.toFixed(2)}%`;
  }

  function setChg(el, n) {
    if (!el) return;
    const v = Number(n);
    el.classList.toggle("up", v >= 0);
    el.classList.toggle("down", v < 0);
  }

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
      el.innerHTML = `<b>${esc(city)}</b> ${t}`;
    });
  }

  function paintOil(oil) {
    if (!oil || oil.error) {
      const market = document.getElementById("desk-market");
      if (market) market.textContent = "quotes offline";
      return;
    }
    if (oil.brent) {
      document.getElementById("brent-price").textContent = `$${money(oil.brent.price)}`;
      const el = document.getElementById("brent-chg");
      el.textContent = `${chg(oil.brent.change)} · ${oil.brent.state === "OPEN" ? "session open" : "last print"}`;
      setChg(el, oil.brent.change);
      const src = document.getElementById("brent-src");
      if (src) src.textContent = `${oil.brent.exchange || "Yahoo Finance"} · ${ago(oil.brent.quoted_at) || "live"}`;
    }
    if (oil.wti) {
      document.getElementById("wti-price").textContent = `$${money(oil.wti.price)}`;
      const el = document.getElementById("wti-chg");
      el.textContent = `${chg(oil.wti.change)} · ${oil.wti.state === "OPEN" ? "session open" : "last print"}`;
      setChg(el, oil.wti.change);
      const src = document.getElementById("wti-src");
      if (src) src.textContent = `${oil.wti.exchange || "Yahoo Finance"} · ${ago(oil.wti.quoted_at) || "live"}`;
    }
    if (oil.spread != null) {
      const sign = oil.spread >= 0 ? "" : "−";
      document.getElementById("spread-price").textContent = `$${sign}${money(Math.abs(oil.spread))}`;
    }
    const session = document.getElementById("session-state");
    const sessionChg = document.getElementById("session-chg");
    const sessionSrc = document.getElementById("session-src");
    const open = oil.brent?.state === "OPEN" || oil.wti?.state === "OPEN";
    if (session) session.textContent = open ? "OPEN" : "CLOSED";
    if (sessionChg) sessionChg.textContent = open ? "futures in session" : "weekend / halt / close";
    if (sessionSrc) {
      const stamp = oil.brent?.quoted_at || oil.wti?.quoted_at;
      sessionSrc.textContent = stamp ? `print ${ago(stamp)}` : "Yahoo Finance";
    }
    const note = document.getElementById("oil-note");
    if (note && oil.note) note.textContent = oil.note;
    const market = document.getElementById("desk-market");
    if (market) {
      const print = oil.brent?.quoted_at || oil.generated_at;
      market.textContent = `Yahoo ${open ? "OPEN" : "CLOSED"} · Brent print ${ago(print) || "now"}`;
    }
  }

  function fillTicker(items) {
    const track = document.getElementById("breaking-track");
    if (!track) return;
    if (!items.length) {
      track.textContent = "Wire is quiet.";
      track.classList.add("paused");
      return;
    }
    const bits = items.slice(0, 12).map((it) => {
      const age = ago(it.published);
      return `<span>${esc(it.source)}${age ? " · " + esc(age) : ""} — ${esc(it.title)}</span>`;
    });
    const row = bits.join("");
    track.classList.remove("paused");
    track.innerHTML = `<div class="fx-ticker-seq">${row}</div><div class="fx-ticker-seq" aria-hidden="true">${row}</div>`;
  }

  function paintWorld(items, worldAt) {
    const list = items || [];
    fillTicker(list);
    const wire = document.getElementById("wire");
    if (wire) {
      wire.innerHTML = list.length
        ? list
            .map(
              (it) => `
        <a class="proof-card glass" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">
          <div class="kicker">${esc(it.source)} · ${esc(ago(it.published) || "undated")}</div>
          <p>${esc(it.title)}</p>
        </a>`
            )
            .join("")
        : `<div class="empty glass">Wire is quiet.</div>`;
    }
    const age = document.getElementById("desk-wire-age");
    if (age) age.textContent = list.length ? `${list.length} on the wire · ${ago(worldAt) || "now"}` : "wire quiet";
  }

  function paintReceipts(items) {
    const root = document.getElementById("receipts");
    if (!root) return;
    const list = items || [];
    root.innerHTML = list.length
      ? list
          .map(
            (it) => `
        <a class="proof-card glass desk-receipt" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">
          <div class="kicker">@${esc(it.handle)} · ${esc(ago(it.created_at) || "")}</div>
          <p>${esc((it.text || "").slice(0, 220))}</p>
        </a>`
          )
          .join("")
      : `<div class="empty glass">No FX receipts yet. <a href="/proof">File one</a>.</div>`;
  }

  function paintStamp(iso) {
    const stamp = document.getElementById("desk-stamp");
    if (stamp) stamp.textContent = `refreshed ${ago(iso) || "now"}`;
    const day = Math.max(1, Math.floor((Date.now() - WAR_START) / 86400000) + 1);
    const hd = document.getElementById("hormuz-day");
    if (hd) hd.textContent = `Day ${day} · Hormuz clock`;
  }

  async function loadDesk() {
    const res = await fetch("/api/desk", { cache: "no-store" });
    const data = await res.json();
    paintOil(data.oil);
    paintWorld(data.world, data.world_at);
    paintReceipts(data.receipts);
    paintStamp(data.generated_at);
  }

  tickClocks();
  setInterval(tickClocks, 1000);
  loadDesk().catch(() => {
    const market = document.getElementById("desk-market");
    if (market) market.textContent = "desk offline";
  });
  setInterval(() => {
    loadDesk().catch(() => {});
  }, 20000);
})();
