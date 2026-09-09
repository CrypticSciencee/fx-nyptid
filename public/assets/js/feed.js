(() => {
  const root = document.getElementById("feed");
  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");
  const seen = new Set();
  let first = true;

  const esc = (s) =>
    String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);

  burger?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });

  function card(item, isNew) {
    const when = item.created_at ? new Date(item.created_at).toUTCString() : "";
    const url = item.url || item.proof_url || item.profile_url;
    const profile = item.profile_url || (item.handle ? `https://x.com/${item.handle}` : url);
    return `
      <article class="feed-item glass${isNew ? " new" : ""}" data-id="${esc(item.id)}">
        <div class="feed-meta">
          <a href="${esc(profile)}" target="_blank" rel="noopener noreferrer">@${esc(item.handle)}</a>
          <span>${esc(item.source || "live")} · ${esc(when)}</span>
        </div>
        <p>${esc(item.text || item.statement)}</p>
        <div class="pills">
          <a class="pill" href="${esc(profile)}" target="_blank" rel="noopener noreferrer">profile</a>
          ${url ? `<a class="pill" href="${esc(url)}" target="_blank" rel="noopener noreferrer">post</a>` : ""}
        </div>
      </article>`;
  }

  async function tick() {
    try {
      const res = await fetch("/api/feed", { cache: "no-store" });
      const data = await res.json();
      const items = data.items || [];
      if (!items.length && first) {
        root.innerHTML = `<div class="empty glass">Nothing live yet. File proof or push the scraper.</div>`;
        first = false;
        return;
      }
      const fresh = [];
      for (const item of items) {
        if (!item.id || seen.has(item.id)) continue;
        seen.add(item.id);
        fresh.push(item);
      }
      if (first) {
        items.forEach((item) => item.id && seen.add(item.id));
        root.innerHTML = items.map((item) => card(item, false)).join("");
        first = false;
        return;
      }
      if (fresh.length) {
        const wrap = document.createElement("div");
        wrap.innerHTML = fresh.map((item) => card(item, true)).join("");
        while (wrap.firstChild) root.prepend(wrap.lastChild);
      }
    } catch {
      if (first) {
        root.innerHTML = `<div class="empty glass">Feed is down. Retrying.</div>`;
        first = false;
      }
    }
  }

  tick();
  setInterval(tick, 4000);
})();
