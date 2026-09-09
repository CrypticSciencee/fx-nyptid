(() => {
  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");
  burger?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });

  const TZ = [
    ["Asia/Jerusalem", "Jerusalem", "IST"],
    ["Asia/Tehran", "Tehran", "IRST"],
    ["America/New_York", "Washington", "ET"],
    ["Europe/Moscow", "Moscow", "MSK"],
    ["Asia/Shanghai", "Beijing", "CST"],
    ["America/Los_Angeles", "San Francisco", "PT"]
  ];

  function tickClocks() {
    document.querySelectorAll("#clocks [data-tz]").forEach((el) => {
      const tz = el.dataset.tz;
      const row = TZ.find((t) => t[0] === tz);
      const label = row ? `${row[1]}` : tz;
      const t = new Date().toLocaleTimeString("en-GB", { timeZone: tz, hour12: false });
      el.textContent = `${label} ${t}`;
    });
  }

  function money(n) {
    return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function chg(n) {
    const v = Number(n);
    const sign = v >= 0 ? "+" : "";
    return `${sign}${v.toFixed(2)}%`;
  }

  async function loadOil() {
    const res = await fetch("/api/oil", { cache: "no-store" });
    const data = await res.json();
    if (data.brent) {
      document.getElementById("brent-price").textContent = `$${money(data.brent.price)}`;
      const el = document.getElementById("brent-chg");
      el.textContent = `${chg(data.brent.change)} · global benchmark`;
      el.style.color = data.brent.change >= 0 ? "#7dff9a" : "var(--ember)";
    }
    if (data.wti) {
      document.getElementById("wti-price").textContent = `$${money(data.wti.price)}`;
      const el = document.getElementById("wti-chg");
      el.textContent = `${chg(data.wti.change)} · US benchmark`;
      el.style.color = data.wti.change >= 0 ? "#7dff9a" : "var(--ember)";
    }
    const start = Date.UTC(2026, 2, 3);
    const day = Math.max(1, Math.floor((Date.now() - start) / 86400000) + 1);
    const hd = document.getElementById("hormuz-day");
    if (hd) hd.textContent = `Day ${day}`;
    const stamp = document.getElementById("desk-stamp");
    if (stamp) stamp.textContent = `Last refresh: ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`;
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }

  async function loadWorld() {
    const res = await fetch("/api/world", { cache: "no-store" });
    const data = await res.json();
    const items = data.items || [];
    const track = document.getElementById("breaking-track");
    if (track && items.length) {
      const bits = items.slice(0, 10).map((it) => `<span>${esc(it.source)} · ${esc(it.title)}</span>`);
      track.innerHTML = bits.concat(bits).join("<span class='breaking-gap'>///</span>");
    }
    const wire = document.getElementById("wire");
    if (wire) {
      wire.innerHTML = items.length
        ? items
            .map(
              (it) => `
        <a class="proof-card glass" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">
          <div class="kicker">${esc(it.source)} · ${esc(it.published)}</div>
          <p>${esc(it.title)}</p>
        </a>`
            )
            .join("")
        : `<div class="empty glass">Wire is quiet.</div>`;
    }
  }

  tickClocks();
  setInterval(tickClocks, 1000);
  loadOil().catch(() => {});
  loadWorld().catch(() => {});
  setInterval(() => {
    loadOil().catch(() => {});
  }, 60000);
  setInterval(() => {
    loadWorld().catch(() => {});
  }, 120000);
})();
