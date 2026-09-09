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
      .map((p) => {
        const files = (p.files || [])
          .map((id) => `<a class="pill ghost" href="/case#${esc(id)}">${esc(id)}</a>`)
          .join("");
        const shots = (p.exhibits || [])
          .map((id) => `<a class="pill ghost" href="/exhibits">Ex ${esc(id)}</a>`)
          .join("");
        return `
      <article class="person glass dossier">
        <div class="person-top">
          <div class="avatar" aria-hidden="true">${initials(p.name)}</div>
          <div>
            <strong>${esc(p.name)}</strong>
            <span>@${esc(p.handle)}</span>
            <em>${esc(p.kind || "on the tape")} · ${esc(p.role)}</em>
          </div>
        </div>
        <p>${esc(p.bio || p.role)}</p>
        <div class="pills">${files}${shots}<a class="pill" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Open profile</a></div>
        <div class="badge ${p.status === "suspended" ? "down" : ""}">${p.status === "suspended" ? "Account suspended" : "Live profile"}</div>
      </article>`;
      })
      .join("");
  }

  let allRows = [
    ...(data.hates || []).map((h, i) => ({ n: i + 1, cat: h[0], text: h[1], kind: "hate" })),
    ...(data.likes || []).map((h, i) => ({ n: i + 1, cat: h[0], text: h[1], kind: "like" })),
    ...(data.neutrals || []).map((h, i) => ({ n: i + 1, cat: h[0], text: h[1], kind: "neutral" }))
  ];

  let filter = "all";
  let query = "";
  const liveSeen = new Set();

  function label(r) {
    if (r.live) return "LIVE";
    if (r.kind === "like") return "LIKE";
    if (r.kind === "neutral") return "NOTE";
    return String(r.n).padStart(3, "0");
  }

  function renderLedger() {
    if (!$("#ledger-list")) return;
    const list = allRows.filter((r) => {
      const catOk =
        filter === "all" ||
        (filter === "hate" && r.kind === "hate") ||
        (filter === "like" && r.kind === "like") ||
        (filter === "neutral" && r.kind === "neutral") ||
        r.cat === filter;
      const q = query.trim().toLowerCase();
      const textOk = !q || r.text.toLowerCase().includes(q) || r.cat.includes(q) || r.kind.includes(q);
      return catOk && textOk;
    });
    const hateCount = $("#hate-count");
    const likeCount = $("#like-count");
    const noteCount = $("#neutral-count");
    const shown = $("#shown-count");
    if (hateCount) hateCount.textContent = String((data.hates || []).length);
    if (likeCount) likeCount.textContent = String((data.likes || []).length);
    if (noteCount) noteCount.textContent = String((data.neutrals || []).length);
    if (shown) shown.textContent = String(list.length);
    $("#ledger-list").innerHTML = list.length
      ? list
          .map((r) => {
            const catNote = (data.cats && data.cats[r.cat]) || "";
            const tag = r.live ? `live · ${r.cat}` : r.kind === "like" ? "why they stay" : r.kind === "neutral" ? "on the record" : r.cat;
            const p = `<p>${esc(r.text)}</p>${catNote ? `<p class="reason-dek">${esc(catNote)}</p>` : ""}<span class="tag">${esc(tag)}</span>`;
            const inner = r.url
              ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${p}</a>`
              : `<div>${p}</div>`;
            return `<article class="reason ${r.kind}${r.live ? " live" : ""}"><div class="idx">${label(r)}</div>${inner}</article>`;
          })
          .join("")
      : `<div class="empty glass">No receipts match that filter.</div>`;
  }

  async function pollLedger() {
    if (!$("#ledger-list")) return;
    try {
      const res = await fetch("/api/ledger", { cache: "no-store" });
      const payload = await res.json();
      let added = 0;
      (payload.live || []).forEach((row) => {
        if (!row.id || liveSeen.has(row.id)) return;
        liveSeen.add(row.id);
        allRows.unshift({
          n: 0,
          cat: row.cat || "world",
          text: row.text,
          kind: row.kind || "neutral",
          url: row.url,
          live: true
        });
        added += 1;
      });
      const ping = $("#ledger-ping");
      if (ping) ping.textContent = `live ${new Date().toISOString().slice(11, 19)} UTC`;
      if (added) renderLedger();
    } catch {
      const ping = $("#ledger-ping");
      if (ping) ping.textContent = "live reconnect";
    }
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
    els.forEach((el) => {
      if (el.textContent && el.textContent.trim() !== "0") return;
      io.observe(el);
    });
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
    const sheet = $("#sheet");
    const open = $("#open-sheet");
    const close = $("#sheet-close");
    const submitBtn = $("#proof-submit");
    open?.addEventListener("click", () => {
      if (!sheet) return;
      sheet.hidden = false;
      requestAnimationFrame(() => sheet.classList.add("open"));
      $("#handle")?.focus();
    });
    const hideSheet = () => {
      if (!sheet) return;
      sheet.classList.remove("open");
      setTimeout(() => {
        sheet.hidden = true;
      }, 320);
    };
    close?.addEventListener("click", hideSheet);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && sheet && !sheet.hidden) hideSheet();
    });
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.classList.remove("err");
      status.textContent = "Scraping X…";
      if (submitBtn) submitBtn.disabled = true;
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
        status.textContent = "Verified. Live on the wire.";
        form.reset();
        setTimeout(() => {
          hideSheet();
          window.location.href = "/live";
        }, 700);
      } catch (err) {
        status.classList.add("err");
        status.textContent = err.message || "Could not verify.";
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  function renderCases() {
    const index = $("#case-index");
    const open = $("#case-open");
    if (!index || !open) return;
    const cases = data.cases || [];
    index.innerHTML = cases
      .map(
        (c) => `
      <button class="case-card glass" type="button" data-case="${esc(c.id)}">
        <div class="kicker">${esc(c.id)} · ${esc(c.date)}</div>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.charge)}</p>
      </button>`
      )
      .join("");

    function show(id) {
      const c = cases.find((x) => x.id === id) || cases[0];
      if (!c) return;
      $$(".case-card").forEach((el) => el.setAttribute("aria-current", el.dataset.case === c.id ? "true" : "false"));
      const people = (c.people || [])
        .map((h) => `<a class="pill" href="https://x.com/${esc(h)}" target="_blank" rel="noopener noreferrer">@${esc(h)}</a>`)
        .join("");
      const links = (c.links || [])
        .map((l) => `<a class="pill" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a>`)
        .join("");
      let clock = "";
      if (c.id === "FX-0904" && (data.timeline || []).length) {
        clock = `<ol class="tl">${data.timeline
          .map((t) => {
            const inner = `<time datetime="${esc(t.t)}">${esc(t.t)}</time><div><h4>${esc(t.title)}</h4><p>${esc(t.body)}</p></div>`;
            return t.url
              ? `<li><a class="tl-row" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">${inner}</a></li>`
              : `<li><div class="tl-row">${inner}</div></li>`;
          })
          .join("")}</ol>`;
      }
      const doss = (data.dossiers && data.dossiers[c.id]) || {};
      const shots = (c.exhibits || [])
        .map((id) => `<a class="pill ghost" href="/exhibits">Exhibit ${esc(id)}</a>`)
        .join("");
      const both =
        doss.street || doss.company
          ? `<div class="case-both">
              ${doss.street ? `<div><div class="kicker">Street story</div><p>${esc(doss.street)}</p></div>` : ""}
              ${doss.company ? `<div><div class="kicker">Company-adjacent</div><p>${esc(doss.company)}</p></div>` : ""}
            </div>`
          : "";
      open.innerHTML = `
        <div class="kicker">${esc(c.id)} · ${esc(c.date)} · ${esc(c.status)}</div>
        <h2>${esc(c.title)}</h2>
        ${doss.why ? `<p class="lede">${esc(doss.why)}</p>` : ""}
        ${both}
        <p>${esc(c.body)}</p>
        <div class="case-people">${people}${links}${shots}</div>
        ${clock}`;
      if (location.hash.replace("#", "") !== c.id) history.replaceState(null, "", `#${c.id}`);
    }

    index.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-case]");
      if (!btn) return;
      show(btn.dataset.case);
      open.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    window.addEventListener("hashchange", () => show(location.hash.replace("#", "")));
    show(location.hash.replace("#", "") || cases[0].id);
  }

  renderEvidence();
  renderTimeline();
  renderPeople();
  renderCases();
  bindLedger();
  renderLedger();
  pollLedger();
  if ($("#ledger-list")) setInterval(pollLedger, 8000);
  spotlight();
  counters();
  nav();
  bindProofForm();
  loadProofs();
})();
