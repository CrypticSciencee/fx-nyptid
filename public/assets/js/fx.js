(() => {
  const data = window.FX;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

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
    root.innerHTML = data.evidence
      .map(
        (e) => `
      <article class="shot glass">
        <figure>
          <button class="frame-hit" type="button" data-id="${e.id}" aria-label="Open ${e.kicker}">
            <div class="frame"><img src="assets/evidence/${e.file}" alt="${e.charge}" loading="lazy"></div>
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
    if (!e) return;
    const lb = $("#lightbox");
    $("#lb-img").src = `assets/evidence/${e.file}`;
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
    $("#lb-close").focus();
  }

  function closeLb() {
    $("#lightbox").hidden = true;
    document.body.style.overflow = "";
  }

  function renderTimeline() {
    $("#timeline").innerHTML = data.timeline
      .map((t) => {
        const inner = `<time datetime="${t.t}">${t.t}</time><div><h4>${t.title}</h4><p>${t.body}</p></div>`;
        return t.url
          ? `<li><a class="tl-row" href="${t.url}" target="_blank" rel="noopener noreferrer">${inner}</a></li>`
          : `<li><div class="tl-row">${inner}</div></li>`;
      })
      .join("");
  }

  function renderPeople() {
    $("#people-grid").innerHTML = data.people
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
    ...data.hates.map((h, i) => ({ n: i + 1, cat: h[0], text: h[1], kind: "hate" })),
    ...data.likes.map((h, i) => ({ n: i + 1, cat: h[0], text: h[1], kind: "like" }))
  ];

  let filter = "hate";
  let query = "";

  function renderLedger() {
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
    $("#hate-count").textContent = String(data.hates.length);
    $("#like-count").textContent = String(data.likes.length);
    $("#shown-count").textContent = String(list.length);
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
    $$("[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("[data-filter]").forEach((b) => b.classList.remove("on"));
        btn.classList.add("on");
        filter = btn.dataset.filter;
        renderLedger();
      });
    });
    $("#search").addEventListener("input", (e) => {
      query = e.target.value;
      renderLedger();
    });
  }

  function spotlight() {
    const cards = $$(".glass");
    cards.forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    });
  }

  function counters() {
    const els = $$("[data-count]");
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
    const nav = $(".nav");
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
        nav.classList.remove("open");
      }
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        $("#search")?.focus();
      }
    });
    $("#lightbox").addEventListener("click", (e) => {
      if (e.target.id === "lightbox") closeLb();
    });
    $("#lb-close").addEventListener("click", closeLb);
  }

  renderEvidence();
  renderTimeline();
  renderPeople();
  bindLedger();
  renderLedger();
  spotlight();
  counters();
  nav();
})();
