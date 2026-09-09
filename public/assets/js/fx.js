(() => {
  const data = window.FX || { hates: [], likes: [], evidence: [], people: [], timeline: [] };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const esc = (s) =>
    String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);

  const initials = (name) =>
    name
      .replace(/[^A-Za-z0-9 ]/g, "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();

  const pill = (p) => {
    const href = p.post || p.url;
    return `<a class="pill${p.post ? "" : " ghost"}" href="${href}" target="_blank" rel="noopener noreferrer">@${p.handle}</a>`;
  };

  const peoplePills = (item) => {
    const row = [item.poster, item.quoted, ...(item.also || [])].filter(Boolean);
    const seen = new Set();
    return row
      .filter((p) => (seen.has(p.handle) ? false : seen.add(p.handle)))
      .map(pill)
      .join("");
  };

  function renderEvidence() {
    const root = $("#exhibit-grid");
    if (!root) return;
    root.innerHTML = data.evidence
      .map(
        (e) => `
      <article class="shot glass">
        <figure>
          <button class="frame-hit" type="button" data-id="${e.id}" aria-label="Open ${e.kicker}">
            <div class="frame"><img src="/assets/evidence/${e.file}" alt="${e.charge}" loading="lazy"></div>
          </button>
          <figcaption>
            <div class="kicker">${e.kicker}</div>
            <div class="charge">${e.charge}</div>
            <div class="pills">${peoplePills(e)}</div>
          </figcaption>
        </figure>
      </article>`
      )
      .join("");

    root.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".frame-hit");
      if (!btn) return;
      openLb(btn.dataset.id);
    });
  }

  function openLb(id) {
    const e = data.evidence.find((x) => x.id === id);
    const lb = $("#lightbox");
    if (!e || !lb) return;
    $("#lb-img").src = `/assets/evidence/${e.file}`;
    $("#lb-img").alt = e.charge;
    $("#lb-kicker").textContent = e.kicker;
    $("#lb-charge").textContent = e.charge;
    $("#lb-note").textContent = e.note;
    $("#lb-pills").innerHTML = peoplePills(e);
    const poster = `<a class="btn solid" href="${e.poster.post}" target="_blank" rel="noopener noreferrer">Open post · @${e.poster.handle}</a>`;
    const quoted = e.quoted
      ? `<a class="btn" href="${e.quoted.post || e.quoted.url}" target="_blank" rel="noopener noreferrer">Quoted · @${e.quoted.handle}</a>`
      : "";
    $("#lb-actions").innerHTML = poster + quoted;
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    $("#lb-close")?.focus();
  }

  function closeLb() {
    const lb = $("#lightbox");
    if (!lb) return;
    lb.hidden = true;
    document.body.style.overflow = "";
  }

  function renderTimeline() {
    const el = $("#timeline");
    if (!el) return;
    el.innerHTML = data.timeline
      .map((t) => {
        const inner = `<time datetime="${t.t}">${t.t}</time><div><h4>${t.title}</h4><p>${t.body}</p></div>`;
        return t.url
          ? `<li><a class="tl-row" href="${t.url}" target="_blank" rel="noopener noreferrer">${inner}</a></li>`
          : `<li><div class="tl-row">${inner}</div></li>`;
      })
      .join("");
  }

  function renderPeople() {
    const el = $("#people-grid");
    if (!el) return;
    el.innerHTML = data.people
      .map(
        (p) => `
      <a class="person glass" href="${p.url}" target="_blank" rel="noopener noreferrer">
        <div class="avatar" aria-hidden="true">${initials(p.name)}</div>
        <strong>${p.name}</strong>
        <span>@${p.handle}</span>
        <em>${p.role}</em>
        <div class="badge ${p.status === "suspended" ? "down" : ""}">${p.status === "suspended" ? "Account suspended" : "Open profile"}</div>
      </a>`
      )
      .join("");
  }

  const allRows = [
    ...(data.hates || []).map((h, i) => ({ n: i + 1, cat: h[0], text: h[1], kind: "hate" })),
    ...(data.likes || []).map((h, i) => ({ n: i + 1, cat: h[0], text: h[1], kind: "like" }))
  ];

  let filter = "hate";
  let query = "";

  function renderLedger() {
    if (!$("#ledger-list")) return;
    const list = allRows.filter((r) => {
      const catOk =
        filter === "all" ||
        (filter === "hate" && r.kind === "hate") ||
        (filter === "like" && r.kind === "like") ||
        r.cat === filter;
      const q = query.trim().toLowerCase();
      const textOk = !q || r.text.toLowerCase().includes(q) || r.cat.includes(q);
      return catOk && textOk;
    });
    const hateCount = $("#hate-count");
    const likeCount = $("#like-count");
    const shown = $("#shown-count");
    if (hateCount) hateCount.textContent = String((data.hates || []).length);
    if (likeCount) likeCount.textContent = String((data.likes || []).length);
    if (shown) shown.textContent = String(list.length);
    $("#ledger-list").innerHTML = list.length
      ? list
          .map(
            (r) => `
        <article class="reason ${r.kind}">
          <div class="idx">${r.kind === "like" ? "LIKE" : String(r.n).padStart(3, "0")}</div>
          <div>
            <p>${r.text}</p>
            <span class="tag">${r.kind === "like" ? "why they stay" : r.cat}</span>
          </div>
        </article>`
          )
          .join("")
      : `<div class="empty glass">No receipts match that filter.</div>`;
  }

  function bindLedger() {
    if (!$("#ledger-list")) return;
    $$("[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("[data-filter]").forEach((b) => b.classList.remove("on"));
        btn.classList.add("on");
        filter = btn.dataset.filter;
        renderLedger();
      });
    });
    $("#search")?.addEventListener("input", (e) => {
      query = e.target.value;
      renderLedger();
    });
  }

  function spotlight() {
    document.addEventListener("pointermove", (e) => {
      const el = e.target.closest(".glass");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  }

  function counters() {
    const els = $$("[data-count]");
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target;
          const end = Number(el.dataset.count);
          const suffix = el.dataset.suffix || "";
          const prefix = el.dataset.prefix || "";
          const start = performance.now();
          const dur = 1100;
          const tick = (t) => {
            const p = Math.min(1, (t - start) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = prefix + Math.round(end * eased).toLocaleString() + suffix;
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          io.unobserve(el);
        });
      },
      { threshold: 0.4 }
    );
    els.forEach((el) => io.observe(el));
  }

  function nav() {
    const nav = $("#nav");
    const burger = $("#burger");
    burger?.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    $$(".nav-links a").forEach((a) =>
      a.addEventListener("click", () => nav.classList.remove("open"))
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeLb();
        nav?.classList.remove("open");
      }
      const tag = document.activeElement?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        $("#search")?.focus();
      }
    });
    $("#lightbox")?.addEventListener("click", (e) => {
      if (e.target.id === "lightbox") closeLb();
    });
    $("#lb-close")?.addEventListener("click", closeLb);
  }

  function proofCard(item) {
    const extras = (item.extra_urls || [])
      .map((u) => `<a class="pill" href="${u}" target="_blank" rel="noopener noreferrer">extra</a>`)
      .join("");
    return `
      <article class="proof-card glass">
        <div class="kicker">@${esc(item.handle)}</div>
        <p>${esc(item.statement)}</p>
        <div class="pills">
          <a class="pill" href="${esc(item.profile_url)}" target="_blank" rel="noopener noreferrer">@${esc(item.handle)}</a>
          <a class="pill" href="${esc(item.proof_url)}" target="_blank" rel="noopener noreferrer">proof post</a>
          ${extras}
        </div>
        <div class="when">${esc(item.display_name)} · ${new Date(item.created_at).toUTCString()}</div>
      </article>`;
  }

  async function loadProofs() {
    const wall = $("#proof-wall");
    if (!wall) return;
    try {
      const res = await fetch("/api/proof", { cache: "no-store" });
      const payload = await res.json();
      const items = payload.items || [];
      wall.innerHTML = items.length
        ? items.map(proofCard).join("")
        : `<div class="empty glass">No public filings yet. Be the first. Link the account. Link the post.</div>`;
    } catch {
      wall.innerHTML = `<div class="empty glass">The wall is offline. The form still files.</div>`;
    }
  }

  function bindProofForm() {
    const form = $("#proof-form");
    const status = $("#proof-status");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.classList.remove("err");
      status.textContent = "Filing…";
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      try {
        const res = await fetch("/api/proof", {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          body: JSON.stringify(payload)
        });
        const out = await res.json();
        if (!res.ok) throw new Error(out.error || "Rejected.");
        status.textContent = "Filed. It’s on the wall.";
        form.reset();
        await loadProofs();
      } catch (err) {
        status.classList.add("err");
        status.textContent = err.message || "Could not file.";
      }
    });
  }

  renderEvidence();
  renderTimeline();
  renderPeople();
  bindLedger();
  renderLedger();
  spotlight();
  counters();
  nav();
  bindProofForm();
  loadProofs();
})();
