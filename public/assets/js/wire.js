(() => {
  const track = document.getElementById("fx-wire-track");
  const marquee = document.getElementById("marquee-track");
  if (!track && !marquee) return;

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
    if (s < 45) return "now";
    if (s < 60) return `${s}s`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.round(m / 60);
    if (h < 48) return `${h}h`;
    return `${Math.round(h / 24)}d`;
  }

  function bits(items) {
    return (items || []).slice(0, 24).map((it) => {
      const who = it.source || it.handle || "wire";
      const age = ago(it.created_at);
      const href = it.url || "#";
      return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer"><b>${esc(who)}</b>${age ? " · " + esc(age) : ""} — ${esc(it.text || "")}</a>`;
    });
  }

  function fillWire(items) {
    if (!track) return;
    const row = bits(items);
    if (!row.length) {
      track.textContent = "Wire is quiet — named desks reconnecting…";
      track.classList.add("paused");
      return;
    }
    track.classList.remove("paused");
    const html = row.join("");
    track.innerHTML = `<div class="fx-wire-seq">${html}</div><div class="fx-wire-seq" aria-hidden="true">${html}</div>`;
  }

  function fillMarquee(items) {
    if (!marquee) return;
    const row = (items || []).slice(0, 16);
    if (!row.length) return;
    const parts = row
      .map((it) => {
        const who = it.source || it.handle || "FX";
        return `<span><b>${esc(who)}</b> ${esc((it.text || "").slice(0, 88))}</span><span class="dot">◆</span>`;
      })
      .join("");
    marquee.innerHTML = parts + parts;
  }

  async function tick() {
    try {
      const res = await fetch("/api/alerts", { cache: "no-store" });
      const data = await res.json();
      const items = data.items || [];
      fillWire(items);
      fillMarquee(items);
    } catch {
      if (track && !track.querySelector(".fx-wire-seq")) {
        track.textContent = "Reconnecting to the wire…";
      }
    }
  }

  tick();
  setInterval(tick, 4000);
})();
